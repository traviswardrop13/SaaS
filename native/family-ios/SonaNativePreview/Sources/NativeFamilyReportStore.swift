import Foundation
import Combine
import SonaFamilyMigration
import SonaFamilyRules

struct NativeFamilyReportStatus: Decodable {
    let can: Bool
    let email: String
    let on, pending, off, owed, sent: Bool
}

/// The existing Sona endpoint is the only destination for report packets.
struct NativeFamilyReportRequest {
    let url = URL(string: "https://app.speaksona.com/api/report")!
    let origin = "https://app.speaksona.com"
    let body: Data
}
@MainActor protocol NativeFamilyReportTransport {
    func send(_ request: NativeFamilyReportRequest) async throws -> Data
}

@MainActor final class NativeFamilyReportHTTPTransport: NativeFamilyReportTransport {
    private let session: URLSession

    init(configuration: URLSessionConfiguration = .ephemeral) {
        configuration.httpShouldSetCookies = false
        configuration.httpCookieStorage = nil
        configuration.urlCredentialStorage = nil
        configuration.urlCache = nil
        session = URLSession(configuration: configuration, delegate: NativeFamilyReportRedirectGuard(), delegateQueue: nil)
    }

    deinit { session.invalidateAndCancel() }

    func send(_ packet: NativeFamilyReportRequest) async throws -> Data {
        guard packet.body.count <= 4_000 else { throw URLError(.dataLengthExceedsMaximum) }
        var request = URLRequest(url: packet.url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 20)
        request.httpMethod = "POST"
        request.httpShouldHandleCookies = false
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue(packet.origin, forHTTPHeaderField: "Origin")
        request.httpBody = packet.body

        let (data, response) = try await session.data(for: request)
        guard let reply = response as? HTTPURLResponse, reply.url == packet.url,
              (200..<300).contains(reply.statusCode) else { throw URLError(.badServerResponse) }
        guard data.count <= 4_000 else { throw URLError(.dataLengthExceedsMaximum) }
        return data
    }
}

final class NativeFamilyReportRedirectGuard: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask,
                    willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}

/// REPORT1 orchestration. Preview builds and tests can leave delivery disconnected.
/// Status reads do not prepare activation, change records or send anything.
@MainActor final class NativeFamilyReportStore: ObservableObject {
    enum Trigger: Sendable { case countedRep, background, settings }
    @Published private(set) var status: NativeFamilyReportStatus?
    @Published private(set) var busy = false
    @Published private(set) var error: String?
    private let repository: NativeFamilyRepository
    private let transport: (any NativeFamilyReportTransport)?
    private let now: @Sendable () -> Date
    private var origin: LegacyOrigin?
    private var flights: [LegacyOrigin: Task<Bool, Never>] = [:]
    private var dirty: [LegacyOrigin: Int] = [:]
    var deliveryConnected: Bool { transport != nil }

    init(repository: NativeFamilyRepository, transport: (any NativeFamilyReportTransport)? = nil,
         now: @escaping @Sendable () -> Date = { Date() }) {
        self.repository = repository; self.transport = transport; self.now = now
    }
    func bind(origin: LegacyOrigin?) async {
        guard self.origin != origin else { return }
        self.origin = origin; status = nil; error = nil; busy = origin.flatMap { flights[$0] } != nil
        await refresh()
    }
    func refresh() async {
        guard let owner = origin else { return }
        do {
            guard let document = try await repository.snapshot(), document.primaryOrigin == owner,
                  let family = document.origins[owner.rawValue] else { return }
            let data = try NativeWeeklyReportPolicy.status(storage: family.storage, profileKeys: Self.profileKeys(family), now: now())
            guard origin == owner else { return }
            status = try JSONDecoder().decode(NativeFamilyReportStatus.self, from: data)
        } catch { if origin == owner { self.error = "Sona couldn’t read the weekly report. Try again." } }
    }

    @discardableResult func sync(trigger: Trigger, for expectedOrigin: LegacyOrigin? = nil) async -> Bool {
        guard let owner = origin, expectedOrigin == nil || expectedOrigin == owner, transport != nil else { return false }
        if trigger == .countedRep { dirty[owner, default: 0] += 1 }
        if trigger == .background && dirty[owner] == nil { return false }
        if let pending = flights[owner] {
            let result = await pending.value
            // A game can close while its first update is still in flight.
            // Flush any later reps using the same forced background policy.
            guard trigger == .background, result, origin == owner, dirty[owner] != nil,
                  flights[owner] == nil else { return result }
        }
        let generation = dirty[owner]
        busy = true; error = nil
        let task = Task { [weak self] in
            guard let self else { return false }
            let result = await self.run(owner: owner, trigger: trigger)
            // Cleanup belongs to the flight, not one of its waiters. Turn off
            // must not mistake a completed update for its own queued delete.
            self.flights.removeValue(forKey: owner)
            if result && self.dirty[owner] == generation { self.dirty.removeValue(forKey: owner) }
            if self.origin == owner { self.busy = false; await self.refresh() }
            return result
        }
        flights[owner] = task
        return await task.value
    }

    @discardableResult func turnOff() async -> Bool {
        guard let owner = origin else { return false }
        do {
            let date = now()
            try await repository.queueWeeklyReportOff(origin: owner) { family, action in
                try Self.project(family, action: action, trigger: .settings, at: date)
            }
            await refresh()
            // The off is durable before waiting. A preceding update must land
            // first, and no replacement update may resend after withdrawal.
            if let pending = flights[owner] { _ = await pending.value }
            guard origin == owner else { return false }
            return await sync(trigger: .settings)
        } catch {
            if origin == owner { self.error = "Sona couldn’t turn off the report. Try again." }
            return false
        }
    }

    private func run(owner: LegacyOrigin, trigger: Trigger) async -> Bool {
        do {
            var sentAny = false
            for _ in 0..<7 {
                let date = now()
                guard let packet = try await repository.prepareWeeklyReport(origin: owner, now: date, policy: { family, action in
                    try Self.project(family, action: action, trigger: trigger, at: date)
                }) else { return sentAny }
                let maySend = try await repository.weeklyReportMaySend(packet)
                if !maySend {
                    // Keep another origin's packet. For withdrawn consent,
                    // retire the interrupted active packet without resending
                    // numbers, then drain its existing off obligation.
                    guard let document = try await repository.snapshot(), document.primaryOrigin == owner else { return false }
                    try await acknowledge(packet, response: nil)
                    continue
                }
                let response = await acceptedResponse(packet.body)
                try await acknowledge(packet, response: response)
                guard response != nil else {
                    if origin == owner { error = "Sona will try the weekly report again when it’s online." }
                    return false
                }
                sentAny = true
                let object = try JSONSerialization.jsonObject(with: packet.body) as? [String: Any]
                if object?["off"] as? Bool != true { return true }
            }
            return false
        } catch {
            if origin == owner { self.error = "Sona couldn’t update the weekly report. Try again." }
            return false
        }
    }
    private func acknowledge(_ packet: NativeFamilyReportPacket, response: Data?) async throws {
        let date = now()
        try await repository.acknowledgeWeeklyReport(packet) { family in
            let result = try NativeWeeklyReportPolicy.acknowledge(storage: family.storage, profileKeys: Self.profileKeys(family),
                context: packet.context, response: response, now: date)
            return .init(reportState: result.reportState, profilePatches: result.profilePatches)
        }
    }
    private func acceptedResponse(_ body: Data) async -> Data? {
        guard body.count <= 4_000, let transport else { return nil }
        do {
            let data = try await transport.send(.init(body: body))
            guard data.count <= 4_000, let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                  object["ok"] as? Bool == true else { return nil }
            var accepted: [String: Bool] = ["ok": true]
            for key in ["pending", "off"] where object[key] as? Bool == true { accepted[key] = true }
            return try JSONSerialization.data(withJSONObject: accepted)
        } catch { return nil }
    }
    nonisolated private static func profileKeys(_ family: NativeFamilyOrigin) -> [String] {
        family.children.map { $0.id.slot.isEmpty ? "sona.profile.v1" : "sona.profile.v1@" + $0.id.slot }
    }
    nonisolated private static func project(_ family: NativeFamilyOrigin, action: NativeFamilyReportAction,
                                           trigger: Trigger, at date: Date) throws -> NativeFamilyReportMutation {
        let result: NativeWeeklyReportPolicy.Projection
        switch action {
        case .flush:
            result = try NativeWeeklyReportPolicy.prepare(storage: family.storage, profileKeys: profileKeys(family), action: .flush,
                force: trigger == .settings, now: date)
        case .sync:
            result = try NativeWeeklyReportPolicy.prepare(storage: family.storage, profileKeys: profileKeys(family), action: .sync,
                force: trigger != .countedRep, now: date)
        case .queueOff(let email):
            result = try NativeWeeklyReportPolicy.prepare(storage: family.storage, profileKeys: profileKeys(family), action: .queueOff,
                force: true, now: date, removedEmail: email)
        }
        return .init(reportState: result.reportState, profilePatches: result.profilePatches, body: result.body, context: result.context)
    }
}

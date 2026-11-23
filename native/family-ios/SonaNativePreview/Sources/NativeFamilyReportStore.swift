import Foundation
import Combine
import SonaFamilyMigration
import SonaFamilyRules

struct NativeFamilyReportStatus: Decodable {
    let can: Bool
    let email: String
    let suggestedEmail: String
    let on, pending, off, owed, sent: Bool
}

/// The existing report and adult tips signup endpoints have separate payloads.
struct NativeFamilyReportRequest {
    private enum Destination: String { case report, lead }
    private let destination: Destination
    var url: URL { URL(string: origin + "/api/" + destination.rawValue)! }
    let origin = "https://app.speaksona.com"
    let body: Data

    init(body: Data) { destination = .report; self.body = body }

    init(signup: NativeFamilyReportSignup) throws {
        struct SettingsLead: Encodable {
            let email: String
            let role = "parent"
            let source = "app-settings"
            let summary = "Turned on the weekly progress report in Settings"
            let premium: Bool?
        }
        struct SetupLead: Encodable {
            let email: String
            let role = "parent"
            let source = "app-setup"
            let summary = "New parent (weekly report opt-in)"
        }
        destination = .lead
        switch signup.source {
        case .appSetup: body = try JSONEncoder().encode(SetupLead(email: signup.email))
        case .appSettings: body = try JSONEncoder().encode(SettingsLead(email: signup.email, premium: signup.premium ? true : nil))
        }
    }
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
    enum Trigger: Sendable { case countedRep, background, settings, settingsVisit, setup }
    @Published private(set) var status: NativeFamilyReportStatus?
    @Published private(set) var busy = false
    @Published private(set) var error: String?
    private let repository: NativeFamilyRepository
    private let transport: (any NativeFamilyReportTransport)?
    private let now: @Sendable () -> Date
    private var origin: LegacyOrigin?
    private var flights: [LegacyOrigin: Task<Bool, Never>] = [:]
    private var signupFlights: Set<LegacyOrigin> = []
    private var signupFollowUps: Set<LegacyOrigin> = []
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

    func settingsAppeared() async {
        await refresh()
        guard let owner = origin, let status else { return }
        startSignupDelivery(owner: owner)
        if status.owed || (status.on && (!status.sent || status.pending)) {
            await sync(trigger: .settingsVisit, for: owner)
        }
    }

    /// Called only after the owner-scoped setup transaction is durable. This
    /// starts queued work without holding the ready screen or price handoff on
    /// HTTP. The repository rechecks current origin and consent before sending.
    func setupCommitted(for expectedOrigin: LegacyOrigin) {
        guard origin == expectedOrigin, transport != nil else { return }
        Task { [weak self] in
            _ = await self?.sync(trigger: .setup, for: expectedOrigin)
        }
    }

    @discardableResult func sync(trigger: Trigger, for expectedOrigin: LegacyOrigin? = nil) async -> Bool {
        guard let owner = origin, expectedOrigin == nil || expectedOrigin == owner, transport != nil else { return false }
        startSignupDelivery(owner: owner)
        if trigger == .countedRep { dirty[owner, default: 0] += 1 }
        if trigger == .background && dirty[owner] == nil { return false }
        if let pending = flights[owner] {
            let result = await pending.value
            // A game can close while its first update is still in flight.
            // Flush any later reps using the same forced background policy.
            let flushNewReps = trigger == .background && result && dirty[owner] != nil
            guard (flushNewReps || trigger == .settingsVisit), origin == owner, flights[owner] == nil else { return result }
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

    @discardableResult func turnOn(email: String, premium: Bool) async -> Bool {
        guard let owner = origin else { return false }
        error = nil
        do {
            let date = now()
            try await repository.queueWeeklyReportOn(origin: owner, email: email, premium: premium) { family, action in
                try Self.project(family, action: action, trigger: .settings, at: date)
            }
            if transport != nil { dirty[owner, default: 0] += 1 }
            await refresh()
            if origin == owner { startSignupDelivery(owner: owner, followUp: true) }
            // The new signup waits for an older off or snapshot already on the
            // wire. The tips signup does not wait for either report response.
            if let pending = flights[owner] {
                _ = await pending.value
                let normalized = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                if origin == owner, status?.email == normalized, status?.sent == true { return true }
            }
            guard origin == owner else { return false }
            return await sync(trigger: .settings, for: owner)
        } catch {
            guard origin == owner else { return false }
            switch error {
            case NativeFamilyReportError.invalidAddress:
                self.error = email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?
                    "Type the grown-up’s email first." : "That email doesn’t look right."
            case NativeFamilyReportError.alreadyOn:
                await refresh()
            default:
                self.error = "Sona couldn’t save the weekly report. Try again."
            }
            return false
        }
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
    private func startSignupDelivery(owner: LegacyOrigin, followUp: Bool = false) {
        guard transport != nil, origin == owner else { return }
        guard signupFlights.insert(owner).inserted else {
            if followUp { signupFollowUps.insert(owner) }
            return
        }
        Task { [weak self] in
            guard let self else { return }
            defer {
                self.signupFlights.remove(owner)
                if self.signupFollowUps.remove(owner) != nil { self.startSignupDelivery(owner: owner) }
            }
            do {
                guard let signup = try await self.repository.prepareWeeklyReportSignup(origin: owner, now: self.now()),
                      self.origin == owner, try await self.repository.weeklyReportMaySendSignup(signup),
                      self.origin == owner else { return }
                let request = try NativeFamilyReportRequest(signup: signup)
                guard await self.acceptedJSON(request) != nil else { return }
                try await self.repository.acknowledgeWeeklyReportSignup(signup)
            } catch {
                // The separate tips signup stays queued. An unavailable list
                // cannot change whether a report is on or confirmed.
            }
        }
    }

    private func acceptedJSON(_ request: NativeFamilyReportRequest) async -> [String: Any]? {
        guard request.body.count <= 4_000, let transport else { return nil }
        do {
            let data = try await transport.send(request)
            guard data.count <= 4_000, let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                  object["ok"] as? Bool == true else { return nil }
            return object
        } catch { return nil }
    }

    private func acceptedResponse(_ body: Data) async -> Data? {
        guard let object = await acceptedJSON(.init(body: body)) else { return nil }
        var accepted: [String: Bool] = ["ok": true]
        for key in ["pending", "off"] where object[key] as? Bool == true { accepted[key] = true }
        return try? JSONSerialization.data(withJSONObject: accepted)
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
                force: trigger == .settings || trigger == .settingsVisit || trigger == .setup, now: date)
        case .sync:
            if trigger == .settingsVisit {
                let state = try NativeWeeklyReportPolicy.status(storage: family.storage, profileKeys: profileKeys(family), now: date)
                let status = try JSONDecoder().decode(NativeFamilyReportStatus.self, from: state)
                if !status.on || (status.sent && !status.pending) {
                    return .init(reportState: nil, profilePatches: [:])
                }
            }
            result = try NativeWeeklyReportPolicy.prepare(storage: family.storage, profileKeys: profileKeys(family), action: .sync,
                force: trigger != .countedRep, now: date)
        case .queueOff(let email):
            result = try NativeWeeklyReportPolicy.prepare(storage: family.storage, profileKeys: profileKeys(family), action: .queueOff,
                force: true, now: date, removedEmail: email)
        case .queueOn(let email):
            result = try NativeWeeklyReportPolicy.prepare(storage: family.storage, profileKeys: profileKeys(family), action: .queueOn,
                force: true, now: date, signupEmail: email)
        }
        return .init(reportState: result.reportState, profilePatches: result.profilePatches, body: result.body, context: result.context)
    }
}

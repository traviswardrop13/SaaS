import Foundation
import Combine

@MainActor public protocol NativeTrialReminderClient: AnyObject {
    var isAvailable: Bool { get }
    func authorization() async throws -> NativeTrialReminderAuthorization
    func requestAuthorization() async throws -> Bool
    func schedule(_ request: NativeTrialReminderRequest) async throws -> Bool
    func cancel(id: String) async throws
}

public struct NativeTrialReminderPhoneState: Codable, Equatable, Sendable {
    public var state: NativeTrialReminderAuthorization?
    public var asked, arm, end, sync, tried: Double?
    public var nudge: Int?
    public var nudges: [NativeTrialReminderPending]?
    public var nend: Double?
    public var nclock: Int?
    public init() {}
}

public struct NativeTrialReminderLocalState: Equatable, Sendable {
    public var notify: NativeTrialReminderPhoneState
    public var playedDay: String?
    public var importedLegacy: Bool
    public init(notify: NativeTrialReminderPhoneState = .init(), playedDay: String? = nil, importedLegacy: Bool = false) {
        self.notify = notify; self.playedDay = playedDay; self.importedLegacy = importedLegacy
    }
}

@MainActor public protocol NativeTrialReminderPersistence: AnyObject {
    func load() throws -> NativeTrialReminderLocalState
    func save(_ state: NativeTrialReminderLocalState) throws
}

/// Phone-only state. This is never added to a family export, backup, profile,
/// clinician payload, purchase identity, analytics, or a server request.
@MainActor public final class NativeTrialReminderDefaults: NativeTrialReminderPersistence {
    private let defaults: UserDefaults
    public init(defaults: UserDefaults = .standard) { self.defaults = defaults }
    public func load() throws -> NativeTrialReminderLocalState {
        let bytes = defaults.string(forKey: "sona.notify.v1").map { Data($0.utf8) }
        let notify = bytes.flatMap { try? JSONDecoder().decode(NativeTrialReminderPhoneState.self, from: $0) } ?? .init()
        return .init(notify: notify, playedDay: defaults.string(forKey: "sona.played.v1"), importedLegacy: defaults.bool(forKey: "sona.native.reminder-upgrade.v1"))
    }
    public func save(_ state: NativeTrialReminderLocalState) throws {
        let text = String(decoding: try JSONEncoder().encode(state.notify), as: UTF8.self)
        let had = defaults.string(forKey: "sona.notify.v1")
        if text != had && !(had == nil && text == "{}") { defaults.set(text, forKey: "sona.notify.v1") }
        defaults.set(state.importedLegacy, forKey: "sona.native.reminder-upgrade.v1")
        if let played = state.playedDay { defaults.set(played, forKey: "sona.played.v1") }
        else { defaults.removeObject(forKey: "sona.played.v1") }
    }
}

public enum NativeTrialReminderContext: Sendable { case home, nonHome }
public enum NativeTrialReminderSyncResult: String, Sendable {
    case home, armed, near, kept, cancelled, off, later, stale, error, unavailable
}
public struct NativeTrialReminderTimeouts: Sendable {
    public var status = 3_000.0, authorization = 60_000.0, store = 8_000.0
    public init(status: Double = 3_000, authorization: Double = 60_000, store: Double = 8_000) {
        self.status = status; self.authorization = authorization; self.store = store
    }
}

/// NOTIFY1/NUDGE1. Initialization reads only local state. All iOS authorization
/// is a deliberate parent tap; Home never checks authorization or the store.
@MainActor public final class NativeTrialReminderStore: ObservableObject {
    public typealias StatusProvider = @MainActor () async -> NativeTrialReminderStatus?
    @Published public private(set) var authorization: NativeTrialReminderAuthorization
    public private(set) var localState: NativeTrialReminderLocalState
    private let client: any NativeTrialReminderClient
    private let persistence: any NativeTrialReminderPersistence
    private let provider: StatusProvider?
    private let now: @MainActor () -> Date
    private let timeZone: @MainActor () -> TimeZone
    private let timeouts: NativeTrialReminderTimeouts
    private var pendingLegacy: NativeTrialReminderLocalState?
    private var didRefresh = false
    private var buys = 0
    private var refreshing: Task<NativeTrialReminderAuthorization, Never>?
    private var syncing: (generation: Int, task: Task<NativeTrialReminderSyncResult, Never>)?
    private var mutationTail: Task<Void, Never>?
    private var purchaseTasks: [Task<Void, Never>] = []

    public init(client: any NativeTrialReminderClient, persistence: any NativeTrialReminderPersistence,
                statusProvider: StatusProvider? = nil, now: @escaping @MainActor () -> Date = { Date() },
                timeZone: @escaping @MainActor () -> TimeZone = { .current },
                timeouts: NativeTrialReminderTimeouts = .init(), sameDeviceLegacyState: NativeTrialReminderLocalState? = nil) {
        self.client = client; self.persistence = persistence; self.provider = statusProvider
        self.now = now; self.timeZone = timeZone; self.timeouts = timeouts
        let loaded = (try? persistence.load()) ?? .init()
        self.localState = loaded
        self.authorization = client.isAvailable ? loaded.notify.state ?? .unknown : .unavailable
        self.pendingLegacy = sameDeviceLegacyState
    }

    /// Stage only verified same-container upgrade metadata, never a portable backup.
    /// Staging on Home reads/writes no notification state and calls no iOS API.
    public func stageSameDeviceLegacyState(_ state: NativeTrialReminderLocalState) {
        if !localState.importedLegacy { pendingLegacy = state }
    }
    public func refreshAuthorization() async -> NativeTrialReminderAuthorization {
        guard client.isAvailable else { return .unavailable }
        seedLegacyIfNeeded()
        if let refreshing { return await refreshing.value }
        let task = Task { [self] in
            let answer = await bounded(milliseconds: timeouts.status) { try? await self.client.authorization() }
            didRefresh = true
            if let answer, answer != .unknown, answer != .unavailable { update { $0.notify.state = answer } }
            authorization = localState.notify.state ?? .unknown
            return authorization
        }
        refreshing = task
        let value = await task.value; refreshing = nil; return value
    }
    public func shouldOfferSetup(priceFollows: Bool, confirmedFreeTrial: Bool) -> Bool {
        client.isAvailable && didRefresh && authorization == .prompt && priceFollows && confirmedFreeTrial
    }
    public func enableReminders() async -> Bool {
        guard client.isAvailable else { return false }
        seedLegacyIfNeeded()
        update { $0.notify.nudge = 1; $0.notify.asked = milliseconds }
        return await bounded(milliseconds: timeouts.authorization) { [self] in
            do {
                let granted = try await client.requestAuthorization()
                // Intentionally kept even if the visible wait already expired.
                update { $0.notify.state = granted ? .granted : .denied }
                authorization = localState.notify.state ?? .unknown
                return granted
            } catch { return await refreshAuthorization() == .granted }
        } ?? false
    }
    public func trialReminderOn() -> Bool { client.isAvailable && authorization == .granted }
    public func trialReminderOn(sureFreeEnd: Date) -> Bool {
        trialReminderOn() && NativeTrialReminderPolicy.trial(end: sureFreeEnd.timeIntervalSince1970 * 1_000, now: milliseconds) != nil
    }

    /// Called once from the actual purchase result before leaving the price
    /// page. Never awaited by purchase UI or repeated by an access-save retry.
    public func purchaseSucceeded(_ evidence: NativeTrialReminderPurchase) {
        buys += 1
        let gen = buys
        guard client.isAvailable else { return }
        seedLegacyIfNeeded()
        update { $0.notify.sync = nil; $0.notify.tried = nil }
        let period = evidence.periodType
        if ["NORMAL", "INTRO", "PREPAID"].contains(period) {
            purchaseTasks.append(queue { await self.cancelNudges() }); return
        }
        guard trialReminderOn() else { return }
        let end = evidence.expirationMilliseconds.flatMap { $0.isFinite && $0 > 0 ? $0 : nil }
        let guess = evidence.sureFreeEndMilliseconds.flatMap { $0.isFinite && $0 > 0 ? $0 : nil }
        let offered = evidence.offerFreeEndMilliseconds.flatMap { $0.isFinite && $0 > 0 ? $0 : nil } ?? guess
        let first = period == "TRIAL" ? end ?? offered : period.isEmpty ? guess : nil
        let start = milliseconds
        let task = Task { [self] in
            if let first {
                await queue {
                    guard gen == self.buys else { return }
                    _ = await self.armTrial(first, generation: gen)
                    await self.armNudges(first, start: start)
                }.value
            }
            if period == "TRIAL", end != nil { return }
            guard let answer = await storeAnswer(), gen == buys else { return }
            await queue {
                guard gen == self.buys else { return }
                switch answer.answer {
                case .on(let corrected) where corrected != nil:
                    if abs(corrected! - (first ?? 0)) > 60_000 {
                        _ = await self.armTrial(corrected!, generation: gen)
                        await self.armNudges(corrected!, start: nil)
                    }
                case .paid, .cancelled:
                    if first != nil { await self.cancelTrial(generation: gen); await self.cancelNudges() }
                default: break // a record not caught up with a purchase changes nothing
                }
            }.value
        }
        purchaseTasks.append(task)
    }
    /// Ask to Buy approved later, or Restore after an unconfirmed sale only.
    /// Ordinary Restore is not a new sale and must not call this method.
    public func saleRecovered(sureFreeEnd: Date?) {
        purchaseSucceeded(.init(periodType: "", expirationMilliseconds: nil,
            sureFreeEndMilliseconds: sureFreeEnd.map { $0.timeIntervalSince1970 * 1_000 }))
    }

    public func syncIfDue(context: NativeTrialReminderContext, force: Bool = false) async -> NativeTrialReminderSyncResult {
        guard context != .home else { return .home }
        guard client.isAvailable, provider != nil else { return .unavailable }
        seedLegacyIfNeeded()
        let now = milliseconds, k = localState.notify
        if !force, let last = k.sync, last > 0, last <= now, now - last < NativeTrialReminderPolicy.day { return .later }
        if !force, let tried = k.tried, tried > 0, tried <= now, now - tried < NativeTrialReminderPolicy.hour { return .later }
        if let syncing, syncing.generation == buys { return await syncing.task.value }
        let gen = buys
        let task = Task { await self.runSync(generation: gen) }
        syncing = (gen, task)
        let result = await task.value
        if syncing?.generation == gen { syncing = nil }
        return result
    }
    @discardableResult public func countedRep(occurredAt: Date, timeZone: TimeZone) -> Bool {
        guard client.isAvailable else { return false }
        seedLegacyIfNeeded()
        let when = occurredAt.timeIntervalSince1970 * 1_000
        let day = NativeTrialReminderPolicy.localDay(when, timeZone: timeZone)
        guard localState.playedDay != day else { return false }
        update { $0.playedDay = day }
        let id = NativeTrialReminderPolicy.nudgeID(when, timeZone: timeZone)
        _ = queue { await self.cancelNudges { $0.id == id && $0.at > when } }
        return true
    }
    public func waitForPendingWork() async {
        for task in purchaseTasks { await task.value }
        await mutationTail?.value
        purchaseTasks.removeAll()
    }

    private func runSync(generation gen: Int) async -> NativeTrialReminderSyncResult {
        guard await refreshAuthorization() == .granted else { return .off }
        if gen == buys { update { $0.notify.tried = milliseconds } }
        let answer = await storeAnswer()
        guard gen == buys else { return .stale }
        guard let answer else { update { $0.notify.tried = milliseconds }; return .error }
        update { $0.notify.sync = milliseconds; $0.notify.tried = nil }
        var result = NativeTrialReminderSyncResult.kept
        await queue {
            guard gen == self.buys else { result = .stale; return }
            switch answer.answer {
            case .off, .paid, .cancelled:
                await self.cancelNudges(); await self.cancelTrial(generation: gen); result = .cancelled
            case .unsure, .on(nil): break
            case .on(let end?):
                if let old = self.localState.notify.nend, abs(old - end) > NativeTrialReminderPolicy.hour {
                    await self.armNudges(end, start: nil)
                }
                if await self.armTrial(end, generation: gen) { result = .armed }
                else {
                    if gen == self.buys, let old = self.localState.notify.end, abs(old - end) > NativeTrialReminderPolicy.hour {
                        await self.cancelTrial(generation: gen)
                    }
                    result = .near
                }
            }
            if gen != self.buys { result = .stale }
        }.value
        return result
    }
    private func storeAnswer() async -> NativeTrialReminderStatus? {
        guard let provider else { return nil }
        return await bounded(milliseconds: timeouts.store, operation: provider)
    }
    private func armTrial(_ end: Double, generation: Int) async -> Bool {
        guard trialReminderOn(), let request = NativeTrialReminderPolicy.trial(end: end, now: milliseconds) else { return false }
        let ok = await bounded(milliseconds: timeouts.status) { try? await self.client.schedule(request) } ?? false
        if ok, generation == buys { update { $0.notify.arm = request.at; $0.notify.end = end.rounded() } }
        return ok
    }
    private func cancelTrial(generation: Int) async {
        let ok = await bounded(milliseconds: timeouts.status) { () -> Bool? in
            do { try await self.client.cancel(id: NativeTrialReminderPolicy.trialID); return true } catch { return false }
        } ?? false
        if ok, generation == buys { update { $0.notify.arm = nil; $0.notify.end = nil } }
    }
    private func armNudges(_ end: Double, start: Double?) async {
        guard client.isAvailable, authorization == .granted, localState.notify.nudge == 1, end > milliseconds else { return }
        let from = start ?? milliseconds
        let clock = start == nil ? localState.notify.nclock : nil
        let plan = NativeTrialReminderPolicy.nudges(start: from, end: end, clock: clock, now: milliseconds, timeZone: timeZone())
        let keepClock = clock ?? NativeTrialReminderPolicy.clock(from, timeZone: timeZone())
        await cancelNudges()
        var got: [NativeTrialReminderPending] = []
        for request in plan {
            let ok = await bounded(milliseconds: timeouts.status) { try? await self.client.schedule(request) } ?? false
            if ok { got.append(.init(id: request.id, at: request.at)) }
        }
        update { $0.notify.nudges = got.isEmpty ? nil : got; $0.notify.nend = got.isEmpty ? nil : end.rounded(); $0.notify.nclock = keepClock }
    }
    private func cancelNudges(where pick: (NativeTrialReminderPending) -> Bool = { _ in true }) async {
        let all = localState.notify.nudges ?? [], go = all.filter(pick)
        guard client.isAvailable, !go.isEmpty else { return }
        for item in go {
            _ = await bounded(milliseconds: timeouts.status) { () -> Bool? in
                do { try await self.client.cancel(id: item.id); return true } catch { return false }
            }
        }
        let left = (localState.notify.nudges ?? []).filter { item in !go.contains { $0.id == item.id } }
        update { $0.notify.nudges = left.isEmpty ? nil : left; if left.isEmpty { $0.notify.nend = nil } }
    }
    private func seedLegacyIfNeeded() {
        guard !localState.importedLegacy, let legacy = pendingLegacy else { return }
        if update({ state in
            let fresh = state.notify
            // A permission read can finish before the archive is published.
            // Keep that real OS answer while carrying its original consent.
            if fresh.sync == nil && fresh.tried == nil && fresh.arm == nil && fresh.nudges == nil {
                state.notify = legacy.notify
                state.notify.state = fresh.state ?? legacy.notify.state
                state.notify.asked = fresh.asked ?? legacy.notify.asked
                state.notify.nudge = fresh.nudge ?? legacy.notify.nudge
            } else if state.notify.nudge == nil { state.notify.nudge = legacy.notify.nudge }
            if state.playedDay == nil { state.playedDay = legacy.playedDay }
            state.importedLegacy = true
        }) { pendingLegacy = nil; authorization = localState.notify.state ?? .unknown }
    }
    private var milliseconds: Double { now().timeIntervalSince1970 * 1_000 }
    @discardableResult private func update(_ change: (inout NativeTrialReminderLocalState) -> Void) -> Bool {
        var next = localState; change(&next)
        guard next != localState else { return true }
        do { try persistence.save(next); localState = next; return true } catch { return false }
    }
    private func queue(_ operation: @escaping @MainActor () async -> Void) -> Task<Void, Never> {
        let previous = mutationTail
        let task = Task { await previous?.value; await operation() }
        mutationTail = task; return task
    }
    private func bounded<T>(milliseconds: Double, operation: @escaping @MainActor () async -> T?) async -> T? {
        await withCheckedContinuation { continuation in
            let box = ReminderAnswer(continuation)
            Task { box.finish(await operation()) }
            box.timer = Task {
                do { try await Task.sleep(nanoseconds: UInt64(max(0, milliseconds) * 1_000_000)) }
                catch { return }
                box.finish(nil)
            }
        }
    }
}

@MainActor private final class ReminderAnswer<T> {
    private var continuation: CheckedContinuation<T?, Never>?
    var timer: Task<Void, Never>?
    init(_ continuation: CheckedContinuation<T?, Never>) { self.continuation = continuation }
    func finish(_ value: T?) {
        guard let continuation else { return }
        self.continuation = nil; timer?.cancel(); continuation.resume(returning: value)
    }
}

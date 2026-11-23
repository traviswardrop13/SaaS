import Foundation
import SwiftUI
import SonaFamilyAccess
import SonaFamilyBackup
import SonaFamilyMigration
import SonaFamilyRules
import SonaFamilyStorefront
import SonaSpeechCore

/// Current Home copy and picture ordering from the local canonical rules.
/// No title, access, calendar or seen state is chosen by the view.
struct NativeHomePresentation: Decodable, Equatable {
    struct Card: Decodable, Equatable {
        let label, title, hook, dayLabel, actionLabel: String
        let done, locked: Bool
        let imagePaths: [String]
    }
    let card: Card?
    let booksTag: String
}

struct NativePracticeSummary: Decodable, Equatable {
    struct Goal: Decodable, Equatable {
        let n: Int
        let goal: Int
        let done: Bool
    }
    struct Quest: Decodable, Equatable {
        struct Story: Decodable, Equatable { let id: String }
        let kind: String
        let state: String
        let day: Int
        let game: String
        let story: Story?
        let page: Int?
        let seen: Bool?
    }
    let sound: String
    let bookSound: String
    let pinnedSound: String
    let soundChoices: [String]
    let homework: FamilyHomework?
    let playStyle: String
    let buddy: String
    let goal: Goal
    let weekReps: Int
    let parentProgress: ParentProgressSummary
    let booksRead: [String]
    let oldReadSounds: [String]
    let bestGameIDs: [String]
    let found: [Quest.Story]
    let quest: Quest
    var home: NativeHomePresentation? = nil
}

struct NativePracticeSelection: Decodable {
    struct Item: Decodable {
        let t: String
        let level: String
        let word, say, display, pos: String?
        let cueFirst: Bool?
    }
    struct Cue: Decodable { let tip: String }
    let sound: String
    let practicePosition: String
    let masteredRung: Int
    let selectedRung: Int
    let requiredReps: Int
    let target: Item
    let easier: Item?
    let cue: Cue?
    let voiceID: String
    let voiceOn: Bool
    let voiceVolume: Float
    let humanClipsEnabled: Bool
    let praiseLine: String?
    let gameTitle: String

    var plan: GuidedPracticePlan? {
        func content(_ item: Item) -> PracticeFlowContent? {
            guard let rung = PracticeRung(rawValue: item.level) else { return nil }
            return PracticeFlowContent(sound: sound, rung: rung, text: item.t, say: item.say,
                                       display: item.display, word: item.word, cueTip: cue?.tip ?? "",
                                       position: item.pos ?? "", cueFirst: item.cueFirst ?? false)
        }
        guard let original = content(target) else { return nil }
        return GuidedPracticePlan(content: original, masteredRung: masteredRung, stepNext: easier.flatMap(content),
                                  requiredReps: requiredReps, voiceID: voiceID, volume: voiceVolume, voiceOn: voiceOn,
                                  gameTitle: gameTitle, humanClipsEnabled: humanClipsEnabled, praiseLine: praiseLine)
    }
}

struct NativeRuleFields: Encodable, Sendable {
    var scope: String?
    var sound: String?
    var game: String?
    var word: String?
    var level: String?
    var pos: String?
    var pass: Bool?
    var reps: Int?
    var rung: Int?
    var advance: Bool?
    var sessionTries: Int?
    var title: String?
    var id: String?
    var page: Int?
    var n: Int?
    var kind: String?
    var name: String?
    var age: String?
    var start: String?
    var captions: [String]?
    var caption: String?
    var card: Int?
    var boostLevel: String?
    var boostAsk: String?
    var boostPosition: String?
    var focusSounds: [String]?
    var mode: String?
    var pathReason: String?
    var minutes: Int?
    var character: String?
    var playLevel: Int?
    var bestCount: Int?
    var dinoLast: String?
    var dinoGot: [String]?
    var occurredAtMilliseconds: Double?
    var localDay: String?
    var timeZoneIdentifier: String?
    var timezoneOffsetMinutes: Int?
    var rewalk: Bool?
    var interests: [String]?
}

@MainActor
final class NativeFamilyState: ObservableObject {
    weak var trialReminders: NativeTrialReminderStore?
    enum Stage: Equatable { case loading, ready, chooseOrigin, needsSetup, unavailable }

    @Published private(set) var stage: Stage = .loading
    @Published private(set) var document: NativeFamilyDocument?
    @Published private(set) var summary: NativePracticeSummary?
    private var repository: NativeFamilyRepository?
    private var reportStore: NativeFamilyReportStore?
    private var opening = false
    private var publishGeneration: UInt64 = 0
    private var checkingApple: Set<LegacyOrigin> = []
    private var retiringAudio = false

    var activeChild: NativeFamilyChild? { document?.activeChild }
    var activeID: NativeFamilyChildID? { activeChild?.id }
    var scope: String? { activeID.map(Self.scope(of:)) }
    var isPreview: Bool { Bundle.main.bundleIdentifier == "com.speaksona.family.native-preview" && ProcessInfo.processInfo.arguments.contains("--demo-roster") }
    var entitlement: FamilyEntitlementState {
        guard let origin = document?.primaryOrigin else { return FamilyEntitlementState() }
        return entitlement(for: origin)
    }

    func entitlement(for originID: LegacyOrigin) -> FamilyEntitlementState {
        guard let origin = document?.origins[originID.rawValue], let config = try? FamilyAccessConfiguration.bundled() else {
            return FamilyEntitlementState()
        }
        var result = FamilyEntitlementState.legacy(origin.accessEvidence(), configuration: config)
        if let promises = document?.householdPromises {
            if promises.founder { result.grants.insert(.founder) }
            if promises.founding { result.grants.insert(.foundingFamily) }
            if promises.grandfathered { result.grants.insert(.freeEra) }
            result.keepsFreeVersion = result.keepsFreeVersion || promises.keptFreeVersion
        }
        if let website = document?.websiteAccess?[origin.origin.rawValue] { result.applyWebsiteAccess(website) }
        if let apple = document?.appleAccess?[origin.origin.rawValue] {
            if apple.active { result.grants.insert(.apple) } else { result.grants.remove(.apple) }
            if let at = apple.checkedAt { result.appleCheckedAt = at }
        }
        return result
    }

    var playerViews: [PreviewPlayer] {
        document?.primaryFamily?.children.enumerated().map { index, child in
            let profile = Self.profile(of: child)
            let buddy = (profile["character"] as? String).flatMap(PreviewBuddy.init(rawValue:)) ?? .fox
            let bookmarks = document?.bookmarks(for: child.id).mapValues { BookBookmark(page: $0.page, finished: $0.finished) } ?? [:]
            let complete = document?.completedGames(for: child.id) ?? []
            return PreviewPlayer(id: Self.scope(of: child.id), number: index + 1, buddy: buddy,
                                 targetSound: profile["targetSound"] as? String ?? "",
                                 completedGames: complete,
                                 bookmarks: bookmarks,
                                 displayName: profile["childName"] as? String)
        } ?? []
    }

    static func profile(of child: NativeFamilyChild) -> [String: Any] {
        guard let raw = child.profileJSON, let data = raw.data(using: .utf8) else { return [:] }
        return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
    }

    func open(sounds: [String], preferredSound: String) async {
        guard !opening else { return }
        opening = true
        stage = .loading
        defer { opening = false }
        do {
            let manager = FileManager.default
            let support = try manager.url(for: .applicationSupportDirectory, in: .userDomainMask,
                                          appropriateFor: nil, create: true)
            let base = support.appendingPathComponent("SonaFamily", isDirectory: true)
            let repository = NativeFamilyRepository(store: LocalNativeFamilyDocumentStore(directory: base.appendingPathComponent("Records")))
            self.repository = repository
            let reportTransport = Bundle.main.bundleIdentifier == "com.speaksona.app" ? NativeFamilyReportHTTPTransport() : nil
            reportStore = NativeFamilyReportStore(repository: repository, transport: reportTransport)
            if let existing = try await repository.snapshot() {
                try await publish(existing)
                await reportStore?.bind(origin: existing.primaryOrigin)
                return
            }
            if isPreview {
                try await publish(repository.seedPreview(sounds: sounds, preferredSound: preferredSound))
            } else if Bundle.main.bundleIdentifier == "com.speaksona.family.native-preview" {
                try await publish(repository.seedEmptyPreview())
            } else {
                let archiveStore = LocalMigrationArchiveStore(directory: base.appendingPathComponent("Upgrade"))
                let engine = MigrationEngine(store: archiveStore)
                // Start native-first. Once a verified native document exists,
                // older storage is never read back over native edits.
                let stored = try await engine.archive()
                if !stored.capturedAllKnownOrigins {
                    let capture = try LegacyUpgradeCapture(host: legacyHost)
                    let migration = MigrationRunCoordinator(engine: engine, captureAdapter: capture)
                    _ = try await migration.run()
                }
                try Task.checkCancellation()
                let archive = try await engine.archive()
                try await publish(repository.seed(from: archive))
            }
            await reportStore?.bind(origin: document?.primaryOrigin)
        } catch {
            stage = .unavailable
        }
    }

    private var legacyHost: UIWindow? {
        UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows).first(where: \.isKeyWindow)
    }

    func retireOldRecordings() async {
        if document?.previewBootstrapProvenance == .emptyNativePreviewWithoutLegacy,
           Bundle.main.bundleIdentifier == "com.speaksona.family.native-preview" { return }

        guard !isPreview, !retiringAudio, let repository, let host = legacyHost else { return }
        retiringAudio = true
        defer { retiringAudio = false }
        do {
            guard let saved = try await repository.snapshot(), let capture = try? LegacyUpgradeCapture(host: host) else { return }
            let verified = saved.retiredRecordingOrigins ?? []
            for origin in LegacyOrigin.allCases where !verified.contains(origin) {
                try Task.checkCancellation()
                try await capture.purgeRetiredRecordings(origin: origin)
                try await repository.acknowledgeRetiredRecordings(origin: origin)
            }
        } catch {
            // The next foreground retries only unconfirmed origins. Native
            // family records remain available through the verified seed.
        }
    }

    func selectOrigin(_ origin: LegacyOrigin) async throws {
        guard let repository else { throw NativeFamilyRuleError.playerChanged }
        try await repository.selectOrigin(origin)
        await reportStore?.bind(origin: origin)
        try await refresh()
    }

    func selectChild(_ child: NativeFamilyChildID) async throws {
        guard let repository else { throw NativeFamilyRuleError.playerChanged }
        try await repository.switchChild(child)
        try await refresh()
    }

    func removeChild(_ id: NativeFamilyChildID) async throws {
        guard !isPreview, let repository else { throw NativeFamilyRuleError.playerChanged }
        try await repository.removeChild(id, operationID: UUID(), removeLocalCopies: true)
        try await refresh()
    }

    func removeObsoletePlayerCopies(_ id: NativeFamilyChildID) async throws {
        if document?.previewBootstrapProvenance == .emptyNativePreviewWithoutLegacy,
           Bundle.main.bundleIdentifier == "com.speaksona.family.native-preview" {
            guard let repository else { throw NativeFamilyRuleError.playerChanged }
            try await repository.acknowledgePreviewPlayerRemoval(id)
            try await refresh()
            return
        }
        guard !isPreview, let repository, let host = legacyHost,
              try await repository.snapshot()?.pendingLocalPlayerRemovals?.contains(id) == true
        else { throw NativeFamilyRuleError.playerChanged }
        let support = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask,
                                                  appropriateFor: nil, create: true)
        let directory = support.appendingPathComponent("SonaFamily", isDirectory: true)
            .appendingPathComponent("Upgrade", isDirectory: true)
        let capture = try LegacyUpgradeCapture(host: host)
        if try await repository.snapshot()?.retiredRecordingOrigins?.contains(id.origin) != true {
            try await capture.purgeRetiredRecordings(origin: id.origin)
            try await repository.acknowledgeRetiredRecordings(origin: id.origin)
        }
        try await capture.redactRemovedChild(id)
        let archive = MigrationEngine(store: LocalMigrationArchiveStore(directory: directory))
        try await archive.redactRemovedChild(id)
        try await repository.acknowledgeLocalPlayerRemoval(id)
        try await refresh()
    }

    func stageReminderUpgrade(into reminders: NativeTrialReminderStore) {
        guard !isPreview, let family = document?.primaryFamily else { return }
        let notify = family.storage["sona.notify.v1"].flatMap { try? JSONDecoder().decode(NativeTrialReminderPhoneState.self, from: Data($0.utf8)) } ?? .init()
        reminders.stageSameDeviceLegacyState(.init(notify: notify, playedDay: family.storage["sona.played.v1"]))
    }

    func movingPhonesService(for origin: LegacyOrigin) -> FamilyMovingPhonesService? {
        guard let repository, document?.primaryOrigin == origin else { return nil }
        return FamilyMovingPhonesService(repository: repository, origin: origin) { [weak self] in
            _ = try? await self?.refresh()
        }
    }

    func weeklyReportStore(for origin: LegacyOrigin) -> NativeFamilyReportStore? {
        guard document?.primaryOrigin == origin else { return nil }
        return reportStore
    }

    func flushWeeklyReportOnLeavingPractice() {
        guard let reportStore, reportStore.deliveryConnected else { return }
        Task(priority: .utility) { await reportStore.sync(trigger: .background) }
    }

    func selectPreviewPlayer(_ number: Int, sounds: [String], preferredSound: String) async throws {
        guard isPreview, number > 0, let repository, var current = try await repository.snapshot()
        else { throw NativeFamilyRuleError.invalidPreviewContainer }
        while (current.primaryFamily?.children.count ?? 0) < number {
            let child = try await repository.addChild(name: "", age: "", operationID: UUID())
            let fields: [String: Any] = ["onboarded": true, "focusSounds": sounds,
                                        "targetSound": preferredSound, "childName": ""]
            let profile = String(decoding: try JSONSerialization.data(withJSONObject: fields), as: UTF8.self)
            try await repository.updateChildKey(LegacyKeys.profile, value: profile, child: child)
            guard let next = try await repository.snapshot() else { throw NativeFamilyRuleError.playerChanged }
            current = next
        }
        guard let children = current.primaryFamily?.children, children.indices.contains(number - 1) else {
            throw NativeFamilyRuleError.playerChanged
        }
        if current.activeChild?.id != children[number - 1].id {
            try await selectChild(children[number - 1].id)
        } else {
            try await publish(current)
        }
    }

    func addChild(name: String, age: String, operationID: UUID) async throws {
        guard let repository else { throw NativeFamilyRuleError.playerChanged }
        if document?.primaryOrigin == nil { try await repository.selectOrigin(.app) }
        _ = try await repository.addChild(name: name, age: age, operationID: operationID)
        try await refresh()
    }

    func refresh() async throws {
        guard let repository, let value = try await repository.snapshot() else { throw NativeFamilyRuleError.playerChanged }
        try await publish(value)
    }

    func recordReadingPlace(_ bookmark: BookBookmark, bookID: String, owner: NativeFamilyChildID) async throws {
        guard let repository else { throw NativeFamilyRuleError.playerChanged }
        let place = NativeFamilyReadingPlace(page: bookmark.page, finished: bookmark.finished)
        try await repository.recordReadingPlace(place, bookID: bookID, owner: owner)
        try await refresh()
    }

    func applyClinicianChange(_ change: FamilyConnectionChange) async throws {
        guard let repository, change.isPreview == isPreview else { throw NativeFamilyRuleError.playerChanged }
        let json = JSONEncoder()
        try await repository.applyClinicianConnection(owner: change.child, household: change.householdValues,
            child: change.childValues, pilotPatch: json.encode(change.pilotPatch), profilePatch: json.encode(change.profilePatch))
        try await refresh()
    }

    func websiteRestoreStore(for origin: LegacyOrigin, client: (any FamilyEmailRestoreClient)? = nil) -> FamilyEmailRestoreStore {
        FamilyEmailRestoreStore(repository: repository, origin: origin, client: client) { [weak self] in
            try? await self?.refresh()
        }
    }

    func appleAccessRevision(for origin: LegacyOrigin) async throws -> UUID? {
        guard let repository else { throw NativeFamilyRuleError.playerChanged }
        return try await repository.appleAccessRevision(for: origin)
    }

    @discardableResult
    func recordAppleAccess(active: Bool, checkedAt: Date?, origin: LegacyOrigin,
                           source: NativeFamilyAppleWrite) async throws -> NativeFamilyAppleAccess {
        guard let repository else { throw NativeFamilyRuleError.playerChanged }
        let saved = try await repository.recordAppleAccess(.init(active: active, checkedAt: checkedAt), origin: origin, source: source)
        try? await refresh()
        return saved
    }

    func refreshAppleAccess() async {
        guard let origin = document?.primaryOrigin, let client = NativeStorefrontHost.makeClient(),
              !checkingApple.contains(origin) else { return }
        checkingApple.insert(origin)
        defer { checkingApple.remove(origin) }
        let revision: UUID?
        do { revision = try await appleAccessRevision(for: origin) }
        catch { return }
        let access = entitlement(for: origin)
        var grants: Set<SonaFamilyMigration.FamilyAccessGrant> = []
        if access.grants.contains(.apple) { grants.insert(.apple) }
        let continuity = FamilyPurchaseContinuity(client: client, initialAccess: FamilyAccessState(
            grants: grants, lastAppleRefresh: access.appleCheckedAt))
        let checked = await continuity.refresh()
        guard let info = checked.customerInfo, !checked.ignoredObsoleteAnswer else { return }
        _ = try? await recordAppleAccess(active: info.hasFullEntitlement, checkedAt: checked.access.lastAppleRefresh,
                                        origin: origin, source: .refresh(expectedRevision: revision))
    }

    static func scope(of id: NativeFamilyChildID) -> String { id.origin.rawValue + "|" + id.slot }

    private func rulesAccess(for origin: LegacyOrigin, in document: NativeFamilyDocument?) -> NativeFamilyRules.AccessProjection? {
        guard let document, let family = document.origins[origin.rawValue], let config = try? FamilyAccessConfiguration.bundled() else { return nil }
        var legacy = FamilyEntitlementState.legacy(family.accessEvidence(), configuration: config)
        if let website = document.websiteAccess?[origin.rawValue] { legacy.applyWebsiteAccess(website) }
        let promises = document.householdPromises
        let apple = document.appleAccess?[origin.rawValue]?.active
        let premium = !legacy.grants.subtracting([.apple]).isEmpty || (apple ?? legacy.grants.contains(.apple)) ||
            promises.founder || promises.founding || promises.grandfathered
        return .init(premium: premium, appleActive: apple, legacyBuddies: promises.keptLegacyBuddies,
                     keptFreeVersion: promises.keptFreeVersion)
    }

    func read<Value: Decodable>(_ operation: NativeFamilyRules.Operation, input: NativeRuleFields = .init(),
                               as type: Value.Type = Value.self) async throws -> Value {
        guard let child = activeID, let repository else { throw NativeFamilyRuleError.playerChanged }
        let canSell = NativeStorefrontHost.canSell
        let access = rulesAccess(for: child.origin, in: document)
        let result = try await repository.applyRules(to: child) { family in
            let result = try NativeFamilyRules.evaluate(operation, input: input, storage: family.storage, canSell: canSell, access: access)
            return NativeFamilyRuleMutation(value: result.value, changes: [:], removals: [])
        }
        return try JSONDecoder().decode(type, from: result)
    }

    func write<Value: Decodable>(_ operation: NativeFamilyRules.Operation, input: NativeRuleFields = .init(),
                                owner: NativeFamilyChildID, receipt: String? = nil, gameCompletion: String? = nil,
                                as type: Value.Type = Value.self) async throws -> Value {
        guard owner == activeID, let repository else { throw NativeFamilyRuleError.playerChanged }
        var fields = input
        if [.attempt, .rungWin, .roundReady, .gameRep, .arcadeBestOffer].contains(operation), let occurrence = NativePracticeOccurrenceScope.current {
            fields.occurredAtMilliseconds = occurrence.occurredAtMilliseconds
            fields.localDay = occurrence.localDay
            fields.timeZoneIdentifier = occurrence.timeZoneIdentifier
            fields.timezoneOffsetMinutes = occurrence.timezoneOffsetMinutes
        }
        let mutationInput = fields
        let canSell = NativeStorefrontHost.canSell
        let access = rulesAccess(for: owner.origin, in: document)
        let result = try await repository.applyRules(to: owner, receiptID: receipt, gameCompletion: gameCompletion) { family in
            let result = try NativeFamilyRules.evaluate(operation, input: mutationInput, storage: family.storage, canSell: canSell, access: access)
            return NativeFamilyRuleMutation(value: result.value, changes: result.changes, removals: result.removals)
        }
        if (operation == .attempt && (input.reps ?? 0) > 0) || (operation == .gameRep && (input.n ?? 1) > 0) {
            let occurrence = NativePracticeOccurrenceScope.current
            let date = occurrence.map { Date(timeIntervalSince1970: $0.occurredAtMilliseconds / 1_000) } ?? Date()
            let zone = occurrence.flatMap { TimeZone(identifier: $0.timeZoneIdentifier) }
                ?? occurrence.flatMap { TimeZone(secondsFromGMT: -$0.timezoneOffsetMinutes * 60) } ?? .current
            trialReminders?.countedRep(occurredAt: date, timeZone: zone)
        }
        if (operation == .attempt || operation == .gameRep), let reportStore, reportStore.deliveryConnected {
            Task(priority: .utility) { await reportStore.sync(trigger: .countedRep, for: owner.origin) }
        }
        try await refresh()
        return try JSONDecoder().decode(type, from: result)
    }

    /// A completed atomic receipt can retire only its matching local scratchpad.
    /// An onboarded profile alone does not prove that a rewalk was saved.
    func hasAcceptedFamilySetup(owner: NativeFamilyChildID, receipt: UUID) async throws -> Bool {
        guard owner == activeID, let repository else { throw NativeFamilyRuleError.playerChanged }
        let accepted = try await repository.hasAcceptedFamilySetup(to: owner, receiptID: "setup/" + receipt.uuidString)
        guard owner == activeID else { throw NativeFamilyRuleError.playerChanged }
        return accepted
    }

    /// Setup alone owns this bounded atomic child/household transaction. The
    /// generic practice writer remains strictly scoped to one child's keys.
    func completeFamilySetup(input: NativeRuleFields, consent: NativeFamilySetupConsent,
                             owner: NativeFamilyChildID, receipt: String) async throws -> NativePracticeSummary {
        guard owner == activeID, let repository else { throw NativeFamilyRuleError.playerChanged }
        let encoded = try JSONEncoder().encode(input)
        let canSell = NativeStorefrontHost.canSell
        let access = rulesAccess(for: owner.origin, in: document)
        let data: Data
        do {
            data = try await repository.applyFamilySetup(to: owner, receiptID: receipt, input: encoded, consent: consent) { family in
                let result = try NativeFamilyRules.evaluate(.completeSetup, input: input, storage: family.storage,
                                                            canSell: canSell, access: access)
                return NativeFamilyRuleMutation(value: result.value, changes: result.changes, removals: result.removals)
            }
        } catch NativeFamilyRuleError.replayed {
            try await refresh()
            reportStore?.setupCommitted(for: owner.origin)
            throw NativeFamilyRuleError.replayed
        }
        try await refresh()
        reportStore?.setupCommitted(for: owner.origin)
        return try JSONDecoder().decode(NativePracticeSummary.self, from: data)
    }

    private func publish(_ new: NativeFamilyDocument) async throws {
        publishGeneration &+= 1
        let generation = publishGeneration
        guard let owner = new.activeChild?.id, let repository else {
            document = new
            summary = nil
            stage = new.requiresPrimaryOriginSelection ? .chooseOrigin : .needsSetup
            return
        }
        let canSell = NativeStorefrontHost.canSell
        let access = rulesAccess(for: owner.origin, in: new)
        let data = try await repository.applyRules(to: owner) { family in
            let result = try NativeFamilyRules.evaluate(.ensureCalendar, input: NativeRuleFields(), storage: family.storage, canSell: canSell, access: access)
            let calendar = "sona.quest.v1" + (owner.slot.isEmpty ? "" : "@" + owner.slot)
            return NativeFamilyRuleMutation(value: result.value, changes: result.changes.filter { $0.key == calendar }, removals: [])
        }
        guard let current = try await repository.snapshot(), current.activeChild?.id == owner,
              generation == publishGeneration else { return }
        document = current
        summary = try JSONDecoder().decode(NativePracticeSummary.self, from: data)
        stage = .ready
    }
}

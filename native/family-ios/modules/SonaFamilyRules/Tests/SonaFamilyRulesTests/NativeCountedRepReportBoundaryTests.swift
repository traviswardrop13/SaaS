import Foundation
import XCTest
@testable import SonaFamilyRules
@testable import SonaFamilyMigration

private final class CountedRepDisk: NativeFamilyDocumentStore, @unchecked Sendable {
    var value: NativeFamilyDocument?
    func read() throws -> NativeFamilyDocument? { value }
    func commit(_ document: NativeFamilyDocument) throws { value = document }
}

final class NativeCountedRepReportBoundaryTests: XCTestCase {
    private let owner = NativeFamilyChildID(origin: .www, slot: "")
    private let email = "fictional-report@example.invalid"
    private let oldEmail = "fictional-removed@example.invalid"
    private let dev = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    private let primaryReportID = "aaaaaaaaaaaaaaaa"
    private let access = NativeFamilyRules.AccessProjection(premium: true, appleActive: nil,
                                                           legacyBuddies: false, keptFreeVersion: true)
    private struct Attempt: Encodable, Sendable {
        let sound = "S", word = "s", level = "isolation", pos = ""
        let pass = true, reps = 3
    }

    private func object(_ raw: String?) throws -> [String: Any] {
        try object(Data(try XCTUnwrap(raw).utf8))
    }
    private func object(_ bytes: Data) throws -> [String: Any] {
        try XCTUnwrap(JSONSerialization.jsonObject(with: bytes) as? [String: Any])
    }
    private func seeded(owedOff: Bool = false) async throws -> (CountedRepDisk, NativeFamilyRepository) {
        let disk = CountedRepDisk(), repo = NativeFamilyRepository(store: disk)
        let report: [String: Any] = ["dev": dev, "at": 0, "onFor": email,
            "offs": owedOff ? [["e": oldEmail, "d": dev]] : []]
        let storage = [
            "sona.profile.v1": #"{"childName":"Private Fictional A","onboarded":true,"focusSounds":["S"],"dailyGoal":1,"weeklyReport":true,"email":"fictional-report@example.invalid","reportId":"aaaaaaaaaaaaaaaa"}"#,
            // A sibling with no reportId is intentional: a child save must not
            // create one on its behalf. The native household owner may do so.
            "sona.profile.v1@k2": #"{"childName":"Private Fictional B","onboarded":true,"focusSounds":["L"],"weeklyReport":false,"email":"fictional-sibling@example.invalid","unknown":"keep"}"#,
            "sona.kids.v1": #"{"active":"","hi":7,"list":[{"slot":""},{"slot":"k2"}]}"#,
            "sona.report.v1": String(decoding: try JSONSerialization.data(withJSONObject: report, options: [.sortedKeys]), as: UTF8.self),
            "sona.sdk.synthetic": "unchanged local sentinel",
            "sona.freeera.v1": "post", "sona.freeera2.v1": "done", "sona.freeera3.v1": "done",
            "sona.freeera4.v1": "done", "sona.freeera5.v1": "done",
            "sona.buddyset.v1": "post", "sona.freever.v1": "post"
        ]
        var archive = MigrationArchive()
        for origin in LegacyOrigin.allCases {
            archive.origins[origin.rawValue] = try SnapshotImporter.prepare(.init(origin: origin, storage: origin == .www ? storage : [:]))
        }
        _ = try await repo.seed(from: archive, primaryOrigin: .www)
        let access = self.access
        _ = try await repo.applyRules(to: owner) { family in
            let out = try NativeFamilyRules.evaluate(.ensureCalendar, input: [String: String](), storage: family.storage, access: access)
            return .init(value: out.value, changes: out.changes, removals: out.removals)
        }
        return (disk, repo)
    }
    private func count(_ repo: NativeFamilyRepository) async throws {
        let access = self.access
        _ = try await repo.applyRules(to: owner, receiptID: "accepted-practice") { family in
            let out = try NativeFamilyRules.evaluate(.attempt, input: Attempt(), storage: family.storage, access: access)
            return .init(value: out.value, changes: out.changes, removals: out.removals)
        }
        // Native speech games and an accepted book speech moment both call
        // .gameRep, with separate receipt IDs. A book-completion tap is not speech.
        for (receipt, sound) in [("accepted-game", "S"), ("accepted-book-speech", "L")] {
            _ = try await repo.applyRules(to: owner, receiptID: receipt) { family in
                let out = try NativeFamilyRules.evaluate(.gameRep, input: ["sound": sound], storage: family.storage, access: access)
                return .init(value: out.value, changes: out.changes, removals: out.removals)
            }
        }
    }
    private static func policy(_ family: NativeFamilyOrigin, _ action: NativeFamilyReportAction,
                               now: Date) throws -> NativeFamilyReportMutation {
        let op: NativeWeeklyReportPolicy.Action
        let removed: String?, signup: String?
        switch action {
        case .flush: op = .flush; removed = nil; signup = nil
        case .sync: op = .sync; removed = nil; signup = nil
        case .queueOff(let email): op = .queueOff; removed = email; signup = nil
        case .queueOn(let email): op = .queueOn; removed = nil; signup = email
        }
        let out = try NativeWeeklyReportPolicy.prepare(storage: family.storage,
            profileKeys: family.children.map { NativeFamilyOrigin.key(LegacyKeys.profile, $0.id.slot) },
            action: op, force: false, now: now, removedEmail: removed, signupEmail: signup)
        return .init(reportState: out.reportState, profilePatches: out.profilePatches, body: out.body, context: out.context)
    }
    private func prepare(_ repo: NativeFamilyRepository, now: Date) async throws -> NativeFamilyReportPacket {
        let packet = try await repo.prepareWeeklyReport(origin: .www, now: now) { family, action in
            try Self.policy(family, action, now: now)
        }
        return try XCTUnwrap(packet)
    }
    private func assertAnonymousCounts(_ packet: NativeFamilyReportPacket) throws {
        let body = try object(packet.body)
        XCTAssertEqual(body["dev"] as? String, dev)
        XCTAssertEqual(body["email"] as? String, email)
        let weeks = try XCTUnwrap(body["weeks"] as? [[String: Any]])
        let kids = try XCTUnwrap(weeks.last?["kids"] as? [[String: Any]])
        XCTAssertEqual(kids.count, 2)
        XCTAssertEqual(kids[0]["i"] as? String, primaryReportID)
        XCTAssertEqual(kids[0]["r"] as? Int, 5)
        XCTAssertEqual(kids[0]["p"] as? Int, 3)
        XCTAssertEqual(Set(kids[0]["s"] as? [String] ?? []), ["S", "L"])
        XCTAssertEqual(kids[0]["g"] as? Int, 1)
        XCTAssertEqual(kids[1]["r"] as? Int, 0)
        XCTAssertEqual(kids[1]["p"] as? Int, 0)
        let siblingID = try XCTUnwrap(kids[1]["i"] as? String)
        XCTAssertNotEqual(siblingID, primaryReportID)
        XCTAssertNotNil(siblingID.range(of: "^[a-f0-9]{16}$", options: .regularExpression))
        for child in kids { XCTAssertTrue(Set(child.keys).isSubset(of: ["i", "d", "g", "r", "p", "s", "gw"])) }
        XCTAssertFalse(String(decoding: packet.body, as: UTF8.self).contains("Private Fictional"))
        XCTAssertFalse(String(decoding: packet.body, as: UTF8.self).contains("fictional-sibling"))
    }

    func testConsentedPracticeGameAndBookSpeechCommitBeforeNativeReportOwnerPreparesPacket() async throws {
        let (disk, repo) = try await seeded()
        let before = try XCTUnwrap(disk.value), original = try XCTUnwrap(before.primaryFamily)
        try await count(repo)
        let counted = try XCTUnwrap(disk.value), storage = try XCTUnwrap(counted.primaryFamily).storage
        XCTAssertEqual(storage["sona.report.v1"], original.storage["sona.report.v1"])
        XCTAssertEqual(storage["sona.profile.v1@k2"], original.storage["sona.profile.v1@k2"])
        XCTAssertEqual(storage["sona.sdk.synthetic"], original.storage["sona.sdk.synthetic"])
        XCTAssertEqual(storage["sona.kids.v1"], original.storage["sona.kids.v1"])
        XCTAssertEqual(counted.sourceFingerprints, before.sourceFingerprints)
        XCTAssertEqual(counted.householdPromises, before.householdPromises)
        XCTAssertEqual(counted.ruleReceipts?.count, 3)
        XCTAssertNil(try object(storage["sona.profile.v1@k2"])["reportId"])
        let packet = try await prepare(repo, now: Date())
        try assertAnonymousCounts(packet)
        let after = try XCTUnwrap(disk.value), family = try XCTUnwrap(after.primaryFamily)
        var sibling = try object(family.storage["sona.profile.v1@k2"])
        sibling.removeValue(forKey: "reportId")
        XCTAssertEqual(NSDictionary(dictionary: sibling), NSDictionary(dictionary: try object(original.storage["sona.profile.v1@k2"])))
        XCTAssertEqual(after.activeChild?.id, owner)
        XCTAssertEqual(family.slotHighWaterMark, 7)
        // Fresh repository after a relaunch retains the exact prepared packet.
        let relaunched = NativeFamilyRepository(store: disk)
        let replay = try await prepare(relaunched, now: Date())
        XCTAssertEqual(replay, packet)
    }

    func testAcceptedSpeechKeepsOwedOffAndNativeOwnerSendsItBeforeAnyNumbers() async throws {
        let (disk, repo) = try await seeded(owedOff: true)
        let before = try XCTUnwrap(disk.value?.primaryFamily?.storage["sona.report.v1"])
        try await count(repo)
        XCTAssertEqual(disk.value?.primaryFamily?.storage["sona.report.v1"], before)
        let now = Date(), packet = try await prepare(repo, now: now), body = try object(packet.body)
        XCTAssertEqual(body["off"] as? Bool, true)
        XCTAssertEqual(body["email"] as? String, oldEmail)
        XCTAssertEqual(body["dev"] as? String, dev)
        XCTAssertTrue((body["weeks"] as? [[String: Any]] ?? []).allSatisfy { ($0["kids"] as? [Any])?.isEmpty == true })
        let pending = try object(disk.value?.primaryFamily?.storage["sona.report.v1"])
        XCTAssertEqual((pending["offs"] as? [[String: Any]])?.first?["e"] as? String, oldEmail)
        // A synthetic acknowledgement exercises policy only; no transport exists.
        try await repo.acknowledgeWeeklyReport(packet) { family in
            let out = try NativeWeeklyReportPolicy.acknowledge(storage: family.storage,
                profileKeys: family.children.map { NativeFamilyOrigin.key(LegacyKeys.profile, $0.id.slot) },
                context: packet.context, response: Data(#"{"ok":true}"#.utf8), now: now)
            return .init(reportState: out.reportState, profilePatches: out.profilePatches)
        }
        let current = try await prepare(repo, now: now.addingTimeInterval(1))
        try assertAnonymousCounts(current)
    }

    func testGenericChildBoundaryStillRejectsHouseholdReportOrGrantInjection() async throws {
        let (disk, repo) = try await seeded()
        for key in ["sona.report.v1", "sona.sub.v1", "sona.profile.v1@k2"] {
            let before = disk.value
            do {
                _ = try await repo.applyRules(to: owner) { _ in
                    .init(value: Data("null".utf8), changes: [key: "{}"], removals: [])
                }
                XCTFail("Rejected household or sibling mutation unexpectedly committed")
            } catch NativeFamilyRuleError.invalidKey {}
            XCTAssertEqual(disk.value, before)
        }
    }

    func testEachConsentedSpeechEntryPointCommitsIndependently() async throws {
        let access = self.access
        for (label, operation) in [("practice", NativeFamilyRules.Operation.attempt),
                                    ("game", .gameRep), ("book-speech", .gameRep)] {
            let (disk, repo) = try await seeded()
            let original = try XCTUnwrap(disk.value?.primaryFamily)
            do {
                _ = try await repo.applyRules(to: owner, receiptID: label) { family in
                    let out: NativeFamilyRules.Outcome
                    if operation == .attempt {
                        out = try NativeFamilyRules.evaluate(operation, input: Attempt(), storage: family.storage, access: access)
                    } else {
                        out = try NativeFamilyRules.evaluate(operation, input: ["sound": "S"], storage: family.storage, access: access)
                    }
                    return .init(value: out.value, changes: out.changes, removals: out.removals)
                }
            } catch {
                XCTFail("Accepted \(label) speech was rejected: \(error)")
            }
            let after = try XCTUnwrap(disk.value?.primaryFamily)
            let summary = try NativeFamilyRules.evaluate(.summary, input: [String: String](), storage: after.storage, access: access)
            XCTAssertEqual(try object(summary.value)["weekReps"] as? Int, operation == .attempt ? 3 : 1, label)
            XCTAssertEqual(after.storage["sona.report.v1"], original.storage["sona.report.v1"])
            XCTAssertEqual(after.storage["sona.profile.v1@k2"], original.storage["sona.profile.v1@k2"])
        }
    }
}

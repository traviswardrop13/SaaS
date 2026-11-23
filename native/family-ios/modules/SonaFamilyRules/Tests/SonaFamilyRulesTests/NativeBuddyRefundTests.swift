import Foundation
import JavaScriptCore
import XCTest
@testable import SonaFamilyRules
@testable import SonaFamilyMigration

private final class RefundDisk: NativeFamilyDocumentStore, @unchecked Sendable {
    var value: NativeFamilyDocument?
    var failBefore = false, failAfter = false
    enum Failure: Error { case write, acknowledgement }
    func read() throws -> NativeFamilyDocument? { value }
    func commit(_ document: NativeFamilyDocument) throws {
        if failBefore { throw Failure.write }; value = document
        if failAfter { throw Failure.acknowledgement }
    }
}
final class NativeBuddyRefundTests: XCTestCase {
    private let epoch = 1_800_000_000_000.0
    private var storage: [String:String] {
        ["sona.profile.v1": #"{"childName":"Fictional A","onboarded":true,"outfit":"none","owned":{"characters":["fox","bunny"],"outfits":["none"],"backdrops":["sky"]}}"#,
         "sona.progress.v1": #"{"totals":{"coins":500}}"#, "sona.buddyset.v1":"post", "sona.freever.v1":"post",
         "sona.freeera.v1":"post", "sona.freeera2.v1":"done", "sona.freeera3.v1":"done", "sona.freeera4.v1":"done", "sona.freeera5.v1":"done"]
    }
    private struct Result { let value: [String:Any]; let changes:[String:String]; let removals:[String] }
    private func run(_ operation: String, _ storage: [String:String], now: Double, input: [String:Any] = [:]) throws -> Result {
        let module = URL(fileURLWithPath:#filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        let rules = module.appendingPathComponent("Sources/SonaFamilyRules/Rules")
        let context = try XCTUnwrap(JSContext()); var exception = false
        context.exceptionHandler = { _,_ in exception = true }; defer { context.exceptionHandler = nil }
        context.evaluateScript(try String(contentsOf: rules.appendingPathComponent("host.js")))
        let environment = String(decoding:try JSONSerialization.data(withJSONObject:["storage":storage,"canSell":false]),as:UTF8.self)
        context.objectForKeyedSubscript("nativeInstall").call(withArguments:[environment])
        context.evaluateScript("Date.now = function () { return \(now); };")
        context.evaluateScript(try String(contentsOf:rules.appendingPathComponent("sona.js")))
        let command = String(decoding:try JSONSerialization.data(withJSONObject:["operation":operation,"input":input]),as:UTF8.self)
        let raw = context.objectForKeyedSubscript("nativeRun").call(withArguments:[command])
        guard !exception, let text = raw?.toString(), let bytes = text.data(using:.utf8),
              let envelope = try JSONSerialization.jsonObject(with:bytes) as? [String:Any],
              let changed = envelope["changed"] as? [String:String], let removed = envelope["removed"] as? [String]
        else { throw NativeFamilyBackupError.invalidRuleResult }
        return .init(value:envelope["result"] as? [String:Any] ?? [:],changes:changed,removals:removed)
    }
    private func apply(_ result:Result,to storage:inout [String:String]) { storage.merge(result.changes){_,new in new};for key in result.removals{storage.removeValue(forKey:key)} }
    private func shop(_ result:Result) -> [String:Any] { result.value["shop"] as? [String:Any] ?? result.value }
    private func profile(_ storage:[String:String],key:String="sona.profile.v1") throws -> [String:Any] {
        try XCTUnwrap(try JSONSerialization.jsonObject(with:Data(storage[key]!.utf8)) as? [String:Any])
    }
    private func setProfile(_ profile:[String:Any],storage:inout [String:String]) throws {
        storage["sona.profile.v1"] = String(decoding:try JSONSerialization.data(withJSONObject:profile),as:UTF8.self)
    }
    func testNativeOperationExistsAndCanonicalBuyRefundRestoresOnlyOnce() throws {
        XCTAssertNotNil(NativeFamilyRules.Operation(rawValue:"undoBuy"))
        var raw = storage
        let before = try run("shop",raw,now:epoch), bought = try run("buy",raw,now:epoch,input:["kind":"outfits","id":"crown"])
        XCTAssertEqual(bought.value["accepted"] as? Bool,true)
        XCTAssertEqual(shop(bought)["refundUntil"] as? Double,epoch+10_000)
        apply(bought,to:&raw)
        XCTAssertNotNil(try profile(raw)["lastBuy"])
        // A fresh rules context at another time uses the persisted purchase time.
        XCTAssertEqual(try run("shop",raw,now:epoch+5_000).value["refundUntil"] as? Double,epoch+10_000)
        let refunded = try run("undoBuy",raw,now:epoch+10_000)
        XCTAssertEqual(refunded.value["accepted"] as? Bool,true)
        XCTAssertEqual(shop(refunded)["coins"] as? Int,before.value["coins"] as? Int)
        apply(refunded,to:&raw)
        XCTAssertTrue(try profile(raw)["lastBuy"] is NSNull)
        XCTAssertEqual(try profile(raw)["outfit"] as? String,"none")
        let second = try run("undoBuy",raw,now:epoch+10_000)
        XCTAssertEqual(second.value["accepted"] as? Bool,false)
        XCTAssertTrue(second.changes.isEmpty)
    }
    func testExpiredOrFuturePurchaseNeverRefundsAndNoTimerRenewal() throws {
        var raw = storage;apply(try run("buy",raw,now:epoch,input:["kind":"outfits","id":"crown"]),to:&raw)
        for now in [epoch-1,epoch+10_001] {
            let read = try run("shop",raw,now:now)
            XCTAssertTrue(read.value["refundUntil"] is NSNull)
            let denied = try run("undoBuy",raw,now:now)
            XCTAssertEqual(denied.value["accepted"] as? Bool,false);XCTAssertTrue(denied.changes.isEmpty)
        }
    }
    func testForgedSavedCostIsCappedByCanonicalCatalogAndInvalidItemCannotMintCoins() throws {
        var raw = storage;let original = try run("shop",raw,now:epoch).value["coins"] as? Int
        apply(try run("buy",raw,now:epoch,input:["kind":"outfits","id":"crown"]),to:&raw)
        var person = try profile(raw), last = try XCTUnwrap(person["lastBuy"] as? [String:Any]);last["cost"]=99_999;person["lastBuy"]=last;try setProfile(person,storage:&raw)
        let refunded = try run("undoBuy",raw,now:epoch+1)
        XCTAssertEqual(shop(refunded)["coins"] as? Int,original)
        apply(refunded,to:&raw)
        person = try profile(raw);person["lastBuy"]=["kind":"characters","id":"unicorn","at":epoch,"cost":9_000_000];try setProfile(person,storage:&raw)
        let denied = try run("undoBuy",raw,now:epoch+2)
        XCTAssertEqual(denied.value["accepted"] as? Bool,false);XCTAssertEqual(shop(denied)["coins"] as? Int,original)
    }
    func testSiblingCannotRefundAnotherChildsPurchase() throws {
        var raw = storage;raw["sona.profile.v1@k2"]=raw["sona.profile.v1"]
        raw["sona.progress.v1@k2"] = #"{"totals":{"coins":3}}"#
        raw["sona.kids.v1"] = #"{"active":"","hi":2,"list":[{"slot":""},{"slot":"k2"}]}"#
        apply(try run("buy",raw,now:epoch,input:["kind":"outfits","id":"crown"]),to:&raw)
        let original = raw["sona.profile.v1"]
        raw["sona.kids.v1"] = #"{"active":"k2","hi":2,"list":[{"slot":""},{"slot":"k2"}]}"#
        let denied = try run("undoBuy",raw,now:epoch+1)
        XCTAssertEqual(denied.value["accepted"] as? Bool,false);XCTAssertFalse(denied.changes.keys.contains("sona.profile.v1"))
        XCTAssertEqual(raw["sona.profile.v1"],original)
    }
    func testPublicRulesUsesCanonicalRefundAction() throws {
        var raw = storage
        let bought = try NativeFamilyRules.evaluate(.buy,input:["kind":"outfits","id":"crown"],storage:raw)
        raw.merge(bought.changes){_,new in new}
        let operation = try XCTUnwrap(NativeFamilyRules.Operation(rawValue:"undoBuy"))
        let undone = try NativeFamilyRules.evaluate(operation,input:[String:String](),storage:raw)
        let result = try XCTUnwrap(try JSONSerialization.jsonObject(with:undone.value) as? [String:Any])
        XCTAssertEqual(result["accepted"] as? Bool,true)
    }
    func testAtomicReceiptRetryCannotBuyOrRefundTwiceAndCannotCrossChild() async throws {
        let disk = RefundDisk(), repository = NativeFamilyRepository(store:disk)
        var archive = MigrationArchive(), raw = storage
        raw["sona.profile.v1@k2"]=raw["sona.profile.v1"];raw["sona.kids.v1"] = #"{"active":"","hi":2,"list":[{"slot":""},{"slot":"k2"}]}"#
        for origin in LegacyOrigin.allCases { archive.origins[origin.rawValue] = try SnapshotImporter.prepare(.init(origin:origin,storage:origin == .www ? raw : [:])) }
        _ = try await repository.seed(from:archive,primaryOrigin:.www)
        let owner = NativeFamilyChildID(origin:.www,slot:"")
        let buy = { @Sendable (family:NativeFamilyOrigin) throws -> NativeFamilyRuleMutation in
            let value = try NativeFamilyRules.evaluate(.buy,input:["kind":"outfits","id":"crown"],storage:family.storage)
            return .init(value:value.value,changes:value.changes,removals:value.removals)
        }
        disk.failBefore=true
        do { _=try await repository.applyRules(to:owner,receiptID:"stable-buy",buy);XCTFail("write failed") } catch {}
        disk.failBefore=false;disk.failAfter=true
        do { _=try await repository.applyRules(to:owner,receiptID:"stable-buy",buy);XCTFail("ack failed") } catch {}
        disk.failAfter=false;let saved=disk.value
        do { _=try await repository.applyRules(to:owner,receiptID:"stable-buy"){_ in XCTFail("buy replayed");throw NativeFamilyRuleError.replayed};XCTFail("receipt accepted twice") } catch NativeFamilyRuleError.replayed {}
        XCTAssertEqual(disk.value,saved)
        let operation = try XCTUnwrap(NativeFamilyRules.Operation(rawValue:"undoBuy"))
        let refund = { @Sendable (family:NativeFamilyOrigin) throws -> NativeFamilyRuleMutation in
            let value=try NativeFamilyRules.evaluate(operation,input:[String:String](),storage:family.storage)
            return .init(value:value.value,changes:value.changes,removals:value.removals)
        }
        disk.failAfter=true
        do { _=try await repository.applyRules(to:owner,receiptID:"stable-refund",refund);XCTFail("ack failed") } catch {}
        disk.failAfter=false;let refunded=disk.value
        do { _=try await repository.applyRules(to:owner,receiptID:"stable-refund",refund);XCTFail("refund receipt replayed") } catch NativeFamilyRuleError.replayed {}
        XCTAssertEqual(disk.value,refunded)
        try await repository.switchChild(.init(origin:.www,slot:"k2"));let sibling=disk.value
        do { _=try await repository.applyRules(to:owner,receiptID:"wrong-child",refund);XCTFail("cross-child refund") } catch NativeFamilyRuleError.playerChanged {}
        XCTAssertEqual(disk.value,sibling)
    }
    func testConsentedReportQueueRemainsVisibleToTheStrictBoundary() throws {
        var raw = storage, person = try profile(raw)
        person["dailyGoal"] = 1; person["weeklyReport"] = true
        person["email"] = "fictional@example.invalid"; person["reportId"] = "aaaaaaaaaaaaaaaa"
        try setProfile(person, storage: &raw)
        raw["sona.report.v1"] = #"{"dev":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","at":0,"offs":[]}"#
        let result = try run("attempt", raw, now: epoch, input: ["sound":"S", "word":"s", "level":"isolation", "pos":"", "pass":true, "reps":3])
        XCTAssertNil(result.changes["sona.fid.v1"]); XCTAssertNil(result.changes["sona.played.v1"])
        // The separate native report adapter may own this queue instead. Never
        // silently permit any other household write through this child action.
        XCTAssertTrue(Set(result.changes.keys.filter { !LegacyKeys.perChild.contains($0) }).isSubset(of: ["sona.report.v1"]))
        print("SYNTHETIC REPORT PROBE HOUSEHOLD KEYS", result.changes.keys.filter { !LegacyKeys.perChild.contains($0) }.sorted())
    }

    func testFreshPracticeGameBookAndStoryTransactionsCommitWithoutTelemetryIdentity() async throws {
        for name in ["attempt", "gameRep", "bookRead", "questFinish"] {
            let disk = RefundDisk(), repository = NativeFamilyRepository(store: disk)
            var raw = storage, person = try profile(raw)
            person["dailyGoal"] = 1; person["focusSounds"] = ["S"]; person["targetSound"] = "S"
            try setProfile(person, storage: &raw)
            var archive = MigrationArchive()
            for origin in LegacyOrigin.allCases { archive.origins[origin.rawValue] = try SnapshotImporter.prepare(.init(origin: origin, storage: origin == .www ? raw : [:])) }
            _ = try await repository.seed(from: archive, primaryOrigin: .www)
            let owner = NativeFamilyChildID(origin: .www, slot: "")
            let access = NativeFamilyRules.AccessProjection(premium: true, appleActive: nil, legacyBuddies: false, keptFreeVersion: true)
            _ = try await repository.applyRules(to: owner) { family in
                let result = try NativeFamilyRules.evaluate(.ensureCalendar, input: [String:String](), storage: family.storage, access: access)
                return .init(value: result.value, changes: result.changes, removals: result.removals)
            }
            let before = try XCTUnwrap(disk.value).primaryFamily!.storage
            let operation = try XCTUnwrap(NativeFamilyRules.Operation(rawValue: name))
            var fields: [String: Any] = [:]
            switch name {
            case "attempt": fields = ["sound":"S", "word":"s", "level":"isolation", "pos":"", "pass":true, "reps":3]
            case "gameRep": fields = ["sound":"S"]
            case "bookRead": fields = ["title":"Fictional book"]
            default:
                let summary = try NativeFamilyRules.evaluate(.summary, input: [String:String](), storage: before, access: access)
                let value = try XCTUnwrap(try JSONSerialization.jsonObject(with: summary.value) as? [String:Any])
                let quest = try XCTUnwrap(value["quest"] as? [String:Any]); fields = ["game":try XCTUnwrap(quest["game"] as? String)]
            }
            let bytes = try JSONSerialization.data(withJSONObject: fields)
            struct Arguments: Encodable { let value: Data
                func encode(to encoder: Encoder) throws {
                    let object = try JSONSerialization.jsonObject(with: value)
                    let data = try JSONSerialization.data(withJSONObject: object)
                    let decoded = try JSONDecoder().decode([String: JSONField].self, from: data)
                    try decoded.encode(to: encoder)
                }
            }
            let arguments = Arguments(value: bytes)
            _ = try await repository.applyRules(to: owner, receiptID: "fresh-" + name) { family in
                let result = try NativeFamilyRules.evaluate(operation, input: arguments, storage: family.storage, access: access)
                return .init(value: result.value, changes: result.changes, removals: result.removals)
            }
            let after = try XCTUnwrap(disk.value).primaryFamily!.storage
            XCTAssertNil(after["sona.fid.v1"], name); XCTAssertNil(after["sona.played.v1"], name)
            XCTAssertNotEqual(after, before, "accepted " + name + " must commit its child ledger")
        }
    }

}

private enum JSONField: Codable, Sendable {
    case text(String), number(Double), bool(Bool)
    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let value = try? c.decode(Bool.self) { self = .bool(value) }
        else if let value = try? c.decode(Double.self) { self = .number(value) }
        else { self = .text(try c.decode(String.self)) }
    }
    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self { case .text(let v): try c.encode(v); case .number(let v): try c.encode(v); case .bool(let v): try c.encode(v) }
    }
}

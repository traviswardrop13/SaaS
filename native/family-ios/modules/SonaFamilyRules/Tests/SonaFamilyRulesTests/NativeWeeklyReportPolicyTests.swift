import Foundation
import XCTest
@testable import SonaFamilyRules

final class NativeWeeklyReportPolicyTests: XCTestCase {
    let now = Date(timeIntervalSince1970: 1_795_110_000)
    let dev = "0123456789abcdef0123456789abcdef"
    var family: [String: String] {
        ["sona.profile.v1": #"{"childName":"Private name","childAge":"6","onboarded":true,"focusSounds":["R"],"weeklyReport":true,"email":"synthetic@example.invalid","reportId":"0123456789abcdef"}"#,
         "sona.profile.v1@k2": #"{"childName":"Private sibling","onboarded":true,"focusSounds":["S"],"reportId":"fedcba9876543210","weeklyGoal":5}"#,
         "sona.kids.v1": #"{"list":[{"slot":""},{"slot":"k2"}],"active":"k2","hi":2}"#,
         "sona.report.v1": "{\"dev\":\"\(dev)\",\"onFor\":\"synthetic@example.invalid\"}",
         "sona.freeera.v1":"post","sona.freeera2.v1":"done","sona.freeera3.v1":"done","sona.freeera4.v1":"done","sona.freeera5.v1":"done"]
    }
    let keys = ["sona.profile.v1", "sona.profile.v1@k2"]
    func object(_ data: Data?) throws -> [String: Any] { try XCTUnwrap(JSONSerialization.jsonObject(with: XCTUnwrap(data)) as? [String: Any]) }
    func applied(_ p: NativeWeeklyReportPolicy.Projection, to original: [String: String]) throws -> [String: String] {
        var out = original; out["sona.report.v1"] = p.reportState
        for (key, raw) in p.profilePatches {
            var profile = try object(Data(out[key]!.utf8)); profile.merge(try object(Data(raw.utf8))) { _, new in new }
            out[key] = String(decoding: try JSONSerialization.data(withJSONObject: profile), as: UTF8.self)
        }
        return out
    }
    func testExactRequestIsHouseholdAnonymousAndKeepsIdentity() throws {
        let p = try NativeWeeklyReportPolicy.prepare(storage: family, profileKeys: keys, action: .sync, force: false, now: now)
        let body = try object(p.body)
        XCTAssertEqual(body["dev"] as? String, dev)
        XCTAssertNil(body["on"])
        XCTAssertEqual(Set(body.keys), ["dev", "email", "weeks"])
        let weeks = try XCTUnwrap(body["weeks"] as? [[String: Any]])
        XCTAssertEqual(weeks.count, 2)
        for week in weeks {
            let kids = try XCTUnwrap(week["kids"] as? [[String: Any]])
            XCTAssertEqual(kids.count, 2)
            XCTAssertEqual(kids[0]["i"] as? String, "0123456789abcdef")
            XCTAssertNil(kids[0]["gw"]); XCTAssertEqual(kids[1]["gw"] as? Int, 5)
            XCTAssertTrue(kids.allSatisfy { Set($0.keys).isSubset(of: ["i","d","g","r","p","s","gw"]) })
        }
        XCTAssertFalse(String(decoding: p.body!, as: UTF8.self).contains("Private"))
    }
    func testConsentMustBeLiteralAndEmailValid() throws {
        for fields in [#""weeklyEmail":true,"email":"synthetic@example.invalid""#,
                       #""weeklyReport":1,"email":"synthetic@example.invalid""#,
                       #""weeklyReport":true,"email":"bad address""#] {
            var storage = family; storage[keys[0]] = "{\"onboarded\":true," + fields + "}"
            let p = try NativeWeeklyReportPolicy.prepare(storage: storage, profileKeys: keys, action: .sync, force: true, now: now)
            XCTAssertNil(p.body)
        }
    }
    func testActivationIsAcknowledgedAndOrdinarySendThrottled() throws {
        var storage = family; storage["sona.report.v1"] = "{\"dev\":\"\(dev)\"}"
        let p = try NativeWeeklyReportPolicy.prepare(storage: storage, profileKeys: keys, action: .sync, force: true, now: now)
        XCTAssertEqual(try object(p.body)["on"] as? Bool, true)
        storage = try applied(p, to: storage)
        let ack = try NativeWeeklyReportPolicy.acknowledge(storage: storage, profileKeys: keys, context: XCTUnwrap(p.context),
            response: Data(#"{"ok":true,"pending":true}"#.utf8), now: now)
        storage = try applied(ack, to: storage)
        XCTAssertEqual(try object(Data(storage["sona.report.v1"]!.utf8))["onFor"] as? String, "synthetic@example.invalid")
        let next = try NativeWeeklyReportPolicy.prepare(storage: storage, profileKeys: keys, action: .sync, force: false, now: now.addingTimeInterval(60))
        XCTAssertNil(next.body)
        XCTAssertEqual(try object(ack.status)["pending"] as? Bool, true)
    }
    func testOffQueueIsDurableAndHasNoNumbersUntilAck() throws {
        let queued = try NativeWeeklyReportPolicy.prepare(storage: family, profileKeys: keys, action: .queueOff, force: true, now: now)
        XCTAssertNil(queued.body)
        var storage = try applied(queued, to: family)
        XCTAssertEqual(try object(queued.status)["on"] as? Bool, false)
        let p = try NativeWeeklyReportPolicy.prepare(storage: storage, profileKeys: keys, action: .flush, force: true, now: now)
        let body = try object(p.body)
        XCTAssertEqual(body["off"] as? Bool, true); XCTAssertEqual(body["quiet"] as? Bool, true)
        XCTAssertTrue((body["weeks"] as! [[String: Any]]).allSatisfy { ($0["kids"] as? [Any])?.isEmpty == true })
        storage = try applied(p, to: storage)
        let failed = try NativeWeeklyReportPolicy.acknowledge(storage: storage, profileKeys: keys, context: XCTUnwrap(p.context), response: nil, now: now)
        XCTAssertEqual(try object(failed.status)["owed"] as? Bool, true)
        let ack = try NativeWeeklyReportPolicy.acknowledge(storage: storage, profileKeys: keys, context: XCTUnwrap(p.context), response: Data(#"{"ok":true}"#.utf8), now: now)
        XCTAssertEqual(try object(ack.status)["owed"] as? Bool, false)
    }
    func testPendingAndOffSchedulesKeepQuietChecksAnonymous() throws {
        let day = 86_400.0, ms = now.timeIntervalSince1970 * 1_000
        var storage = family
        storage["sona.report.v1"] = "{\"dev\":\"\(dev)\",\"onFor\":\"synthetic@example.invalid\",\"pendFor\":\"synthetic@example.invalid\",\"pend\":\(ms-15*day*1_000),\"at\":\(ms-3_600_000)}"
        let slow = try NativeWeeklyReportPolicy.prepare(storage: storage, profileKeys: keys, action: .sync, force: false, now: now)
        XCTAssertNil(slow.body)
        let looked = try NativeWeeklyReportPolicy.prepare(storage: storage, profileKeys: keys, action: .sync, force: true, now: now)
        XCTAssertNotNil(looked.body) // An adult explicitly rechecking pending.
        for field in ["off", "gaveUp"] {
            storage["sona.report.v1"] = "{\"dev\":\"\(dev)\",\"onFor\":\"synthetic@example.invalid\",\"\(field)\":\"synthetic@example.invalid\",\"at\":\(ms-31*day*1_000)}"
            let p = try NativeWeeklyReportPolicy.prepare(storage: storage, profileKeys: keys, action: .sync, force: true, now: now)
            let body = try object(p.body)
            XCTAssertTrue((body["weeks"] as! [[String: Any]]).allSatisfy { ($0["kids"] as? [Any])?.isEmpty == true })
            let recent = try applied(p, to: storage)
            let again = try NativeWeeklyReportPolicy.prepare(storage: recent, profileKeys: keys, action: .sync, force: true, now: now.addingTimeInterval(day))
            XCTAssertNil(again.body)
        }
    }
    func testOffAliasAcknowledgmentRequiresFreshActivationForCurrentSpelling() throws {
        var storage = family
        var profile = try object(Data(storage[keys[0]]!.utf8))
        profile["email"] = "d.ad+sona@gmail.com"
        storage[keys[0]] = String(decoding: try JSONSerialization.data(withJSONObject: profile), as: UTF8.self)
        storage["sona.report.v1"] = "{\"dev\":\"\(dev)\",\"onFor\":\"d.ad+sona@gmail.com\",\"offs\":[{\"e\":\"dad@gmail.com\",\"d\":\"\(dev)\"}]}"
        let p = try NativeWeeklyReportPolicy.prepare(storage: storage, profileKeys: keys, action: .flush, force: true, now: now)
        storage = try applied(p, to: storage)
        let ack = try NativeWeeklyReportPolicy.acknowledge(storage: storage, profileKeys: keys, context: XCTUnwrap(p.context),
            response: Data(#"{"ok":true}"#.utf8), now: now)
        storage = try applied(ack, to: storage)
        XCTAssertNil(try object(Data(storage["sona.report.v1"]!.utf8))["onFor"])
        let next = try NativeWeeklyReportPolicy.prepare(storage: storage, profileKeys: keys, action: .sync, force: true, now: now)
        XCTAssertEqual(try object(next.body)["on"] as? Bool, true)
    }
}

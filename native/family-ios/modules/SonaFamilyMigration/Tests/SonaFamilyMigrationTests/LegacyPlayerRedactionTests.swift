import Foundation
import XCTest
@testable import SonaFamilyMigration

final class LegacyPlayerRedactionTests: XCTestCase {
    func testOnlyDeletedOwnersHistoryAndUndoAreRedacted() throws {
        let deleted = NativeFamilyChildID(origin: .app, slot: "")
        let storage: [String: String] = [
            "sona.kids.v1": #"{"list":[{"slot":"","name":"Fixture A"},{"slot":"k4","name":"Fixture B"}],"active":"","hi":9,"extra":"kept"}"#,
            "sona.profile.v1": #"{"childName":"Fixture A","earlyAdopter":true,"onboarded":true}"#,
            "sona.profile.v1@": #"{"childName":"Alias for Fixture A"}"#,
            "sona.profile.v1@k4": #"{"childName":"Fixture B","onboarded":true}"#,
            "sona.pilot.v1": #"{"code":"ff-FIXTURE","consent":true}"#,
            "sona.progress.v1": "fixture-only-older-try",
            "sona.progress.v1@k4": "fixture-sibling-try",
            "sona.household": "unchanged",
            "sona.freeera.v1": "grandfathered",
            "sona.freeera2.v1": "done", "sona.freeera3.v1": "done",
            "sona.freeera4.v1": "done", "sona.freeera5.v1": "done",
        ]
        let redacted = try LegacyPlayerRedaction.redact(storage, child: deleted)
        let imported = try SnapshotImporter.prepare(.init(origin: .app, storage: redacted))
        XCTAssertNil(redacted["sona.profile.v1"])
        XCTAssertNil(redacted["sona.profile.v1@"])
        XCTAssertNil(redacted["sona.progress.v1"])
        XCTAssertNil(redacted["sona.pilot.v1"])
        XCTAssertEqual(redacted["sona.progress.v1@k4"], storage["sona.progress.v1@k4"])
        XCTAssertEqual(redacted["sona.household"], "unchanged")
        XCTAssertEqual(imported.activeSlot, "k4")
        XCTAssertEqual(imported.slotHighWaterMark, 9)
        XCTAssertTrue(imported.evaluatingLegacyPromises().hasFreeEraPromise)
        XCTAssertTrue(imported.evaluatingLegacyPromises().hasFoundingPromise)
        let undo = try NativeFamilyOrigin.json(["app": "sona", "v": 1, "data": storage])
        let safeUndo = try LegacyPlayerRedaction.redactUndo(undo, child: deleted)
        XCTAssertFalse(safeUndo.contains("Fixture A"))
        XCTAssertFalse(safeUndo.contains("fixture-only-older-try"))
        XCTAssertTrue(safeUndo.contains("Fixture B"))
        XCTAssertEqual(try LegacyPlayerRedaction.redactUndo(safeUndo, child: deleted), safeUndo)
    }
}

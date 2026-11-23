import XCTest
@testable import SonaFamilyBackup
@testable import SonaFamilyMigration

private final class CopyBackupMemoryStore: NativeFamilyDocumentStore, @unchecked Sendable {
    var value: NativeFamilyDocument?
    var commits = 0
    func read() throws -> NativeFamilyDocument? { value }
    func commit(_ document: NativeFamilyDocument) throws { value = document; commits += 1 }
}

final class BackupCodeExportTests: XCTestCase {
    @MainActor
    func testCodeHasExactFileBytesAndExportExclusionsWithoutChangingSavedFamily() async throws {
        let store = CopyBackupMemoryStore(), repository = NativeFamilyRepository(store: store)
        var archive = MigrationArchive()
        for origin in LegacyOrigin.allCases {
            var values: [String:String] = [:]
            if origin == .app {
                values[LegacyKeys.profile] = #"{"childName":"Synthetic Copy","childAge":"7","focusSounds":["S"],"onboarded":true}"#
                values["sona.progress.v1"] = #"{"totals":{"coins":17}}"#
                values["sona.slpticket"] = "synthetic-device-credential"
                values["sona.notify.v1"] = #"{"nudge":1}"#
            }
            archive.origins[origin.rawValue] = try SnapshotImporter.prepare(.init(origin: origin, storage: values))
        }
        _ = try await repository.seed(from: archive, primaryOrigin: .app)
        let before = try await repository.snapshot(), commits = store.commits
        let service = FamilyMovingPhonesService(repository: repository, origin: .app)
        let code = try await service.exportCode(), file = try await service.exportFile()
        XCTAssertEqual(Data(code.utf8), file, "Copy must use the exact same portable encoding as Save file")
        let decoded = try NativeFamilyPortableBackup.decode(Data(code.utf8))
        XCTAssertNotNil(decoded.data[LegacyKeys.profile])
        XCTAssertNil(decoded.data["sona.slpticket"])
        XCTAssertNil(decoded.data["sona.notify.v1"])
        XCTAssertFalse(code.contains("synthetic-device-credential"))
        let after = try await repository.snapshot()
        XCTAssertEqual(after, before)
        XCTAssertEqual(store.commits, commits, "Copy is a pure export; no progress, receipt or access mutation")
        XCTAssertFalse(service.busy)
    }

    @MainActor
    func testCopyKeepsExistingOwningOriginGuard() async throws {
        let store = CopyBackupMemoryStore(), repository = NativeFamilyRepository(store: store)
        var archive = MigrationArchive()
        for origin in LegacyOrigin.allCases {
            let values = origin == .app ? [LegacyKeys.profile: #"{"childName":"Synthetic","onboarded":true}"#] : [:]
            archive.origins[origin.rawValue] = try SnapshotImporter.prepare(.init(origin: origin, storage: values))
        }
        _ = try await repository.seed(from: archive, primaryOrigin: .app)
        let service = FamilyMovingPhonesService(repository: repository, origin: .www)
        do { _ = try await service.exportCode(); XCTFail("A stale origin cannot export a different family's code") }
        catch { XCTAssertEqual(error as? NativeFamilyBackupError, .wrongOrigin) }
        XCTAssertFalse(service.busy)
    }
}

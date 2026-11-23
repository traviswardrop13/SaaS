import Foundation
import SonaFamilyMigration

/// Page-length memory survives Play again even if the device cannot save.
/// A new child/visit gets its own instance; no static child cache exists.
@MainActor final class NativeDinoCollectionMemory {
    let owner: NativeFamilyChildID
    var value: NativeDinoCollection?
    init(owner: NativeFamilyChildID) { self.owner = owner }
}
struct NativeDinoCollectionAccess {
    let scope: String
    let isCurrent: @MainActor () -> Bool
    let load: @MainActor () async throws -> NativeDinoCollection
    let save: @MainActor (NativeDinoCollection, String) async -> Void
}
@MainActor extension NativeFamilyState {
    func dinoCollectionAccess(owner: NativeFamilyChildID, memory: NativeDinoCollectionMemory,
                              isCurrent: @escaping @MainActor () -> Bool) -> NativeDinoCollectionAccess {
        .init(scope: "\(owner.origin.rawValue)/\(owner.slot)",
            isCurrent: { [weak self] in self?.activeID == owner && memory.owner == owner && isCurrent() },
            load: { [weak self] in
                guard let self, self.activeID == owner, memory.owner == owner, isCurrent(), !Task.isCancelled else { throw CancellationError() }
                if let value = memory.value { return value }
                let value: NativeDinoCollection = try await self.read(.dinoCollection)
                guard self.activeID == owner, memory.owner == owner, isCurrent(), !Task.isCancelled else { throw CancellationError() }
                memory.value = value; return value
            }, save: { [weak self] value, receipt in
                guard let self, self.activeID == owner, memory.owner == owner, isCurrent(), !Task.isCancelled else { return }
                memory.value = value
                // The original collection save is best effort and independent
                // of the speech ledger. A failed save cannot revoke an earned
                // finger move, re-open the microphone or reset the next animal.
                let _: NativeDinoCollection? = try? await self.write(.dinoCollectionSave,
                    input: .init(dinoLast: value.last, dinoGot: value.got), owner: owner, receipt: receipt)
            })
    }
}

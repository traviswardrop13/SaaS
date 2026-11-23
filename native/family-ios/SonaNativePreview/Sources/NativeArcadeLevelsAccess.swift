import Foundation
import SonaFamilyMigration

@MainActor extension NativeFamilyState {
    /// One child's current access. The caller supplies the existing game-access
    /// decision; neither levels nor a numeric best can grant content access.
    func arcadeLevelsAccess(owner: NativeFamilyChildID, revision: Int,
                            canOpen: @escaping @MainActor (String) -> Bool,
                            didChange: @escaping @MainActor () -> Void) -> NativeArcadeLevelsAccess {
        NativeArcadeLevelsAccess(scope: "\(owner.origin.rawValue)/\(owner.slot)", revision: revision,
            isCurrent: { [weak self] in self?.activeID == owner }, canOpen: canOpen,
            catalog: { [weak self] in
                guard let self, self.activeID == owner else { throw CancellationError() }
                return try await self.read(.arcadeLevelCatalog)
            }, info: { [weak self] game in
                guard let self, self.activeID == owner else { throw CancellationError() }
                return try await self.read(.arcadeLevelInfo, input: .init(game: game))
            }, ask: { [weak self] game in
                guard let self, self.activeID == owner, canOpen(game) else { throw CancellationError() }
                return try await self.write(.arcadeLevelAsk, input: .init(game: game), owner: owner)
            }, set: { [weak self] game, level in
                guard let self, self.activeID == owner, canOpen(game) else { throw CancellationError() }
                let saved: Bool = try await self.write(.arcadeLevelSet, input: .init(game: game, playLevel: level), owner: owner)
                if saved { didChange() }
                return saved
            }, best: { [weak self] game, level in
                guard let self, self.activeID == owner else { throw CancellationError() }
                return try await self.read(.arcadeBest, input: .init(game: game, playLevel: level))
            }, offer: { [weak self] game, level, count, receipt, occurrence in
                guard let self, self.activeID == owner, canOpen(game) else { throw CancellationError() }
                let fields = NativeRuleFields(game: game, playLevel: level, bestCount: count)
                // Source answers the numeric best even if storage fails. A read
                // evaluates that exact offer in its private JS copy and commits
                // none of its changes; it supplies only that failure fallback.
                let preview: NativeArcadeBestOffer = try await self.read(.arcadeBestOffer, input: fields)
                guard self.activeID == owner, canOpen(game), !Task.isCancelled else { throw CancellationError() }
                do {
                    let saved: NativeArcadeBestOffer = try await NativePracticeOccurrenceScope.$current.withValue(occurrence) {
                        try await self.write(.arcadeBestOffer, input: fields, owner: owner, receipt: receipt)
                    }
                    didChange()
                    return saved
                } catch {
                    guard self.activeID == owner, canOpen(game), !Task.isCancelled else { throw CancellationError() }
                    return preview
                }
            })
    }
}

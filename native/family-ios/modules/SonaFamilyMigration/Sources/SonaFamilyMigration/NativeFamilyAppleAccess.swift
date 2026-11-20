import Foundation

/// Last authoritative Apple ownership for one existing local household.
/// Kept separately so a store refresh cannot overwrite a Stripe record.
public struct NativeFamilyAppleAccess: Codable, Equatable, Sendable {
    public let active: Bool
    public let checkedAt: Date?
    public let revision: UUID?

    public init(active: Bool, checkedAt: Date?, revision: UUID? = nil) {
        self.active = active
        self.checkedAt = checkedAt
        self.revision = revision
    }
}

public enum NativeFamilyAppleWrite: Equatable, Sendable {
    case refresh(expectedRevision: UUID?)
    case purchaseOrRestore
}

public extension NativeFamilyRepository {
    func appleAccessRevision(for origin: LegacyOrigin) throws -> UUID? {
        guard let document = try snapshot() else { throw NativeFamilyRepositoryError.notSeeded }
        guard document.origins[origin.rawValue] != nil else { throw NativeFamilyRepositoryError.originNotFound }
        return document.appleAccess?[origin.rawValue]?.revision
    }

    /// Decide against the current saved revision in the same transaction that
    /// writes the answer. Return the saved grant even when a lookup is stale.
    @discardableResult
    func recordAppleAccess(_ access: NativeFamilyAppleAccess, origin: LegacyOrigin,
                           source: NativeFamilyAppleWrite) throws -> NativeFamilyAppleAccess {
        try change { document in
            guard document.origins[origin.rawValue] != nil else { throw NativeFamilyRepositoryError.originNotFound }
            var values = document.appleAccess ?? [:]
            let current = values[origin.rawValue]
            let checkedAt: Date?
            switch source {
            case .refresh(let expected):
                if current?.revision != expected {
                    guard let current else { throw NativeFamilyRepositoryError.operationConflict }
                    return current
                }
                checkedAt = access.checkedAt
            case .purchaseOrRestore:
                guard access.active else { throw NativeFamilyRepositoryError.operationConflict }
                // A successful transaction does not reset the usual refresh
                // cadence. A fallback customer-info check may have newer time.
                checkedAt = [current?.checkedAt, access.checkedAt].compactMap { $0 }.max()
            }
            let updated = NativeFamilyAppleAccess(active: access.active, checkedAt: checkedAt, revision: UUID())
            values[origin.rawValue] = updated
            document.appleAccess = values
            return updated
        }
    }
}

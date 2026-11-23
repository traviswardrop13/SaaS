import Foundation

/// A server-confirmed website subscription for this local household. It stays
/// in the protected native document, separate from Apple and ordinary backups.
public struct NativeFamilyWebsiteAccess: Codable, Equatable, Sendable {
    public let active: Bool
    public let email: String
    public let checkedAt: Date
    public let revision: UUID
    public let operationID: UUID

    public static func normalizedEmail(_ value: String) -> String? {
        let address = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return address.range(of: "^\\S+@\\S+\\.\\S+$", options: .regularExpression) != nil ? address : nil
    }
}

/// A same-document fence, never an account ID or a portable grant. Callers get
/// this from the repository before asking the existing subscription endpoint.
public struct NativeFamilyWebsiteRestoreToken: Equatable, Sendable {
    let subscriptionJSON: String?
    let revision: UUID?
}

public enum NativeFamilyWebsiteRestoreResult: Equatable, Sendable {
    case recorded(NativeFamilyWebsiteAccess)
    case noMatchingSubscription
    case superseded
}

public extension NativeFamilyRepository {
    func websiteRestoreToken(for origin: LegacyOrigin) throws -> NativeFamilyWebsiteRestoreToken {
        guard let document = try snapshot() else { throw NativeFamilyRepositoryError.notSeeded }
        guard let family = document.origins[origin.rawValue] else { throw NativeFamilyRepositoryError.originNotFound }
        return .init(subscriptionJSON: family.storage["sona.sub.v1"], revision: document.websiteAccess?[origin.rawValue]?.revision)
    }

    /// Persist only a confirmed answer against the origin captured by its parent
    /// action. A sibling/family switch cannot retarget it. A failed request never
    /// calls this method. Original Apple evidence and all child records stay held.
    @discardableResult
    func recordWebsiteRestore(active: Bool, email: String, checkedAt: Date, origin: LegacyOrigin,
                              expected: NativeFamilyWebsiteRestoreToken, operationID: UUID) throws -> NativeFamilyWebsiteRestoreResult {
        guard let address = NativeFamilyWebsiteAccess.normalizedEmail(email), checkedAt.timeIntervalSince1970.isFinite else {
            throw NativeFamilyRepositoryError.invalidProfile
        }
        return try change { document in
            guard let family = document.origins[origin.rawValue] else { throw NativeFamilyRepositoryError.originNotFound }
            let current = document.websiteAccess?[origin.rawValue]
            if current?.operationID == operationID {
                guard current?.active == active, current?.email == address, current?.checkedAt == checkedAt else {
                    throw NativeFamilyRepositoryError.operationConflict
                }
                return .recorded(current!)
            }
            guard current?.revision == expected.revision,
                  family.storage["sona.sub.v1"] == expected.subscriptionJSON else { return .superseded }
            if !active {
                // Match Sona.restore: a negative about another address says
                // nothing about the cached subscription, including old records
                // with a missing/unrecognised source. Apple is never this grant.
                let matches: Bool
                if let current {
                    matches = current.active && current.email.lowercased() == address.lowercased()
                } else {
                    let cached = NativeFamilyOrigin.object(family.storage["sona.sub.v1"]) ?? [:]
                    let value = cached["active"]
                    let cachedActive: Bool
                    if let text = value as? String { cachedActive = !text.isEmpty }
                    else if let number = value as? NSNumber { cachedActive = number.doubleValue != 0 }
                    else { cachedActive = value != nil && !(value is NSNull) }
                    matches = cachedActive && (cached["source"] as? String) != "apple" &&
                        (cached["email"] as? String)?.lowercased() == address.lowercased()
                }
                guard matches else { return .noMatchingSubscription }
            }
            let recorded = NativeFamilyWebsiteAccess(active: active, email: address, checkedAt: checkedAt,
                                                     revision: UUID(), operationID: operationID)
            var values = document.websiteAccess ?? [:]; values[origin.rawValue] = recorded
            document.websiteAccess = values
            return .recorded(recorded)
        }
    }
}

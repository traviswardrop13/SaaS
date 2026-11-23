import SonaFamilyMigration

public extension FamilyEntitlementState {
    /// A verified native website record supersedes the original non-Apple cache.
    /// Keeping its inactive result prevents an older raw cache reappearing later.
    mutating func applyWebsiteAccess(_ access: NativeFamilyWebsiteAccess) {
        grants.remove(.stripe)
        grants.remove(.legacySubscription)
        stripeAccount = access.email
        if access.active { grants.insert(.stripe) }
    }
}

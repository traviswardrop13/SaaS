import Foundation
import SonaFamilyAccess
import SonaFamilyMigration
import SonaFamilyStorefront
#if canImport(NativeTrialReminders)
import NativeTrialReminders
#endif

extension NativeTrialReminderStatus {
    init(customerInfo: FamilyPurchaseCustomerInfo) {
        let full = customerInfo.fullEntitlement
        self.init(hasFullEntitlement: full != nil, periodType: full?.periodType ?? "",
            expirationMilliseconds: full?.expirationDate.map { $0.timeIntervalSince1970 * 1_000 }, willRenew: full?.willRenew)
    }
}

@MainActor extension NativeTrialReminderStore {
    static func offeredFreeEnd(_ offer: FamilyStoreOffer?, at date: Date, timeZone: TimeZone) -> Date? {
        guard let offer, case .freeTrial(let period, _) = offer.terms, period.count > 0 else { return nil }
        switch period.unit {
        case .day: return date.addingTimeInterval(Double(period.count) * 86_400)
        case .week: return date.addingTimeInterval(Double(period.count) * 7 * 86_400)
        case .month, .year:
            var calendar = Calendar(identifier: .gregorian); calendar.timeZone = timeZone
            return calendar.date(byAdding: period.unit == .year ? .year : .month, value: period.count, to: date)
        }
    }
    func canPromiseTrialReminder(for offer: FamilyStoreOffer?, at date: Date = Date(), timeZone: TimeZone = .current) -> Bool {
        guard let offer, case .freeTrial(_, confirmedEligible: true) = offer.terms,
              let end = Self.offeredFreeEnd(offer, at: date, timeZone: timeZone) else { return false }
        return trialReminderOn(sureFreeEnd: end)
    }
    func receiveStorefront(_ event: FamilyStorefrontReminderEvent, at date: Date = Date(), timeZone: TimeZone = .current) {
        switch event {
        case .purchased(let info, let offer):
            let end = Self.offeredFreeEnd(offer, at: date, timeZone: timeZone)
            let sure: Date?
            if case .freeTrial(_, confirmedEligible: true) = offer.terms { sure = end } else { sure = nil }
            purchaseSucceeded(.init(periodType: info.fullEntitlement?.periodType ?? "",
                expirationMilliseconds: info.fullEntitlement?.expirationDate.map { $0.timeIntervalSince1970 * 1_000 },
                sureFreeEndMilliseconds: sure.map { $0.timeIntervalSince1970 * 1_000 },
                offerFreeEndMilliseconds: end.map { $0.timeIntervalSince1970 * 1_000 }))
        case .recoveredSale(_, let offer):
            let sure: Date?
            if let offer, case .freeTrial(_, confirmedEligible: true) = offer.terms {
                sure = Self.offeredFreeEnd(offer, at: date, timeZone: timeZone)
            } else { sure = nil }
            saleRecovered(sureFreeEnd: sure)
        }
    }
    #if os(iOS)
    static func appDevice() -> NativeTrialReminderStore {
        let fetch: NativeTrialReminderStore.StatusProvider?
        if NativeStorefrontHost.canSell {
            fetch = {
                guard let client = NativeStorefrontHost.makeClient() else { return nil }
                do { return NativeTrialReminderStatus(customerInfo: try await client.customerInfo()) }
                catch { return nil }
            }
        } else { fetch = nil }
        return NativeTrialReminderStore(client: NativeTrialReminderUNClient(), persistence: NativeTrialReminderDefaults(), statusProvider: fetch)
    }
    #endif
}

#if os(iOS)
import SwiftUI
import UIKit
import SonaFamilyAccess

/// Present only after the app's existing Grown-ups check. The store itself
/// independently refuses purchasing in the separate preview bundle.
public struct FamilyStorefrontView: View {
    @ObservedObject private var store: FamilyStorefrontStore
    @ObservedObject private var websiteRestore: FamilyEmailRestoreStore
    private let reminderOn: @MainActor (FamilyStoreOffer) -> Bool
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    private let headline: String
    private let artwork: [String]
    private let mascot: String
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// `headline` names the child or the game that was tapped ("Unlock every
    /// game for Milo"). `artwork` and `mascot` are picture names in the app's
    /// own asset catalog; a missing picture simply draws nothing.
    public init(store: FamilyStorefrontStore, websiteRestore: FamilyEmailRestoreStore? = nil,
                headline: String = "Unlock every game",
                artwork: [String] = ["game-slice", "game-hoops"], mascot: String = "echo-cheer",
                reminderOn: @escaping @MainActor (FamilyStoreOffer) -> Bool = { _ in false }) {
        self.store = store
        self.reminderOn = reminderOn
        self.headline = headline
        self.artwork = artwork
        self.mascot = mascot
        self.websiteRestore = websiteRestore ?? FamilyEmailRestoreStore(repository: nil, origin: .app)
    }

    // The offer is a moment, not a settings page: pictures and Echo on top, a
    // headline, what Premium gives, the plans, one button. The X is "Not now".
    // It draws no navigation bar of its own, so it can sit inside the app's
    // sheet or be pushed from Grown-ups without two bars stacking.
    public var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                hero
                VStack(alignment: .leading, spacing: 16) {
                    Text(headline)
                        .font(.system(.title, design: .rounded).weight(.heavy))
                        .foregroundStyle(ink)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityAddTraits(.isHeader)
                    if store.phase == .ready || store.phase == .loading || store.phase == .idle { benefits }
                    content
                    // The active-plan copy in public/subscribe.html#planCancel gives
                    // both shops conditionally; a legacy grant never guesses its shop.
                    if !store.access.grants.isDisjoint(with: [.apple, .stripe, .legacySubscription]) {
                        Text(.init("To cancel a plan bought on speaksona.com, email [hello@speaksona.com](mailto:hello@speaksona.com?subject=Cancel%20my%20Sona%20plan) and we’ll cancel it for you. A subscription bought on iPhone or iPad: open the phone’s Settings, tap your name, then Subscriptions. A one payment has nothing to cancel."))
                            .font(.footnote).foregroundStyle(muted)
                            .fixedSize(horizontal: false, vertical: true)
                            .accessibilityIdentifier("family-store-manage-plan")
                    }
                    if let notice = store.notice {
                        Text(notice.text).font(.body).foregroundStyle(ink)
                            .padding(16).frame(maxWidth: .infinity, alignment: .leading)
                            .background(.white, in: RoundedRectangle(cornerRadius: 16))
                            .accessibilityIdentifier("family-store-status")
                    }
                    if store.needsSaveRetry {
                        Button { Task { await store.retrySave() } } label: {
                            Text("Try saving again").font(.headline).frame(maxWidth: .infinity, minHeight: 52)
                        }.buttonStyle(.borderedProminent).disabled(store.busy)
                            .accessibilityIdentifier("family-store-save")
                    }
                    if websiteRestore.isAvailable, !store.freeMode, !store.access.premium {
                        FamilyEmailRestoreView(store: websiteRestore)
                            .disabled(store.busy || store.needsSaveRetry)
                    }
                    footerLinks
                }
                .padding(.horizontal, 22).padding(.top, 14).padding(.bottom, 24)
            }
            .frame(maxWidth: 580).frame(maxWidth: .infinity)
        }
        .background(paper.ignoresSafeArea())
        .navigationBarHidden(true)
        .tint(teal)
        .task { await store.load() }
        .onChange(of: scenePhase) { phase in
            if phase == .active && store.awaitingApproval { Task { await store.load() } }
        }
        .accessibilityIdentifier("family-storefront")
    }

    private var hero: some View {
        ZStack(alignment: .topTrailing) {
            ZStack {
                LinearGradient(colors: [mint, paper], startPoint: .top, endPoint: .bottom)
                HStack(spacing: -34) {
                    ForEach(Array(artwork.prefix(2).enumerated()), id: \.offset) { index, name in
                        Image(name).resizable().scaledToFill()
                            .frame(width: 168, height: 112).clipped()
                            .clipShape(RoundedRectangle(cornerRadius: 18))
                            .shadow(color: .black.opacity(0.18), radius: 8, y: 4)
                            .rotationEffect(.degrees(index == 0 ? -6 : 6))
                    }
                }
                .padding(.top, 8)
                Image(mascot).resizable().scaledToFit()
                    .frame(width: 132, height: 132)
                    .offset(y: 46)
            }
            .frame(height: 210).frame(maxWidth: .infinity).clipped()
            .accessibilityHidden(true)

            // "Not now": the same way out as before, where a thumb expects it.
            Button { dismiss() } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(muted)
                    .frame(width: 44, height: 44)
                    .background(.white.opacity(0.78), in: Circle())
            }
            .buttonStyle(.plain)
            .padding(.top, 10).padding(.trailing, 14)
            .accessibilityLabel("Not now")
            .accessibilityIdentifier("family-store-close")
        }
    }

    private var benefits: some View {
        VStack(alignment: .leading, spacing: 8) {
            benefit("Every game and every book")
            benefit("Real speech practice in every game")
            benefit("No ads, ever")
        }
        .accessibilityElement(children: .combine)
    }

    private func benefit(_ text: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Image(systemName: "checkmark.circle.fill").foregroundStyle(teal)
            Text(text).font(.system(.body, design: .rounded).weight(.semibold)).foregroundStyle(ink)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var footerLinks: some View {
        HStack(spacing: 18) {
            if store.phase != .preview {
                Button { Task { await store.restore() } } label: {
                    HStack(spacing: 6) {
                        if store.operation == .restoring { ProgressView() }
                        Text("Restore Purchases")
                    }.frame(minHeight: 44)
                }.disabled(!store.canRestore).accessibilityIdentifier("family-store-restore")
            }
            Link("Terms", destination: URL(string: "https://app.speaksona.com/terms.html")!).frame(minHeight: 44)
            Link("Privacy", destination: URL(string: "https://app.speaksona.com/privacy.html")!).frame(minHeight: 44)
        }
        .font(.footnote.weight(.semibold)).frame(maxWidth: .infinity)
    }

    @ViewBuilder private var content: some View {
        switch store.phase {
        case .preview:
            VStack(alignment: .leading, spacing: 10) {
                Text("Preview only").font(.headline)
                Text("Purchases are turned off in this separate preview app.").font(.body).foregroundStyle(.secondary)
            }.padding(20).frame(maxWidth: .infinity, alignment: .leading)
                .background(.white, in: RoundedRectangle(cornerRadius: 20))
                .accessibilityIdentifier("family-store-preview")
        case .idle, .loading:
            HStack(spacing: 12) { ProgressView(); Text("Checking the App Store…") }
                .frame(maxWidth: .infinity, minHeight: 90)
                .accessibilityIdentifier("family-store-loading")
        case .alreadyOpen:
            VStack(alignment: .leading, spacing: 12) {
                Label(store.freeMode ? "Sona is free right now" : "Your family already has access", systemImage: "checkmark.circle.fill")
                    .font(.headline)
                if !store.freeMode { Text("You don’t need to buy again.").foregroundStyle(.secondary) }
            }.padding(20).frame(maxWidth: .infinity, alignment: .leading)
                .background(.white, in: RoundedRectangle(cornerRadius: 20))
                .accessibilityIdentifier("family-store-owned")
        case .unavailable:
            VStack(alignment: .leading, spacing: 16) {
                Text(store.needsSaveRetry ? "One more step" : "We couldn’t reach the App Store.").font(.headline)
                if !store.needsSaveRetry {
                    Button("Try again") { Task { await store.load() } }
                        .font(.headline).frame(minHeight: 44).disabled(store.busy)
                        .accessibilityIdentifier("family-store-retry")
                }
            }.padding(20).frame(maxWidth: .infinity, alignment: .leading)
                .background(.white, in: RoundedRectangle(cornerRadius: 20))
        case .ready:
            let several = store.offers.count > 1
            VStack(spacing: 12) {
                ForEach(store.offers, id: \.productID) { offer in
                    let picked = store.selectedProductID == offer.productID
                    Button {
                        guard !picked else { return }
                        UISelectionFeedbackGenerator().selectionChanged()
                        withAnimation(reduceMotion ? nil : .spring(response: 0.3, dampingFraction: 0.7)) {
                            store.selectedProductID = offer.productID
                        }
                    } label: {
                        HStack(alignment: .center, spacing: 12) {
                            Image(systemName: picked ? "largecircle.fill.circle" : "circle")
                                .font(.title3).foregroundStyle(picked ? teal : muted)
                            VStack(alignment: .leading, spacing: 3) {
                                HStack(spacing: 8) {
                                    Text(title(offer)).font(.system(.headline, design: .rounded)).foregroundStyle(ink)
                                    if several, sureTrial(offer) != nil {
                                        Text("Recommended").font(.caption2.weight(.heavy))
                                            .padding(.horizontal, 8).padding(.vertical, 3)
                                            .foregroundStyle(ink).background(butter, in: Capsule())
                                    }
                                }
                                Text(rowLine(offer)).font(.subheadline).foregroundStyle(muted)
                                    .multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
                            }
                            Spacer(minLength: 4)
                            Text(amount(offer)).font(.system(.headline, design: .rounded)).foregroundStyle(ink)
                        }
                        .padding(16).frame(maxWidth: .infinity, minHeight: 72, alignment: .leading)
                        .background(.white, in: RoundedRectangle(cornerRadius: 20))
                        .overlay(RoundedRectangle(cornerRadius: 20).stroke(picked ? teal : line, lineWidth: picked ? 2.5 : 1))
                        .scaleEffect(picked || reduceMotion ? 1 : 0.985)
                    }.buttonStyle(.plain).disabled(store.busy)
                        .accessibilityAddTraits(picked ? .isSelected : [])
                        .accessibilityIdentifier("family-store-product-\(offer.kind.rawValue)")
                }
                if let offer = store.selectedOffer {
                    if let trial = sureTrial(offer) { timeline(offer, days: trial) }
                    Button { Task { await store.purchaseSelected() } } label: {
                        HStack {
                            if store.operation == .purchasing { ProgressView().tint(.white) }
                            Text(buttonTitle(offer)).font(.system(.title3, design: .rounded).weight(.heavy))
                                .multilineTextAlignment(.center)
                        }
                        .frame(maxWidth: .infinity, minHeight: 58).foregroundStyle(.white)
                        .background(teal, in: RoundedRectangle(cornerRadius: 18))
                        .shadow(color: tealDeep, radius: 0, y: 4)
                    }.buttonStyle(.plain)
                        .disabled(!store.canPurchase || websiteRestore.busy || websiteRestore.needsSaveRetry)
                        .opacity(store.canPurchase ? 1 : 0.6)
                        .padding(.top, 2)
                        .accessibilityIdentifier("family-store-buy")
                    // The timeline's middle step already says "Reminder"; say it once.
                    if reminderOn(offer), sureTrial(offer) == nil {
                        Text("We'll remind you the day before it ends.").font(.footnote).foregroundStyle(ink)
                            .multilineTextAlignment(.center).accessibilityIdentifier("family-store-reminder")
                    }
                    Text(renewal(offer)).font(.footnote).foregroundStyle(muted)
                        .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity)
                }
            }
        }
    }

    /// Today · the day before · the billing day. Only for a free trial the
    /// store is sure of, counted in days, three or more. Never a date.
    private func timeline(_ offer: FamilyStoreOffer, days: Int) -> some View {
        HStack(spacing: 8) {
            step("Today", "Free")
            step("Day \(days - 1)", reminderOn(offer) ? "Reminder" : "Still free")
            step("Day \(days)", amount(offer))
        }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("family-store-timeline")
    }

    private func step(_ top: String, _ bottom: String) -> some View {
        VStack(spacing: 2) {
            Text(top).font(.system(.footnote, design: .rounded).weight(.heavy)).foregroundStyle(ink)
            Text(bottom).font(.caption).foregroundStyle(muted)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 9)
        .background(.white.opacity(0.8), in: RoundedRectangle(cornerRadius: 12))
    }

    private var paper: Color { Color(red: 1, green: 0.972, blue: 0.927) }
    private var ink: Color { Color(red: 0.153, green: 0.137, blue: 0.216) }
    private var muted: Color { Color(red: 0.40, green: 0.36, blue: 0.46) }
    private var line: Color { Color(red: 0.88, green: 0.85, blue: 0.81) }
    private var mint: Color { Color(red: 0.85, green: 0.94, blue: 0.93) }
    private var butter: Color { Color(red: 1, green: 0.84, blue: 0.36) }
    private var tealDeep: Color { Color(red: 0.04, green: 0.39, blue: 0.41) }
    private var teal: Color { Color(red: 0.067, green: 0.498, blue: 0.518) }
    private func title(_ offer: FamilyStoreOffer) -> String {
        switch offer.kind { case .monthly: return "Monthly"; case .annual: return "Yearly"; case .lifetime: return "Lifetime" }
    }
    private func cadence(_ offer: FamilyStoreOffer) -> String { offer.kind == .annual ? "a year" : "a month" }
    private func amount(_ offer: FamilyStoreOffer) -> String {
        switch offer.kind { case .monthly: return "\(offer.localizedPrice)/mo"; case .annual: return "\(offer.localizedPrice)/yr"; case .lifetime: return offer.localizedPrice }
    }
    private func dayCount(_ period: FamilyStorePeriod) -> Int? {
        switch period.unit { case .day: return period.count; case .week: return period.count * 7; default: return nil }
    }
    /// The free days of a trial the store is sure of, when they can be drawn
    /// as three steps (three days or more); nil for anything else.
    private func sureTrial(_ offer: FamilyStoreOffer) -> Int? {
        if case .freeTrial(let period, let sure) = offer.terms, sure, let n = dayCount(period), n >= 3 { return n }
        return nil
    }
    private func duration(_ period: FamilyStorePeriod) -> String {
        let n = period.unit == .week ? period.count * 7 : period.count
        let unit = period.unit == .week ? "day" : period.unit.rawValue
        return "\(n) \(unit)\(n == 1 ? "" : "s")"
    }
    private func rowLine(_ offer: FamilyStoreOffer) -> String {
        switch offer.terms {
        case .onePayment: return "Yours Forever · Billed today"
        case .chargedToday: return "Charged today"
        case .freeTrial(let period, let sure):
            let n = period.unit == .week ? period.count * 7 : period.count
            let unit = period.unit == .week ? "day" : period.unit.rawValue
            return sure ? "\(n)-\(unit) free trial" : "\(n)-\(unit) free trial for new subscribers"
        }
    }
    private func buttonTitle(_ offer: FamilyStoreOffer) -> String {
        switch offer.terms {
        case .onePayment: return "Start practicing!"
        case .freeTrial(_, let sure) where sure: return "Start practicing!"
        default: return "Subscribe — \(offer.localizedPrice) \(cadence(offer))"
        }
    }
    private func renewal(_ offer: FamilyStoreOffer) -> String {
        switch offer.terms {
        case .onePayment: return "One payment of \(offer.localizedPrice). No subscription."
        case .freeTrial(let period, let sure):
            if sure { return "\(duration(period)) free, then \(offer.localizedPrice) \(cadence(offer)). Auto-renews. Cancel anytime." }
            return "Only new subscribers get \(duration(period)) free. Otherwise Apple charges \(offer.localizedPrice) today. Apple shows your exact terms before you confirm."
        case .chargedToday:
            return "Renews at \(offer.localizedPrice) \(cadence(offer)) unless cancelled. Manage or cancel in your Apple Account settings."
        }
    }
}
#endif

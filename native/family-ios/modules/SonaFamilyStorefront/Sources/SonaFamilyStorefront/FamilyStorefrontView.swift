#if os(iOS)
import SwiftUI
import SonaFamilyAccess

/// Present only after the app's existing Grown-ups check. The store itself
/// independently refuses purchasing in the separate preview bundle.
public struct FamilyStorefrontView: View {
    @ObservedObject private var store: FamilyStorefrontStore
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    public init(store: FamilyStorefrontStore) { self.store = store }

    public var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    VStack(alignment: .leading, spacing: 10) {
                        Image(systemName: "sparkles").font(.largeTitle).foregroundStyle(teal)
                        Text("Sona Premium").font(.system(.largeTitle, design: .rounded).weight(.bold))
                        Text("Games, books and daily adventures.").font(.body).foregroundStyle(.secondary)
                    }
                    content
                    if let notice = store.notice {
                        Text(notice.text).font(.body)
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
                    if store.phase != .preview {
                        Button { Task { await store.restore() } } label: {
                            HStack {
                                if store.operation == .restoring { ProgressView() }
                                Text("Restore Purchases").font(.body.weight(.semibold))
                            }.frame(maxWidth: .infinity, minHeight: 48)
                        }.disabled(!store.canRestore).accessibilityIdentifier("family-store-restore")
                    }
                    HStack(spacing: 24) {
                        Link("Terms", destination: URL(string: "https://app.speaksona.com/terms.html")!)
                        Link("Privacy", destination: URL(string: "https://app.speaksona.com/privacy.html")!)
                    }.font(.footnote).frame(maxWidth: .infinity)
                }.padding(24).frame(maxWidth: 580).frame(maxWidth: .infinity)
            }
            .background(Color(red: 0.97, green: 0.96, blue: 0.93).ignoresSafeArea())
            .navigationTitle("For grown-ups").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }.accessibilityIdentifier("family-store-close")
                }
            }
            .tint(teal)
        }
        .navigationViewStyle(.stack)
        .task { await store.load() }
        .onChange(of: scenePhase) { phase in
            if phase == .active && store.awaitingApproval { Task { await store.load() } }
        }
        .accessibilityIdentifier("family-storefront")
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
            VStack(spacing: 12) {
                ForEach(store.offers, id: \.productID) { offer in
                    Button { store.selectedProductID = offer.productID } label: {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Image(systemName: store.selectedProductID == offer.productID ? "largecircle.fill.circle" : "circle")
                                Text(title(offer)).font(.headline)
                                Spacer(minLength: 4)
                                if offer.kind == .monthly { Text("Recommended").font(.caption.weight(.bold)) }
                            }
                            Text(terms(offer)).font(.subheadline).multilineTextAlignment(.leading)
                        }
                        .padding(18).frame(maxWidth: .infinity, minHeight: 84, alignment: .leading)
                        .background(.white, in: RoundedRectangle(cornerRadius: 20))
                        .overlay(RoundedRectangle(cornerRadius: 20).stroke(store.selectedProductID == offer.productID ? teal : .clear, lineWidth: 2))
                    }.buttonStyle(.plain).disabled(store.busy)
                        .accessibilityAddTraits(store.selectedProductID == offer.productID ? .isSelected : [])
                        .accessibilityIdentifier("family-store-product-\(offer.kind.rawValue)")
                }
                if let offer = store.selectedOffer {
                    Button { Task { await store.purchaseSelected() } } label: {
                        HStack {
                            if store.operation == .purchasing { ProgressView().tint(.white) }
                            Text(buttonTitle(offer)).font(.headline).multilineTextAlignment(.center)
                        }.frame(maxWidth: .infinity, minHeight: 54)
                    }.buttonStyle(.borderedProminent).disabled(!store.canPurchase)
                        .accessibilityIdentifier("family-store-buy")
                    Text(renewal(offer)).font(.footnote).foregroundStyle(.secondary)
                        .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    private var teal: Color { Color(red: 0.12, green: 0.43, blue: 0.41) }
    private func title(_ offer: FamilyStoreOffer) -> String {
        switch offer.kind { case .monthly: return "Monthly"; case .annual: return "Yearly"; case .lifetime: return "One payment" }
    }
    private func cadence(_ offer: FamilyStoreOffer) -> String { offer.kind == .annual ? "a year" : "a month" }
    private func duration(_ period: FamilyStorePeriod) -> String {
        let n = period.unit == .week ? period.count * 7 : period.count
        let unit = period.unit == .week ? "day" : period.unit.rawValue
        return "\(n) \(unit)\(n == 1 ? "" : "s")"
    }
    private func terms(_ offer: FamilyStoreOffer) -> String {
        switch offer.terms {
        case .onePayment: return "\(offer.localizedPrice). Yours forever. No subscription."
        case .chargedToday: return "\(offer.localizedPrice) \(cadence(offer)), charged today."
        case .freeTrial(let period, let sure):
            if sure { return "\(duration(period)) free, then \(offer.localizedPrice) \(cadence(offer))." }
            return "Only new subscribers get \(duration(period)) free. Otherwise Apple charges \(offer.localizedPrice) today. Apple shows your exact terms before you confirm."
        }
    }
    private func buttonTitle(_ offer: FamilyStoreOffer) -> String {
        switch offer.terms {
        case .onePayment: return "Get Sona Premium — \(offer.localizedPrice)"
        case .freeTrial(_, let sure) where sure: return "Start free trial"
        default: return "Subscribe — \(offer.localizedPrice) \(cadence(offer))"
        }
    }
    private func renewal(_ offer: FamilyStoreOffer) -> String {
        if offer.kind == .lifetime { return "One payment of \(offer.localizedPrice). No subscription." }
        return "Renews at \(offer.localizedPrice) \(cadence(offer)) unless cancelled. Manage or cancel in your Apple Account settings."
    }
}
#endif

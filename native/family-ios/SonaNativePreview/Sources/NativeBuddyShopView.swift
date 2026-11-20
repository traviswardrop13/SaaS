import SwiftUI
import SonaFamilyMigration
import SonaFamilyRules

private struct NativeBuddyShop: Decodable {
    let coins: Int
    let items: [Item]

    enum Category: String, CaseIterable, Decodable {
        case characters, outfits, backdrops
        var title: String {
            switch self { case .characters: return "Buddies"; case .outfits: return "Hats"; case .backdrops: return "Places" }
        }
    }

    struct Item: Decodable, Identifiable {
        enum Availability: String, Decodable { case owned, buy, road }
        let kind: Category
        let id, name, emoji: String
        let cost, stop: Int?
        let state: Availability
        let equipped: Bool

        var asset: String {
            switch kind {
            case .characters: return "buddy-" + id
            case .outfits: return "hat-" + id
            case .backdrops: return "customize-" + id
            }
        }
        var detail: String {
            if equipped { return "Selected" }
            switch state {
            case .owned: return "Choose"
            case .buy: return cost.map { "\($0) coins" } ?? "Shop"
            case .road: return stop.map { "Trophy Road · Stop \($0)" } ?? "Trophy Road"
            }
        }
    }

    struct Update: Decodable { let accepted: Bool; let shop: NativeBuddyShop }
}

struct NativeBuddyShopView: View {
    @ObservedObject var records: NativeFamilyState
    @Environment(\.dismiss) private var dismiss
    @State private var shop: NativeBuddyShop?
    @State private var category = NativeBuddyShop.Category.characters
    @State private var message: String?
    @State private var busy = false
    @State private var purchase: NativeBuddyShop.Item?

    var body: some View {
        SonaNavigation {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if let shop {
                        Label("\(shop.coins) coins", systemImage: "sparkle")
                            .font(.system(.title2, design: .rounded).weight(.heavy))
                        Picker("Pick a collection", selection: $category) {
                            ForEach(NativeBuddyShop.Category.allCases, id: \.self) { Text($0.title).tag($0) }
                        }
                        .pickerStyle(.segmented)
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 125), spacing: 12)], spacing: 12) {
                            ForEach(shop.items.filter { $0.kind == category }) { item in card(item) }
                        }
                    } else if message == nil {
                        ProgressView("Opening the Buddy Shop")
                    } else {
                        Button("Try again") { Task { await load() } }
                    }
                    if let message { Text(message).font(.footnote).accessibilityAddTraits(.updatesFrequently) }
                }
                .padding(20)
                .frame(maxWidth: 650)
                .frame(maxWidth: .infinity)
            }
            .background(SonaPalette.paper.ignoresSafeArea())
            .foregroundStyle(SonaPalette.ink)
            .tint(SonaPalette.teal)
            .navigationTitle("Buddy Shop")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Done") { dismiss() } } }
            .confirmationDialog("Spend coins?", isPresented: Binding(get: { purchase != nil }, set: { if !$0 { purchase = nil } }),
                                presenting: purchase) { item in
                Button("Get \(item.name)") { Task { await apply(.buy, item: item) } }
                Button("Cancel", role: .cancel) { purchase = nil }
            } message: { item in Text(item.detail) }
        }
        .task(id: records.activeID) { await load() }
    }

    private func card(_ item: NativeBuddyShop.Item) -> some View {
        Button {
            switch item.state {
            case .owned: Task { await apply(.equip, item: item) }
            case .buy: purchase = item
            case .road: break
            }
        } label: {
            VStack(spacing: 6) {
                if item.id == "none", item.kind == .outfits {
                    Image(systemName: "minus.circle").font(.title)
                        .frame(height: 82).accessibilityHidden(true)
                } else {
                    Image(item.asset).resizable().scaledToFit().frame(height: 82).accessibilityHidden(true)
                }
                Text(item.name).font(.system(.headline, design: .rounded).weight(.bold))
                Text(item.detail).font(.caption).foregroundStyle(SonaPalette.muted)
            }
            .padding(10)
            .frame(maxWidth: .infinity, minHeight: 138)
            .background(.white, in: RoundedRectangle(cornerRadius: 20))
        }
        .buttonStyle(SonaPressStyle())
        .disabled(busy || item.equipped || item.state == .road)
        .accessibilityAddTraits(item.equipped ? .isSelected : [])
    }

    private func load() async {
        message = nil
        do { shop = try await records.read(.shop) }
        catch { message = "Sona couldn’t open the Buddy Shop." }
    }

    private func apply(_ operation: NativeFamilyRules.Operation, item: NativeBuddyShop.Item) async {
        guard !busy, let owner = records.activeID else { return }
        busy = true
        message = nil
        defer { busy = false }
        do {
            let update: NativeBuddyShop.Update = try await records.write(operation, input: .init(id: item.id, kind: item.kind.rawValue),
                                                                         owner: owner, receipt: UUID().uuidString)
            guard owner == records.activeID else { return }
            shop = update.shop
            if !update.accepted { message = operation == .buy ? "You don’t have enough coins for this yet." : "This item isn’t ready to wear." }
        } catch { message = "Sona couldn’t save that change. Try again." }
    }
}

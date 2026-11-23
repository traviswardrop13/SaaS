import SwiftUI
import SonaFamilyMigration
import SonaFamilyRules

private struct NativeBuddyShop: Decodable {
    let coins: Int
    let refundUntil: Double?
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
    @State private var purchase: Purchase?
    @State private var pending: Pending?
    @State private var loadedOwner: NativeFamilyChildID?
    @State private var loadGeneration = UUID()

    private struct Purchase { let owner: NativeFamilyChildID; let item: NativeBuddyShop.Item }
    private struct Pending {
        let owner: NativeFamilyChildID
        let operation: NativeFamilyRules.Operation
        let item: NativeBuddyShop.Item?
        let receipt = UUID().uuidString
    }

    var body: some View {
        SonaNavigation {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if let shop {
                        Label("\(shop.coins) coins", systemImage: "sparkle")
                            .font(.system(.title2, design: .rounded).weight(.heavy))
                        if let until = shop.refundUntil {
                            TimelineView(.periodic(from: .now, by: 0.2)) { clock in
                                if clock.date.timeIntervalSince1970 * 1000 <= until {
                                    Button("Oops? Give it back") {
                                        let owner = loadedOwner
                                        Task { await begin(.undoBuy, owner: owner) }
                                    }
                                    .buttonStyle(.bordered)
                                    .disabled(busy || pending != nil)
                                    .accessibilityIdentifier("buddy-shop-undo")
                                }
                            }
                        }
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
                    if let pending {
                        Button("Try saving again") { Task { await perform(pending) } }
                            .disabled(busy).accessibilityIdentifier("buddy-shop-retry-save")
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
                                presenting: purchase) { selection in
                Button("Get \(selection.item.name)") { Task { await begin(.buy, item: selection.item, owner: selection.owner) } }
                Button("Cancel", role: .cancel) { purchase = nil }
            } message: { selection in Text(selection.item.detail) }
        }
        .task(id: records.activeID) { await load() }
    }

    private func card(_ item: NativeBuddyShop.Item) -> some View {
        Button {
            guard let owner = loadedOwner, owner == records.activeID else { return }
            switch item.state {
            case .owned: Task { await begin(.equip, item: item, owner: owner) }
            case .buy:
                purchase = Purchase(owner: owner, item: item)
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
        .disabled(busy || pending != nil || item.equipped || item.state == .road)
        .accessibilityAddTraits(item.equipped ? .isSelected : [])
    }

    private func load() async {
        let owner = records.activeID, generation = UUID()
        loadGeneration = generation
        if loadedOwner != owner {
            loadedOwner = owner; shop = nil; pending = nil; purchase = nil
        }
        message = nil
        do {
            let current: NativeBuddyShop = try await records.read(.shop)
            guard !Task.isCancelled, generation == loadGeneration, owner == records.activeID else { return }
            shop = current
        } catch {
            guard !Task.isCancelled, generation == loadGeneration, owner == records.activeID else { return }
            message = "Sona couldn’t open the Buddy Shop."
        }
    }

    private func begin(_ operation: NativeFamilyRules.Operation, item: NativeBuddyShop.Item? = nil,
                       owner: NativeFamilyChildID?) async {
        guard !busy, pending == nil, let owner, owner == records.activeID, loadedOwner == owner else { return }
        let action = Pending(owner: owner, operation: operation, item: item)
        pending = action
        await perform(action)
    }

    private func perform(_ action: Pending) async {
        guard !busy, action.owner == records.activeID, loadedOwner == action.owner,
              pending?.receipt == action.receipt else { return }
        busy = true; message = nil
        defer { busy = false }
        do {
            let input = action.item.map { NativeRuleFields(id: $0.id, kind: $0.kind.rawValue) } ?? NativeRuleFields()
            let update: NativeBuddyShop.Update = try await records.write(action.operation, input: input,
                owner: action.owner, receipt: action.receipt)
            guard action.owner == records.activeID, pending?.receipt == action.receipt else { return }
            shop = update.shop; pending = nil
            if !update.accepted {
                switch action.operation {
                case .buy: message = "You don’t have enough coins for this yet."
                case .undoBuy: message = "That purchase can’t be given back now."
                default: message = "This item isn’t ready to wear."
                }
            }
        } catch NativeFamilyRuleError.replayed {
            // The receipt and ledger share the atomic commit. A lost save
            // acknowledgement reads that saved state, never buys/refunds again.
            do {
                let current: NativeBuddyShop = try await records.read(.shop)
                guard action.owner == records.activeID, pending?.receipt == action.receipt else { return }
                shop = current; pending = nil
            } catch { showSaveFailure(for: action) }
        } catch { showSaveFailure(for: action) }
    }

    private func showSaveFailure(for action: Pending) {
        guard action.owner == records.activeID, pending?.receipt == action.receipt else { return }
        message = "Sona couldn’t save that change. Try again."
    }
}

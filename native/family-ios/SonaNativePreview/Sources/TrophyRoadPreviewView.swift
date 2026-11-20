import SwiftUI

struct TrophyRoadPreviewView: View {
    @State private var path: Path = .lifetime

    private enum Path: String, CaseIterable {
        case lifetime = "Trophy Road"
        case monthly = "Monthly path"
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Trophies unlock gifts as you practice.")
                    .font(.headline)
                Text("This preview shows the rewards along the way.")
                    .foregroundStyle(SonaPalette.muted)
                Picker("Reward path", selection: $path) {
                    ForEach(Path.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                if let catalog = RewardRoadCatalog.bundled {
                    road(catalog)
                } else {
                    Label("The reward paths couldn’t load.", systemImage: "exclamationmark.circle")
                }
            }
            .padding(20)
            .frame(maxWidth: 600, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .center)
        }
        .background(SonaPalette.paper.ignoresSafeArea())
        .foregroundStyle(SonaPalette.ink)
        .navigationTitle("Trophy Road")
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("trophy-road-preview")
    }

    private func road(_ catalog: RewardRoadCatalog) -> some View {
        LazyVStack(alignment: .leading, spacing: 11) {
            if path == .monthly {
                ForEach(catalog.monthly) { reward in
                    stop(reward, lands: catalog.lands)
                }
            } else {
                ForEach(catalog.lands) { land in
                    landCover(land)
                    ForEach(catalog.stops(for: land)) { reward in
                        stop(reward, lands: catalog.lands)
                    }
                }
            }
        }
    }

    private func landCover(_ land: RewardRoadCatalog.Land) -> some View {
        ZStack(alignment: .bottomLeading) {
            Image(land.art)
                .resizable()
                .scaledToFill()
                .frame(height: 125)
                .frame(maxWidth: .infinity)
                .clipped()
                .accessibilityHidden(true)

            Text(land.name)
                .font(.system(.title3, design: .rounded, weight: .heavy))
                .padding(9)
                .foregroundStyle(SonaPalette.ink)
                .background(.white, in: RoundedRectangle(cornerRadius: 8))
                .padding(12)
                .accessibilityAddTraits(.isHeader)
        }
        .background(SonaPalette.mint)
        .clipShape(RoundedRectangle(cornerRadius: 21))
        .padding(.top, 4)
    }

    private func stop(_ reward: RewardRoadCatalog.Stop, lands: [RewardRoadCatalog.Land]) -> some View {
        HStack(alignment: .center, spacing: 13) {
            Image(systemName: reward.big == true ? "gift.fill" : "trophy.fill")
                .font(.system(.headline, weight: .semibold))
                .frame(width: 37, height: 37)
                .background(SonaPalette.yellow, in: Circle())
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                Text("\(reward.at) trophies").font(.system(.headline, design: .rounded, weight: .heavy))
                Text(reward.gift.compactMap { $0.label(lands: lands) }.joined(separator: "  ·  "))
                    .font(.subheadline)
                    .foregroundStyle(SonaPalette.muted)
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.white, in: RoundedRectangle(cornerRadius: 16))
        .accessibilityElement(children: .combine)
    }
}

private struct RewardRoadCatalog: Decodable {
    struct Land: Decodable, Identifiable {
        let id: String
        let name: String
        let from: Int
        let art: String
    }

    struct Stop: Decodable, Identifiable {
        let n: Int
        let at: Int
        let big: Bool?
        let gift: [Gift]
        var id: Int { n }
    }

    struct Gift: Decodable {
        let coins: Int?
        let sticker: Int?
        let level: Int?
        let land: String?
        let buddy: String?
        let hat: String?
        let place: String?

        func label(lands: [Land]) -> String? {
            if let coins { return "\(coins) coins" }
            if sticker != nil { return "Sticker" }
            if let level { return "Game level \(level)" }
            if let land { return lands.first { $0.id == land }?.name }
            if buddy != nil { return "Buddy" }
            if hat != nil { return "Hat" }
            if place != nil { return "Place" }
            return nil
        }
    }

    let version: Int
    let lands: [Land]
    let stops: [Stop]
    let monthly: [Stop]

    static let bundled: Self? = {
        guard let url = Bundle.main.url(forResource: "Rewards", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let catalog = try? JSONDecoder().decode(Self.self, from: data),
              catalog.version == 1 else { return nil }
        return catalog
    }()

    func stops(for land: Land) -> [Stop] {
        let ceiling = lands.first { $0.from > land.from }?.from ?? Int.max
        return stops.filter { $0.at >= land.from && $0.at < ceiling }
    }
}

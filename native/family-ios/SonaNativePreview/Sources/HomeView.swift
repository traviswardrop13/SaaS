import SwiftUI

enum SonaPalette {
    static let paper = Color(red: 1, green: 0.972, blue: 0.927)
    static let ink = Color(red: 0.12, green: 0.20, blue: 0.20)
    static let muted = Color(red: 0.31, green: 0.37, blue: 0.34)
    static let teal = Color(red: 0.01, green: 0.38, blue: 0.38)
    static let mint = Color(red: 0.81, green: 0.91, blue: 0.82)
    static let lavender = Color(red: 0.90, green: 0.86, blue: 0.99)
    static let yellow = Color(red: 1, green: 0.88, blue: 0.56)
}

struct SonaPressStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed ? 0.83 : 1)
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.98 : 1)
            .animation(reduceMotion ? nil : .easeOut(duration: 0.13), value: configuration.isPressed)
    }
}

struct HomeView: View {
    @Binding var buddy: PreviewBuddy
    let targetSound: String
    let completedGames: Set<String>
    let dailyStory: NativeAdventure?
    let storyAccess: Bool
    let onAdventure: () -> Void
    let onOpen: (Destination) -> Void
    let onGrownUps: () -> Void
    let onBuddy: () -> Void
    let onCollection: () -> Void

    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        ViewThatFits(in: .vertical) {
            contents
            ScrollView { contents }
                .scrollIndicators(.hidden)
        }
        .frame(maxHeight: .infinity, alignment: .top)
        .background(SonaPalette.paper.ignoresSafeArea())
        .foregroundStyle(SonaPalette.ink)
    }

    private var contents: some View {
        VStack(alignment: .leading, spacing: 15) {
            header

            if !targetSound.isEmpty {
                Label("Your sound · \(targetSound == "THV" ? "TH (v)" : targetSound)", systemImage: "waveform")
                    .font(.system(.subheadline, design: .rounded, weight: .semibold))
                    .foregroundStyle(SonaPalette.teal)
                    .accessibilityIdentifier("home-target-sound")
            }

            if let dailyStory {
                adventureCard(dailyStory)
            }

            if typeSize.isAccessibilitySize {
                VStack(spacing: 12) { quickLinks }
            } else {
                HStack(spacing: 12) { quickLinks }
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 10)
        .padding(.bottom, 18)
        .frame(maxWidth: 560)
        .frame(maxWidth: .infinity)
    }

    private var header: some View {
        HStack(spacing: 8) {
            Button(action: onBuddy) {
                Image(buddy.asset)
                    .resizable()
                    .scaledToFit()
                    .padding(4)
                    .frame(width: 48, height: 48)
                    .background(SonaPalette.yellow, in: Circle())
            }
            .buttonStyle(SonaPressStyle())
            .accessibilityLabel("Choose your buddy")
            .accessibilityValue(buddy.title)

            Text("Sona")
                .font(.system(.title, design: .rounded, weight: .heavy))
                .accessibilityAddTraits(.isHeader)

            Spacer(minLength: 2)

            Button(action: onCollection) {
                Image("road-chest")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 32, height: 32)
                    .frame(width: 46, height: 46)
                    .background(.white.opacity(0.72), in: Circle())
                    .overlay(alignment: .topTrailing) {
                        if !completedGames.isEmpty {
                            Image(systemName: "star.circle.fill")
                                .font(.system(size: 17))
                                .foregroundStyle(SonaPalette.teal, SonaPalette.yellow)
                        }
                    }
            }
            .buttonStyle(SonaPressStyle())
            .accessibilityLabel("Play collection")
            .accessibilityIdentifier("home-collection")

            Button(action: onGrownUps) {
                Label("Grown-ups", systemImage: "lock.fill")
                    .font(.system(.caption, design: .rounded, weight: .bold))
                    .padding(.horizontal, 12)
                    .frame(minHeight: 46)
                    .background(.white.opacity(0.72), in: Capsule())
                    .contentShape(Capsule())
            }
            .buttonStyle(SonaPressStyle())
            .accessibilityIdentifier("home-grownups")
        }
    }

    private func adventureCard(_ story: NativeAdventure) -> some View {
        Button(action: onAdventure) {
            VStack(alignment: .leading, spacing: 0) {
                Image("daily-\(story.id)")
                    .resizable()
                    .scaledToFill()
                    .frame(height: 188)
                    .frame(maxWidth: .infinity)
                    .clipped()
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)

                HStack(alignment: .center, spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Today’s adventure")
                            .font(.system(.caption, design: .rounded, weight: .bold))
                        Text(story.title)
                            .font(.system(.title2, design: .rounded, weight: .heavy))
                        Text(storyAccess ? "Open story preview" : "Premium")
                            .font(.system(.subheadline, design: .rounded, weight: .medium))
                            .foregroundStyle(.white.opacity(0.87))
                    }
                    Spacer(minLength: 6)
                    Image(systemName: storyAccess ? "play.fill" : "lock.fill")
                        .font(.system(size: 22, weight: .bold))
                        .frame(width: 50, height: 50)
                        .background(.white.opacity(0.16), in: Circle())
                        .accessibilityHidden(true)
                }
                .padding(16)
                .foregroundStyle(.white)
                .background(SonaPalette.teal)
            }
            .clipShape(RoundedRectangle(cornerRadius: 26))
            .contentShape(RoundedRectangle(cornerRadius: 26))
        }
        .buttonStyle(SonaPressStyle())
        .accessibilityIdentifier("home-adventure")
    }

    @ViewBuilder
    private var quickLinks: some View {
        quickLink(.games, title: "Games", symbol: "gamecontroller.fill", accent: SonaPalette.mint)
        quickLink(.books, title: "Books", symbol: "book.fill", accent: SonaPalette.lavender)
    }

    private func quickLink(_ destination: Destination, title: String, symbol: String, accent: Color) -> some View {
        Button {
            onOpen(destination)
        } label: {
            HStack(spacing: 9) {
                Image(systemName: symbol)
                    .font(.system(.body, weight: .bold))
                    .accessibilityHidden(true)
                Text(title)
                    .font(.system(.headline, design: .rounded, weight: .heavy))
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 13)
            .frame(minHeight: 63)
            .background(accent, in: RoundedRectangle(cornerRadius: 19))
        }
        .buttonStyle(SonaPressStyle())
        .accessibilityIdentifier(destination == .games ? "home-games" : "home-books")
    }
}

struct HomeBuddySheet: View {
    @Binding var buddy: PreviewBuddy
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 12) {
                    ForEach(PreviewBuddy.allCases) { option in
                        Button {
                            buddy = option
                            dismiss()
                        } label: {
                            HStack(spacing: 16) {
                                Image(option.asset)
                                    .resizable()
                                    .scaledToFit()
                                    .frame(width: 65, height: 65)
                                    .accessibilityHidden(true)
                                Text(option.title)
                                    .font(.system(.title3, design: .rounded, weight: .heavy))
                                Spacer()
                                if option == buddy {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(SonaPalette.teal)
                                        .accessibilityHidden(true)
                                }
                            }
                            .padding(10)
                            .padding(.horizontal, 6)
                            .background(.white, in: RoundedRectangle(cornerRadius: 18))
                        }
                        .buttonStyle(SonaPressStyle())
                        .accessibilityAddTraits(option == buddy ? .isSelected : [])
                    }
                }
                .padding(20)
            }
            .background(SonaPalette.paper)
            .foregroundStyle(SonaPalette.ink)
            .navigationTitle("Choose your buddy")
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Done") { dismiss() } } }
        }
    }
}

struct PlayCollectionView: View {
    let completedGames: Set<String>
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    NavigationLink {
                        TrophyRoadPreviewView()
                    } label: {
                        HStack(alignment: .center, spacing: 12) {
                            Image("road-chest").resizable().scaledToFit().frame(width: 42, height: 42)
                                .accessibilityHidden(true)
                            Text("Trophy Road").font(.system(.headline, design: .rounded, weight: .heavy))
                            Spacer()
                            Image(systemName: "chevron.right").accessibilityHidden(true)
                        }
                        .foregroundStyle(SonaPalette.ink)
                        .padding(12)
                        .background(SonaPalette.yellow, in: RoundedRectangle(cornerRadius: 16))
                    }
                    .accessibilityIdentifier("collection-trophy-road")

                    if completedGames.isEmpty {
                        Label("Finish a game to add it here.", systemImage: "star")
                            .font(.system(.body, design: .rounded))
                            .padding(16)
                    } else {
                        ForEach(NativeGame.allCases.filter { completedGames.contains($0.id) }) { game in
                            Label(game.title, systemImage: "star.circle.fill")
                                .font(.system(.headline, design: .rounded, weight: .bold))
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(16)
                                .background(.white, in: RoundedRectangle(cornerRadius: 16))
                        }
                    }
                }
                .padding(20)
            }
            .background(SonaPalette.paper)
            .navigationTitle("Play collection")
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
    }
}

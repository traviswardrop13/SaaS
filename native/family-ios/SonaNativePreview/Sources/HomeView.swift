import SwiftUI
import UIKit

enum SonaPalette {
    static let paper = Color(red: 1, green: 0.972, blue: 0.927)
    static let ink = Color(red: 0.12, green: 0.20, blue: 0.20)
    static let muted = Color(red: 0.31, green: 0.37, blue: 0.34)
    static let teal = Color(red: 0.01, green: 0.38, blue: 0.38)
    static let mint = Color(red: 0.81, green: 0.91, blue: 0.82)
    static let lavender = Color(red: 0.90, green: 0.86, blue: 0.99)
    static let yellow = Color(red: 1, green: 0.88, blue: 0.56)
}

extension Color {
    var tileGradient: LinearGradient {
        LinearGradient(colors: [opacity(0.76), self], startPoint: .top, endPoint: .bottom)
    }
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
    let buddy: PreviewBuddy
    let targetSound: String
    let completedGames: Set<String>
    var goal: NativePracticeSummary.Goal?
    let dailyStory: NativeAdventure?
    var dailyGame: NativeGame?
    var adventureDone = false
    var home: NativeHomePresentation? = nil
    let storyAccess: Bool
    let onAdventure: () -> Void
    let onOpen: (Destination) -> Void
    let onGrownUps: () -> Void
    let onBuddy: () -> Void
    let onCollection: () -> Void

    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        homeLayout
        .frame(maxHeight: .infinity, alignment: .top)
        .background(SonaPalette.paper.ignoresSafeArea())
        .foregroundStyle(SonaPalette.ink)
    }

    @ViewBuilder
    private var homeLayout: some View {
        if #available(iOS 16, *) {
            ViewThatFits(in: .vertical) {
                contents
                ScrollView(showsIndicators: false) { contents }
            }
        } else {
            ScrollView(showsIndicators: false) { contents }
        }
    }

    private var contents: some View {
        VStack(alignment: .leading, spacing: 15) {
            header

            if !targetSound.isEmpty || goal != nil {
                HStack(spacing: 12) {
                    if !targetSound.isEmpty {
                        Label("Your sound · \(targetSound == "THV" ? "TH (v)" : targetSound)", systemImage: "waveform")
                            .accessibilityIdentifier("home-target-sound")
                    }
                    Spacer(minLength: 0)
                    if let goal, goal.goal > 0 {
                        Label(goal.done ? "Goal reached" : "\(goal.n) / \(goal.goal)",
                              systemImage: goal.done ? "checkmark.circle.fill" : "target")
                            .accessibilityLabel("Today’s goal, \(goal.n) of \(goal.goal) reps")
                            .accessibilityIdentifier("home-daily-goal")
                    }
                }
                .font(.system(.subheadline, design: .rounded).weight(.semibold))
                .foregroundStyle(SonaPalette.teal)
            }

            // Today's story leads, as on the approved web Home; the two painted
            // doors sit under it. Practice keeps its tab, so it has no bar here.
            if let home {
                if let card = home.card {
                    adventureCard(card.title, artwork: "echo-welcome", open: !card.locked, card: card)
                }
            } else if let dailyStory {
                adventureCard(dailyStory.title, artwork: "daily-\(dailyStory.id)", open: storyAccess)
            } else if let dailyGame {
                adventureCard(dailyGame.title, artwork: dailyGame.cover, open: true)
            }

            if typeSize.isAccessibilitySize {
                VStack(spacing: 12) { doors }
            } else {
                HStack(alignment: .top, spacing: 12) { doors }
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
                .font(.system(.title, design: .rounded).weight(.heavy))
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
                    .font(.system(.caption, design: .rounded).weight(.bold))
                    .padding(.horizontal, 12)
                    .frame(minHeight: 46)
                    .background(.white.opacity(0.72), in: Capsule())
                    .contentShape(Capsule())
            }
            .buttonStyle(SonaPressStyle())
            .accessibilityIdentifier("home-grownups")
        }
    }

    private func adventureCard(_ title: String, artwork: String, open: Bool,
                               card: NativeHomePresentation.Card? = nil) -> some View {
        let done = card?.done ?? adventureDone
        return Button {
            guard !done else { return }
            onAdventure()
        } label: {
            VStack(alignment: .leading, spacing: 0) {
                Group {
                    if let card { NativeHomeArtwork(paths: card.imagePaths) }
                    else { Image(artwork).resizable().scaledToFill() }
                }
                .frame(height: 236).frame(maxWidth: .infinity).clipped()
                .overlay(done ? Color.black.opacity(0.5) : Color.clear)
                .allowsHitTesting(false).accessibilityHidden(true)

                HStack(alignment: .center, spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: 8) {
                            Text(card?.label ?? "Today’s adventure")
                                .font(.system(.caption, design: .rounded).weight(.bold))
                            if card?.locked == true { Text("Premium").font(.caption.weight(.bold)) }
                        }
                        Text(title).font(.system(.title2, design: .rounded).weight(.heavy))
                        if let hook = card?.hook, !hook.isEmpty {
                            Text(hook).font(.system(.subheadline, design: .rounded))
                                .fixedSize(horizontal: false, vertical: true)
                                .accessibilityIdentifier("home-adventure-hook")
                        }
                        Text(done ? "Come back tomorrow!" : card?.actionLabel ?? (open ? "Start today" : "Premium"))
                            .font(.system(.subheadline, design: .rounded).weight(.medium))
                            .foregroundStyle(.white.opacity(0.87))
                            .accessibilityIdentifier("home-adventure-action")
                    }
                    Spacer(minLength: 6)
                    Image(systemName: done ? "lock.fill" : open ? "play.fill" : "lock.fill")
                        .font(.system(size: 24, weight: .bold)).frame(width: 60, height: 60)
                        .foregroundStyle(done || !open ? Color.white : SonaPalette.teal)
                        .background(done || !open ? Color.white.opacity(0.16) : Color.white, in: Circle())
                        .accessibilityHidden(true)
                }
                .padding(16).foregroundStyle(.white).background(SonaPalette.teal)
            }
            .clipShape(RoundedRectangle(cornerRadius: 26)).contentShape(RoundedRectangle(cornerRadius: 26))
        }
        .buttonStyle(SonaPressStyle()).disabled(done).accessibilityIdentifier("home-adventure")
    }

    @ViewBuilder
    private var doors: some View {
        door(.games, title: "Games", artwork: "home-arcade", accent: SonaPalette.lavender, tag: nil, identifier: "home-games")
        door(.books, title: "Books", artwork: "home-books", accent: SonaPalette.yellow, tag: home?.booksTag, identifier: "home-books")
    }

    /// A painted door: the picture on top, one big word under it. A child who
    /// cannot read still knows which is which.
    private func door(_ destination: Destination, title: String, artwork: String, accent: Color, tag: String?,
                      identifier: String) -> some View {
        Button {
            onOpen(destination)
        } label: {
            VStack(alignment: .leading, spacing: 0) {
                Image(artwork).resizable().scaledToFill()
                    .frame(height: 92).frame(maxWidth: .infinity).clipped()
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(.title3, design: .rounded).weight(.heavy))
                    if let tag {
                        Text(tag)
                            .font(.caption.weight(.semibold))
                            .fixedSize(horizontal: false, vertical: true)
                            .accessibilityIdentifier("home-books-tag")
                    }
                }
                .padding(.horizontal, 13).padding(.vertical, 9)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(accent)
            .clipShape(RoundedRectangle(cornerRadius: 22))
            .contentShape(RoundedRectangle(cornerRadius: 22))
            .shadow(color: .black.opacity(0.10), radius: 6, y: 3)
        }
        .buttonStyle(SonaPressStyle())
        .accessibilityIdentifier(identifier)
    }
}

/// Uses the same fixed source paths and bounded local artwork loader as Books.
private struct NativeHomeArtwork: View {
    let paths: [String]
    @State private var image: UIImage?
    private var requestID: String { paths.joined(separator: "|") }
    var body: some View {
        Group {
            if let image { Image(uiImage: image).resizable().scaledToFill() }
            else { Image("echo-welcome").resizable().scaledToFit() }
        }
        .task(id: requestID) {
            image = nil
            for path in paths {
                do {
                    let loaded = try await NativeArtworkLoader.shared.image(path: path)
                    guard !Task.isCancelled else { return }
                    image = loaded
                    return
                } catch is CancellationError { return }
                catch { if Task.isCancelled { return } }
            }
        }
    }
}

struct HomeBuddySheet: View {
    @Binding var buddy: PreviewBuddy
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        SonaNavigation {
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
                                    .font(.system(.title3, design: .rounded).weight(.heavy))
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
        SonaNavigation {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    NavigationLink {
                        TrophyRoadPreviewView()
                    } label: {
                        HStack(alignment: .center, spacing: 12) {
                            Image("road-chest").resizable().scaledToFit().frame(width: 42, height: 42)
                                .accessibilityHidden(true)
                            Text("Trophy Road").font(.system(.headline, design: .rounded).weight(.heavy))
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
                                .font(.system(.headline, design: .rounded).weight(.bold))
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

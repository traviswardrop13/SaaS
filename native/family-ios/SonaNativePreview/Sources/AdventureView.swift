import SwiftUI

/// Native browsing of the canonical adventure illustrations and captions.
/// This preview never records a speech attempt, finishes a production quest,
/// awards a sticker, or substitutes a tap for a heard word. The host owns
/// access checks and the separate preview-completion callback.
struct AdventureView: View {
    let targetSound: String
    let day: Int
    var isSimple = false
    let onComplete: () -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(\.dynamicTypeSize) private var typeSize
    @State private var stories: [NativeAdventure] = []
    @State private var failed = false
    @State private var loaded = false
    @State private var phase: AdventurePhase = .cover
    @State private var page = 0
    @State private var reportedCompletion = false
    @State private var showGame = false
    @State private var gameFinished = false

    private var story: NativeAdventure? {
        NativeAdventureCatalog.story(in: stories, day: day, targetSound: targetSound)
    }

    private var intro: [NativeAdventurePage] { story?.intro.filter { !isSimple || $0.ages != "big" } ?? [] }
    private var ending: [NativeAdventurePage] { story?.ending.filter { !isSimple || $0.ages != "big" } ?? [] }
    private var pages: [NativeAdventurePage] { phase == .ending ? ending : intro }
    private var current: NativeAdventurePage? { pages.indices.contains(page) ? pages[page] : nil }
    private var hasGame: Bool {
        guard let key = story?.game else { return false }
        return NativeStoryGame(rawValue: key) != nil || StoryVillageGame(rawValue: key) != nil
            || StoryWorkshopGame(rawValue: key) != nil
    }

    var body: some View {
        SonaNavigation {
            GeometryReader { geometry in
                Group {
                    if let story {
                        VStack(spacing: 0) {
                            HStack(spacing: 7) {
                                Image(systemName: "eye")
                                Text("Story preview")
                                Spacer()
                                Text("Day \(story.day)")
                            }
                            .font(.system(.caption, design: .rounded).weight(.bold))
                            .foregroundStyle(AdventureColors.secondary)
                            .padding(.horizontal, 22)
                            .padding(.vertical, 8)

                            if typeSize.isAccessibilitySize || geometry.size.height < 450 || phase == .gameBoundary || phase == .complete {
                                ScrollView { content(story, artHeight: 250).padding(.vertical, 8) }
                            } else {
                                content(story, artHeight: nil)
                                    .frame(maxHeight: .infinity)
                            }

                            controls(story)
                                .padding(.horizontal, 20)
                                .padding(.top, 14)
                                .padding(.bottom, 12)
                        }
                        .frame(maxWidth: 850)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else if !loaded {
                        ProgressView("Opening story")
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else {
                        VStack(spacing: 18) {
                            Image(systemName: "book.closed")
                                .font(.system(size: 36))
                                .foregroundStyle(AdventureColors.teal)
                            Text(failed ? "The story couldn’t open" : "No adventure for this day")
                                .font(.system(.title2, design: .rounded).weight(.bold))
                            if failed { Button("Try again", action: load) }
                            Button("Back home") { dismiss() }
                                .frame(minHeight: 44)
                        }
                        .multilineTextAlignment(.center)
                        .padding(24)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    }
                }
            }
            .background(AdventureColors.paper)
            .navigationTitle("Today’s adventure")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button { dismiss() } label: { Image(systemName: "xmark") }
                        .accessibilityLabel("Back home")
                        .accessibilityIdentifier("adventure-close")
                }
                if phase == .intro || phase == .ending {
                    ToolbarItem(placement: .primaryAction) {
                        Menu {
                            Button("Start from the beginning", action: start)
                        } label: {
                            Image(systemName: "ellipsis.circle")
                        }
                        .accessibilityLabel("Story options")
                    }
                }
            }
        }
        .fullScreenCover(isPresented: $showGame, onDismiss: {
            if gameFinished {
                page = 0
                phase = .ending
            }
        }) {
            if let key = story?.game {
                if let game = NativeStoryGame(rawValue: key) {
                    StoryGamesView(game: game) {
                        gameFinished = true
                        showGame = false
                    }
                } else if let game = StoryVillageGame(rawValue: key) {
                    StoryVillageGamesView(game: game) { gameFinished = true }
                } else if let game = StoryWorkshopGame(rawValue: key) {
                    StoryWorkshopGamesView(game: game) { gameFinished = true }
                }
            }
        }
        .tint(AdventureColors.teal)
        .preferredColorScheme(.light)
        .task { load() }
        .onChange(of: targetSound) { _ in reset() }
        .onChange(of: day) { _ in reset() }
    }

    @ViewBuilder
    private func content(_ story: NativeAdventure, artHeight: CGFloat?) -> some View {
        switch phase {
        case .cover:
            VStack(spacing: 18) {
                AdventureIllustration(path: story.cover, localName: "daily-\(story.id)")
                    .frame(height: artHeight)
                    .frame(maxHeight: artHeight == nil ? .infinity : nil)
                    .clipShape(RoundedRectangle(cornerRadius: 24))
                VStack(spacing: 12) {
                    Text(story.title)
                        .font(.system(.largeTitle, design: .rounded).weight(.heavy))
                        .accessibilityIdentifier("adventure-title")
                        .accessibilityAddTraits(.isHeader)
                    Text(story.hook)
                        .font(.system(.body, design: .rounded))
                        .foregroundStyle(AdventureColors.secondary)
                }
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, 6)
            }
            .padding(.horizontal, 20)
        case .intro, .ending:
            if let current {
                VStack(spacing: 12) {
                    AdventureIllustration(path: current.art)
                        .frame(height: artHeight)
                        .frame(maxWidth: .infinity, maxHeight: artHeight == nil ? .infinity : nil)
                        .clipShape(RoundedRectangle(cornerRadius: 22))
                    VStack(spacing: 12) {
                        Text(current.caption(simple: isSimple))
                            .font(.system(.title3, design: .rounded).weight(.semibold))
                            .multilineTextAlignment(.center)
                            .fixedSize(horizontal: false, vertical: true)
                            .accessibilityIdentifier("adventure-caption")
                        Text("\((phase == .ending ? intro.count : 0) + page + 1) / \(intro.count + ending.count)")
                            .font(.system(.caption, design: .rounded).weight(.medium))
                            .monospacedDigit()
                            .foregroundStyle(AdventureColors.secondary)
                            .accessibilityIdentifier("adventure-page-count")
                    }
                    .padding(20)
                    .frame(maxWidth: .infinity)
                    .background(.white.opacity(0.88), in: RoundedRectangle(cornerRadius: 22))
                }
                .foregroundStyle(AdventureColors.ink)
                .padding(.horizontal, 20)
            }
        case .gameBoundary:
            VStack(spacing: 22) {
                AdventureIllustration(path: story.cover, localName: "daily-\(story.id)")
                    .frame(height: artHeight ?? 190)
                    .clipShape(RoundedRectangle(cornerRadius: 22))
                Text(story.gameName)
                    .font(.system(.largeTitle, design: .rounded).weight(.heavy))
                    .accessibilityAddTraits(.isHeader)
                if hasGame {
                    Button("Preview the ending") { page = 0; phase = .ending }
                        .font(.system(.subheadline, design: .rounded).weight(.semibold))
                        .frame(minHeight: 44)
                        .accessibilityIdentifier("adventure-preview-ending")
                }
            }
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
            .padding(24)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        case .complete:
            VStack(spacing: 20) {
                AdventureIllustration(path: ending.last?.art ?? story.cover)
                    .frame(height: artHeight ?? 240)
                    .clipShape(RoundedRectangle(cornerRadius: 22))
                Text("Preview complete")
                    .font(.system(.largeTitle, design: .rounded).weight(.heavy))
                    .accessibilityAddTraits(.isHeader)
                    .accessibilityIdentifier("adventure-finished")
                Text(story.title)
                    .font(.system(.title3, design: .rounded))
                    .foregroundStyle(AdventureColors.secondary)
            }
            .multilineTextAlignment(.center)
            .padding(24)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private func controls(_ story: NativeAdventure) -> some View {
        HStack(spacing: 12) {
            if phase == .intro || phase == .gameBoundary || phase == .ending {
                Button(action: previous) {
                    Image(systemName: "arrow.left")
                        .font(.system(.body, design: .rounded).weight(.bold))
                        .frame(width: 52, height: 52)
                        .background(.white, in: RoundedRectangle(cornerRadius: 16))
                }
                .accessibilityLabel("Previous page")
                .accessibilityIdentifier("adventure-previous")
            } else if phase == .complete {
                Button("Read again", action: start)
                    .font(.system(.body, design: .rounded).weight(.bold))
                    .padding(.horizontal, 15)
                    .frame(minHeight: 52)
                    .background(.white, in: RoundedRectangle(cornerRadius: 16))
                    .accessibilityIdentifier("adventure-replay")
            }

            Button { advance(story) } label: {
                HStack(spacing: 10) {
                    Text(actionTitle)
                    Spacer(minLength: 4)
                    Image(systemName: phase == .complete ? "house" : "arrow.right")
                }
                .font(.system(.body, design: .rounded).weight(.bold))
                .foregroundStyle(.white)
                .padding(.horizontal, 18)
                .padding(.vertical, 14)
                .frame(maxWidth: .infinity, minHeight: 52)
                .background(AdventureColors.teal, in: RoundedRectangle(cornerRadius: 16))
            }
            .accessibilityIdentifier(actionIdentifier)
        }
        .buttonStyle(.plain)
    }

    private var actionTitle: String {
        switch phase {
        case .cover: return "Tap to start"
        case .gameBoundary: return hasGame ? "Play the game" : "Preview the ending"
        case .complete: return "Back home"
        case .intro, .ending: return "Next"
        }
    }

    private var actionIdentifier: String {
        if phase == .complete { return "adventure-complete" }
        if phase == .gameBoundary { return hasGame ? "adventure-play-game" : "adventure-preview-ending" }
        return "adventure-next"
    }

    private func advance(_ story: NativeAdventure) {
        switch phase {
        case .cover: start()
        case .intro:
            if page + 1 < intro.count { page += 1 }
            else { page = 0; phase = story.talk ? .ending : .gameBoundary }
        case .gameBoundary:
            if hasGame {
                gameFinished = false
                showGame = true
            } else {
                page = 0
                phase = .ending
            }
        case .ending:
            if page + 1 < ending.count { page += 1 }
            else { phase = .complete }
        case .complete:
            if !reportedCompletion { reportedCompletion = true; onComplete() }
            dismiss()
        }
    }

    private func previous() {
        if page > 0 {
            page -= 1
        } else if phase == .ending, story?.talk != true {
            phase = .gameBoundary
        } else if phase == .ending || phase == .gameBoundary {
            phase = .intro
            page = max(0, intro.count - 1)
        } else {
            phase = .cover
        }
    }

    private func start() { page = 0; phase = .intro }
    private func reset() { page = 0; phase = .cover; reportedCompletion = false }

    private func load() {
        defer { loaded = true }
        do {
            stories = try NativeAdventureCatalog.bundled.get().stories
            failed = false
        } catch { failed = true }
    }
}

private enum AdventurePhase { case cover, intro, gameBoundary, ending, complete }
private enum AdventureLoadError: Error { case unavailable }

struct NativeAdventureCatalog: Decodable {
    let version: Int
    let stories: [NativeAdventure]

    static let bundled = Result {
        let url = Bundle.main.url(forResource: "Adventures", withExtension: "json", subdirectory: "Content")
            ?? Bundle.main.url(forResource: "Adventures", withExtension: "json")
        guard let url else { throw AdventureLoadError.unavailable }
        let catalog = try JSONDecoder().decode(Self.self, from: Data(contentsOf: url))
        guard catalog.version == 1, !catalog.stories.isEmpty,
              Set(catalog.stories.map(\.id)).count == catalog.stories.count,
              catalog.stories.allSatisfy({ !$0.intro.isEmpty && !$0.ending.isEmpty }) else { throw AdventureLoadError.unavailable }
        return catalog
    }

    static func story(in stories: [NativeAdventure], day: Int, targetSound: String) -> NativeAdventure? {
        story(in: stories, day: day, targetSounds: [targetSound])
    }

    static func story(in stories: [NativeAdventure], day: Int, targetSounds: [String]) -> NativeAdventure? {
        if day == 1 {
            for sound in targetSounds {
                let normalized = sound.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
                if let talking = stories.first(where: { $0.talk && $0.sound == normalized }) { return talking }
            }
        }
        return stories.first { !$0.talk && $0.day == day }
    }
}

struct NativeAdventure: Decodable, Identifiable {
    let id: String
    let day: Int
    let talk: Bool
    let sound: String?
    let title: String
    let hook: String
    let game: String
    let gameName: String
    let cover: String
    let intro: [NativeAdventurePage]
    let ending: [NativeAdventurePage]
}

struct NativeAdventurePage: Decodable {
    let id: String
    let art: String
    let ages: String
    let big: String
    let little: String
    let key: String?
    func caption(simple: Bool) -> String { simple ? little : big }
}

private enum AdventureColors {
    static let paper = Color(red: 1, green: 0.969, blue: 0.933)
    static let ink = Color(red: 0.153, green: 0.137, blue: 0.216)
    static let secondary = Color(red: 0.40, green: 0.37, blue: 0.43)
    static let teal = Color(red: 0.067, green: 0.498, blue: 0.518)
}

private struct AdventureIllustration: View {
    let path: String
    var localName: String?
    @State private var image: UIImage?
    @State private var failed = false
    @State private var retry = 0

    var body: some View {
        Group {
            if let localName {
                Image(localName).resizable().scaledToFit().accessibilityHidden(true)
            } else if let image {
                Image(uiImage: image).resizable().scaledToFit().accessibilityHidden(true)
            } else if failed {
                VStack(spacing: 12) {
                    Image("echo-welcome").resizable().scaledToFit().frame(maxHeight: 110).accessibilityHidden(true)
                    Button("Load picture") { retry += 1 }.frame(minHeight: 44)
                }
                .foregroundStyle(AdventureColors.teal)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ProgressView().tint(AdventureColors.teal)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .accessibilityLabel("Loading picture")
            }
        }
        .background(AdventureColors.teal.opacity(0.05))
        .task(id: path + "|\(retry)") {
            guard localName == nil else { return }
            image = nil
            failed = false
            do {
                let ready = try await NativeArtworkLoader.shared.image(path: path)
                guard !Task.isCancelled else { return }
                image = ready
            } catch {
                guard !Task.isCancelled else { return }
                failed = true
            }
        }
    }
}

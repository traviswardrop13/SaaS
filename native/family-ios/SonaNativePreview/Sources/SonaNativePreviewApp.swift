import SwiftUI

@main
struct SonaNativePreviewApp: App {
    @AppStorage("sona.preview.welcome") private var hasSeenWelcome = false
    @AppStorage("sona.preview.buddy") private var buddy: PreviewBuddy = .echo
    @AppStorage("sona.preview.sound") private var targetSound = ""
    @AppStorage("sona.preview.gameCompletions") private var completionsData = Data()
    @AppStorage("sona.preview.bookmarks") private var bookmarksData = Data()
    @AppStorage("sona.preview.adventureStart") private var adventureStart = 0.0
    @AppStorage("sona.preview.players.v1") private var savedPlayers = Data()

    @State private var section: Destination = .home
    @State private var experience: Experience?
    @State private var today = Date()
    @StateObject private var family = FamilyConnectionStore()
    @Environment(\.scenePhase) private var scenePhase
    @State private var sheet: FamilySheet?
    @State private var openLoginAfterSettings = false

    private enum FamilySheet: String, Identifiable {
        case grownUps, login, consent, buddies, collection
        var id: String { rawValue }
    }

    private enum Experience: Identifiable {
        case game(NativeGame, playerID: String)
        case story(NativeAdventure)

        var id: String {
            switch self {
            case .game(let game, let playerID): return "game-\(game.id)-\(playerID)"
            case .story(let story): return "story-\(story.id)"
            }
        }
    }

    private var roster: PreviewFamilyRoster {
        if let decoded = try? JSONDecoder().decode(PreviewFamilyRoster.self, from: savedPlayers),
           decoded[decoded.activeID] != nil { return decoded }
        return PreviewFamilyRoster(primary: legacyPreviewPlayer)
    }

    private var legacyPreviewPlayer: PreviewPlayer {
        PreviewPlayer(
            id: "primary", number: 1, buddy: buddy, targetSound: targetSound,
            completedGames: (try? JSONDecoder().decode(Set<String>.self, from: completionsData)) ?? [],
            bookmarks: (try? JSONDecoder().decode([String: BookBookmark].self, from: bookmarksData)) ?? [:],
            adventureStart: adventureStart > 0 ? Date(timeIntervalSince1970: adventureStart) : nil
        )
    }

    private var player: PreviewPlayer {
        let current = roster
        return current[current.activeID] ?? legacyPreviewPlayer
    }

    private var assignedHomework: FamilyHomework? {
        guard player.id == "primary" else { return nil }
        return family.assignedHomework(on: today)
    }

    private var selectedSound: String {
        assignedHomework?.sounds.map { $0.uppercased() }.first(where: GrownUpsView.sounds.contains)
            ?? player.targetSound
    }

    private func playerBinding<Value>(_ keyPath: WritableKeyPath<PreviewPlayer, Value>) -> Binding<Value> {
        let owner = player
        return Binding {
            (roster[owner.id] ?? owner)[keyPath: keyPath]
        } set: { value in
            updatePlayer(owner.id) { $0[keyPath: keyPath] = value }
        }
    }

    private func updateRoster(_ update: (inout PreviewFamilyRoster) -> Void) {
        var next = roster
        update(&next)
        if let encoded = try? JSONEncoder().encode(next) { savedPlayers = encoded }
    }

    private func updatePlayer(_ id: String, _ update: (inout PreviewPlayer) -> Void) {
        updateRoster { next in
            guard var player = next[id] else { return }
            update(&player)
            next.update(player)
        }
    }

    private var dailyStory: NativeAdventure? {
        guard let catalog = try? NativeAdventureCatalog.bundled.get() else { return nil }
        let first = player.adventureStart ?? today
        let calendar = Calendar.current
        let elapsed = calendar.dateComponents([.day], from: calendar.startOfDay(for: first),
                                              to: calendar.startOfDay(for: today)).day ?? 0
        let count = catalog.stories.filter { !$0.talk }.count
        guard count > 0 else { return nil }
        let day = max(0, elapsed) % count + 1
        let assignmentSounds = assignedHomework?.sounds.map { $0.uppercased() }.filter(GrownUpsView.sounds.contains) ?? []
        let sounds = !assignmentSounds.isEmpty ? assignmentSounds : [player.targetSound.isEmpty ? "R" : player.targetSound]
        return NativeAdventureCatalog.story(in: catalog.stories, day: day, targetSounds: sounds)
    }

    var body: some Scene {
        WindowGroup {
            ZStack {
                if hasSeenWelcome {
                    TabView(selection: $section) {
                        HomeView(
                            buddy: playerBinding(\.buddy),
                            targetSound: selectedSound,
                            completedGames: player.completedGames,
                            dailyStory: dailyStory,
                            storyAccess: family.libraryAccess.allowsStory,
                            onAdventure: {
                                if family.libraryAccess.allowsStory, let dailyStory {
                                    experience = .story(dailyStory)
                                } else {
                                    sheet = .grownUps
                                }
                            },
                            onOpen: { section = $0 },
                            onGrownUps: { sheet = .grownUps },
                            onBuddy: { sheet = .buddies },
                            onCollection: { sheet = .collection }
                        )
                        .tag(Destination.home)
                        .tabItem { Label("Home", systemImage: "house.fill") }

                        GamesView(completed: player.completedGames, access: family.libraryAccess) {
                            if family.libraryAccess.allows($0) { experience = .game($0, playerID: player.id) }
                        }
                            .tag(Destination.games)
                            .tabItem { Label("Games", systemImage: "gamecontroller.fill") }

                        BookShelfView(targetSound: selectedSound, access: family.libraryAccess, bookmarks: playerBinding(\.bookmarks))
                            .id(player.id)
                            .tag(Destination.books)
                            .tabItem { Label("Books", systemImage: "book.fill") }

                        PracticeModelsView(targetSound: selectedSound) { sheet = .grownUps }
                            .tag(Destination.practice)
                            .tabItem { Label("Practice", systemImage: "waveform") }
                    }
                    .tint(SonaPalette.teal)
                } else {
                    FirstRunView(
                        buddy: playerBinding(\.buddy),
                        onExplore: enterApp,
                        onTherapistLogin: { sheet = .login }
                    )
                }
            }
            .preferredColorScheme(.light)
            .fullScreenCover(item: $experience) { experience in
                switch experience {
                case .game(let game, let playerID):
                    play(game) { finish(game, playerID: playerID) }
                case .story(let story):
                    AdventureView(targetSound: story.sound ?? "", day: story.day) {
                        self.experience = nil
                    }
                }
            }
            .sheet(item: $sheet, onDismiss: routeAfterSheet) { destination in
                switch destination {
                case .buddies:
                    HomeBuddySheet(buddy: playerBinding(\.buddy))
                case .collection:
                    PlayCollectionView(completedGames: player.completedGames)
                case .grownUps:
                    GrownUpsView(
                        targetSound: playerBinding(\.targetSound),
                        player: player,
                        players: roster.players,
                        onSwitchPlayer: { id in
                            updateRoster { $0.select(id) }
                            section = .home
                        },
                        onAddPlayer: {
                            updateRoster { $0.addPlayer() }
                            section = .home
                        },
                        familyUsername: family.link?.user,
                        sharingProgress: family.link?.consentAt != nil,
                        homework: assignedHomework,
                        displayedSound: selectedSound,
                        onFamilyLogin: {
                            openLoginAfterSettings = true
                            sheet = nil
                        },
                        onChangePassword: { current, replacement in
                            try await family.changePassword(current: current, replacement: replacement)
                        },
                        onStopSharing: { try await family.stopSharing() }
                    )
                case .login:
                    FamilyLoginView { user, password in
                        try await family.signIn(username: user, password: password)
                    }
                case .consent:
                    FamilyConsentView(
                        clinicianName: family.link?.clinician ?? "",
                        hasCoverage: family.link?.covered ?? false
                    ) { shares in
                        try await family.chooseSharing(shares)
                        enterApp()
                    }
                    .interactiveDismissDisabled()
                }
            }
            .task {
                if family.needsSharingChoice {
                    sheet = .consent
                } else if family.link != nil {
                    enterApp()
                } else if hasSeenWelcome, player.adventureStart == nil {
                    updatePlayer(player.id) { $0.adventureStart = Date() }
                }
                await family.refreshCoverage()
                await family.refreshHomework()
            }
            .onChange(of: scenePhase) { phase in
                if phase == .active {
                    today = Date()
                    Task {
                        await family.refreshCoverage()
                        await family.refreshHomework()
                    }
                }
            }
            .onReceive(NotificationCenter.default.publisher(for: UIApplication.significantTimeChangeNotification)) { _ in
                today = Date()
            }
        }
    }

    private func routeAfterSheet() {
        if family.needsSharingChoice {
            sheet = .consent
        } else if openLoginAfterSettings {
            openLoginAfterSettings = false
            sheet = .login
        }
    }

    private func enterApp() {
        section = .home
        if player.adventureStart == nil { updatePlayer(player.id) { $0.adventureStart = Date() } }
        hasSeenWelcome = true
    }

    private func finish(_ game: NativeGame, playerID: String) {
        updatePlayer(playerID) { $0.completedGames.insert(game.id) }
    }

    @ViewBuilder
    private func play(_ game: NativeGame, onFinish: @escaping () -> Void) -> some View {
        switch game {
        case .slice:
            FruitSliceView(onRoundFinished: onFinish)
        case .glide:
            FlyingGamesView(game: .glide, onRoundFinished: onFinish)
        case .rise:
            FlyingGamesView(game: .rise, onRoundFinished: onFinish)
        case .sprint:
            SprintView(onRoundFinished: onFinish)
        case .bubbles:
            DiscoveryGamesView(game: .bubbles, onRoundFinished: onFinish)
        case .peekaboo:
            DiscoveryGamesView(game: .peekaboo, onRoundFinished: onFinish)
        case .dino:
            DiscoveryGamesView(game: .dino, onRoundFinished: onFinish)
        case .feed:
            JourneyGamesView(game: .feed, onRoundFinished: onFinish)
        case .racecar:
            JourneyGamesView(game: .racecar, onRoundFinished: onFinish)
        case .treasure:
            JourneyGamesView(game: .treasure, onRoundFinished: onFinish)
        case .space:
            JourneyGamesView(game: .space, onRoundFinished: onFinish)
        case .balloon, .flower, .rocket, .snowman, .train, .stars, .cake:
            if let meadow = MeadowGame(rawValue: game.rawValue) {
                MeadowGamesView(game: meadow, onRoundFinished: onFinish)
            }
        case .robot:
            MakerGamesView(game: .robot, onRoundFinished: onFinish)
        case .castle:
            MakerGamesView(game: .castle, onRoundFinished: onFinish)
        case .pizza:
            MakerGamesView(game: .pizza, onRoundFinished: onFinish)
        case .tiles, .stack, .hoops, .soccer:
            ArcadeRoundView(game: game, onRoundFinished: onFinish)
        }
    }
}

enum Destination: Hashable {
    case home, games, books, practice
}

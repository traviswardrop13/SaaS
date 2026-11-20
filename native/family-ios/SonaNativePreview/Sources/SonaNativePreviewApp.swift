import SwiftUI

@main
struct SonaNativePreviewApp: App {
    @AppStorage("sona.preview.welcome") private var hasSeenWelcome = false
    @AppStorage("sona.preview.buddy") private var buddy: PreviewBuddy = .echo
    @AppStorage("sona.preview.sound") private var targetSound = ""
    @AppStorage("sona.preview.gameCompletions") private var completionsData = Data()
    @AppStorage("sona.preview.bookmarks") private var bookmarksData = Data()

    @State private var section: Destination = .home
    @State private var activeGame: NativeGame?
    @StateObject private var family = FamilyConnectionStore()
    @Environment(\.scenePhase) private var scenePhase
    @State private var sheet: FamilySheet?
    @State private var openLoginAfterSettings = false

    private enum FamilySheet: String, Identifiable {
        case grownUps, login, consent, buddies, collection
        var id: String { rawValue }
    }

    private var completions: Set<String> {
        (try? JSONDecoder().decode(Set<String>.self, from: completionsData)) ?? []
    }

    private var bookmarks: Binding<[String: BookBookmark]> {
        Binding {
            (try? JSONDecoder().decode([String: BookBookmark].self, from: bookmarksData)) ?? [:]
        } set: { value in
            if let encoded = try? JSONEncoder().encode(value) { bookmarksData = encoded }
        }
    }

    var body: some Scene {
        WindowGroup {
            ZStack {
                if hasSeenWelcome {
                    TabView(selection: $section) {
                        HomeView(
                            buddy: $buddy,
                            targetSound: targetSound,
                            completedGames: completions,
                            onOpen: { section = $0 },
                            onGrownUps: { sheet = .grownUps },
                            onBuddy: { sheet = .buddies },
                            onCollection: { sheet = .collection }
                        )
                        .tag(Destination.home)
                        .tabItem { Label("Home", systemImage: "house.fill") }

                        GamesView(completed: completions, access: family.libraryAccess) { activeGame = $0 }
                            .tag(Destination.games)
                            .tabItem { Label("Games", systemImage: "gamecontroller.fill") }

                        BookShelfView(targetSound: targetSound, access: family.libraryAccess, bookmarks: bookmarks)
                            .tag(Destination.books)
                            .tabItem { Label("Books", systemImage: "book.fill") }

                        PracticeModelsView(targetSound: targetSound) { sheet = .grownUps }
                            .tag(Destination.practice)
                            .tabItem { Label("Practice", systemImage: "waveform") }
                    }
                    .tint(SonaPalette.teal)
                } else {
                    FirstRunView(
                        buddy: $buddy,
                        onExplore: enterApp,
                        onTherapistLogin: { sheet = .login }
                    )
                }
            }
            .preferredColorScheme(.light)
            .fullScreenCover(item: $activeGame) { game in
                play(game)
            }
            .sheet(item: $sheet, onDismiss: routeAfterSheet) { destination in
                switch destination {
                case .buddies:
                    HomeBuddySheet(buddy: $buddy)
                case .collection:
                    PlayCollectionView(completedGames: completions)
                case .grownUps:
                    GrownUpsView(
                        targetSound: $targetSound,
                        hasPlayed: !completions.isEmpty,
                        familyUsername: family.link?.user,
                        onFamilyLogin: {
                            openLoginAfterSettings = true
                            sheet = nil
                        },
                        onChangePassword: { current, replacement in
                            try await family.changePassword(current: current, replacement: replacement)
                        }
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
                    hasSeenWelcome = true
                }
                await family.refreshCoverage()
            }
            .onChange(of: scenePhase) { phase in
                if phase == .active { Task { await family.refreshCoverage() } }
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
        hasSeenWelcome = true
    }

    private func finish(_ game: NativeGame) {
        var played = completions
        played.insert(game.id)
        if let encoded = try? JSONEncoder().encode(played) { completionsData = encoded }
    }

    @ViewBuilder
    private func play(_ game: NativeGame) -> some View {
        switch game {
        case .slice:
            FruitSliceView { finish(game) }
        case .glide:
            FlyingGamesView(game: .glide) { finish(game) }
        case .rise:
            FlyingGamesView(game: .rise) { finish(game) }
        case .sprint:
            SprintView { finish(game) }
        case .bubbles:
            DiscoveryGamesView(game: .bubbles) { finish(game) }
        case .peekaboo:
            DiscoveryGamesView(game: .peekaboo) { finish(game) }
        case .dino:
            DiscoveryGamesView(game: .dino) { finish(game) }
        case .tiles, .stack, .hoops, .soccer:
            ArcadeRoundView(game: game) { finish(game) }
        }
    }
}

enum Destination: Hashable {
    case home, games, books, practice
}

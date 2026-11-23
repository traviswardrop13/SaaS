import SwiftUI
import SonaFamilyAccess
import SonaFamilyBackup
import SonaFamilyMigration
import SonaSpeechCore

@main
struct SonaNativePreviewApp: App {
    @AppStorage("sona.preview.welcome") private var hasSeenWelcome = false
    @AppStorage("sona.preview.buddy") private var buddy: PreviewBuddy = .echo
    @AppStorage("sona.preview.sound") private var targetSound = ""
    @AppStorage("sona.preview.gameCompletions") private var completionsData = Data()
    @AppStorage("sona.preview.bookmarks") private var bookmarksData = Data()
    @AppStorage("sona.preview.adventureStart") private var adventureStart = 0.0
    @AppStorage("sona.preview.players.v1") private var savedPlayers = Data()
    @AppStorage("sona.native.reader-microphone-allowed") private var readerMicrophoneAllowed = false

    @State private var reminderExiting = false
    @StateObject private var reminderAudioOwners = NativeReminderAudioOwners()
    @State private var section: Destination = .home
    @State private var experience: Experience?
    @State private var practiceLoad: UUID?
    @State private var practiceLaunch: PracticeLaunch?
    @State private var practiceStatus: String?
    @State private var today = Date()
    @State private var arcadeLevelRevision = 0
    @State private var arcadeLevelLoad: UUID?
    @State private var arcadeLevelChoice: ArcadeLevelChoice?
    @StateObject private var family = FamilyConnectionStore()
    @StateObject private var records = NativeFamilyState()
    @StateObject private var trialReminders = NativeTrialReminderStore.appDevice()
    @Environment(\.scenePhase) private var scenePhase
    @State private var sheet: FamilySheet?
    @State private var openLoginAfterSettings = false
    @State private var openingFamilyAction = false
    @State private var clearingRemovedPlayers = false
    @State private var setupHandoff: NativeSetupHandoff?
    @State private var queuedSetupPractice: NativeSetupHandoff?
    @State private var firstSetupGuide: NativeSetupHandoff?
    @State private var firstSetupGuidePresented = false
    @State private var setupRewalkOwner: NativeFamilyChildID?
    @State private var childPreparation: Task<NativeFamilyChildID, Error>?

    private enum FamilySheet: String, Identifiable {
        case grownUps, login, consent, buddies, collection, store, arcadeLevels
        var id: String { rawValue }
    }

    private struct SetupContinuationDestination {
        let id = UUID()
        let owner: NativeFamilyChildID
        let name: String
        let marker: NativeSetupHandoff
    }

    private enum Experience: Identifiable {
        case setup(SetupContinuationDestination)
        case story(NativeAdventure, owner: NativeFamilyChildID?)
        case storyReplay(NativeAdventure, owner: NativeFamilyChildID, id: UUID)
        case practice(PracticeDestination)
        case speechGame(SpeechGameDestination)
        case feed(FeedDestination)

        var id: String {
            switch self {
            case .setup(let value): return value.id.uuidString
            case .story(let story, _): return "story-\(story.id)"
            case .storyReplay(_, _, let id): return id.uuidString
            case .practice(let practice): return practice.id.uuidString
            case .speechGame(let speech): return speech.id.uuidString
            case .feed(let feed): return feed.id.uuidString
            }
        }
    }

    private struct PracticeDestination: Identifiable {
        let id: UUID
        let owner: NativeFamilyChildID
        let game: NativeGame?
        let playerID: String
        let selection: NativePracticeSelection
        let arcadeRound: NativeArcadeRoundContext?
    }

    private struct ArcadeLevelChoice {
        let game: NativeGame
        let owner: NativeFamilyChildID
        let info: NativeArcadeLevelInfo
    }

    private struct PracticeLaunch {
        let id: UUID
        let content: PracticeFlowContent
    }

    private struct SpeechGameDestination: Identifiable {
        let id: UUID
        let owner: NativeFamilyChildID
        let game: NativeGame
        let playerID: String
        let selection: NativeSpeechGameSelection
        let arcadeRound: NativeArcadeRoundContext?
        let dinoMemory: NativeDinoCollectionMemory?
    }

    private struct FeedDestination: Identifiable {
        let id: UUID
        let owner: NativeFamilyChildID
        let playerID: String
        let selection: NativeFeedSelection
    }

    private func reminderRouteAdmission() -> NativeReminderRouteAdmission {
        guard scenePhase == .active, records.stage != .loading else { return .deferUntilReady }
        guard records.stage == .ready, didOnboard, !family.needsSharingChoice,
              sheet == nil, setupHandoff == nil, queuedSetupPractice == nil,
              setupRewalkOwner == nil, firstSetupGuide == nil,
              !openingFamilyAction, !openLoginAfterSettings,
              childPreparation == nil, practiceStatus == nil else { return .protectedFlow }
        if let experience, case .setup = experience { return .protectedFlow }
        return .allowed
    }

    private func handleReminderOpen() async {
        guard !reminderExiting else { return }
        defer { reminderExiting = false }
        _ = await NativeReminderTapRouter.shared.handle(admission: { reminderRouteAdmission() }, closeOutgoing: {
            reminderExiting = true
            practiceLoad = nil; practiceLaunch = nil
            await reminderAudioOwners.closeCapturedOwners()
        }, showHome: {
            experience = nil
            section = .home
        })
    }

    private func syncRemindersForCurrentRoute() async {
        records.stageReminderUpgrade(into: trialReminders)
        let nonHome = section != .home || experience != nil || sheet != nil
        _ = await trialReminders.syncIfDue(context: nonHome ? .nonHome : .home)
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
        if !records.isPreview, let scope = records.scope,
           var restored = records.playerViews.first(where: { $0.id == scope }) {
            restored.completedGames.formUnion((records.summary?.bestGameIDs ?? []).map { $0 == "run" ? "sprint" : $0 })
            return restored
        }
        return current[current.activeID] ?? legacyPreviewPlayer
    }

    private var assignedHomework: FamilyHomework? {
        records.summary?.homework ?? family.assignedHomework(on: today)
    }

    private var selectedSound: String {
        records.summary?.sound ?? player.targetSound
    }

    private var didOnboard: Bool {
        if let owner = records.activeID, setupRewalkOwner == owner { return false }
        if records.isPreview { return hasSeenWelcome }
        guard !records.isPreview, let child = records.activeChild else { return false }
        return NativeFamilyState.profile(of: child)["onboarded"] as? Bool == true
    }

    /// A saved setup receipt and a durably covered household are both needed.
    /// Settings has no handoff marker, so its storefront keeps its own route.
    private var setupStoreContinuationKey: String? {
        guard sheet == .store, let marker = setupHandoff,
              marker.isValid(currentOwner: records.scope), records.entitlement.premium,
              !family.needsSharingChoice else { return nil }
        return marker.owner + "/" + String(marker.createdAt.timeIntervalSince1970)
    }

    private var targetSoundBinding: Binding<String> {
        Binding {
            records.summary?.pinnedSound ?? player.targetSound
        } set: { sound in
            guard let owner = records.activeID else { return }
            updateRecords {
                let result: FamilyJSONValue = try await records.write(.targetSound, input: .init(sound: sound), owner: owner)
                if records.isPreview, case .object(let fields) = result, fields["saved"] == .bool(true) {
                    updatePlayer(player.id) { $0.targetSound = sound }
                }
            }
        }
    }

    private func playerBinding<Value>(_ keyPath: WritableKeyPath<PreviewPlayer, Value>) -> Binding<Value> {
        let owner = player
        return Binding {
            if !records.isPreview { return owner[keyPath: keyPath] }
            return (roster[owner.id] ?? owner)[keyPath: keyPath]
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
        if let quest = records.summary?.quest, let story = quest.story {
            return catalog.stories.first { $0.id == story.id }
        }
        if !records.isPreview { return nil }
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

    private var dailyGame: NativeGame? {
        guard let quest = records.summary?.quest, quest.kind == "game" else { return nil }
        return quest.game == "run" ? .sprint : NativeGame(rawValue: quest.game)
    }

    private var foundStories: [NativeAdventure] {
        guard let summary = records.summary, let catalog = try? NativeAdventureCatalog.bundled.get() else { return [] }
        return summary.found.reversed().compactMap { item in catalog.stories.first { $0.id == item.id } }
    }

    var body: some Scene {
        WindowGroup {
            appContent
            .environment(\.nativeReminderAudioOwners, reminderAudioOwners)
            .disabled(reminderExiting)
            .preferredColorScheme(.light)
            .fullScreenCover(item: $experience, onDismiss: experienceDismissed) { item in
                experienceContent(item)
                    .environment(\.nativeReminderAudioOwners, reminderAudioOwners)
                    .disabled(reminderExiting)
            }
            .onChange(of: experience?.id) { _ in
                if case .practice(let destination) = experience,
                   destination.game == .slice,
                   firstSetupGuide?.isValid(currentOwner: records.scope) == true {
                    firstSetupGuidePresented = true
                }
            }
            .alert("Sona practice", isPresented: Binding(get: { practiceStatus != nil }, set: { if !$0 { practiceStatus = nil } })) {
                Button("OK", role: .cancel) { practiceStatus = nil }
            } message: { Text(practiceStatus ?? "") }
            .sheet(item: $sheet, onDismiss: routeAfterSheet, content: sheetContent)
            .task(id: setupStoreContinuationKey) {
                guard let key = setupStoreContinuationKey, let marker = setupHandoff else { return }
                try? await Task.sleep(nanoseconds: 1_200_000_000)
                guard !Task.isCancelled, setupStoreContinuationKey == key, setupHandoff == marker,
                      marker.afterStore(currentOwner: records.scope,
                          allowsPractice: family.libraryAccess.allowsPractice) == .microphone else { return }
                sheet = nil
            }
            .onReceive(NativeReminderTapRouter.shared.$pending) { event in
                if event != nil { Task { await handleReminderOpen() } }
            }
            .task {
                await openRecords()
                records.trialReminders = trialReminders
                records.stageReminderUpgrade(into: trialReminders)
                await handleReminderOpen()
                if family.needsSharingChoice {
                    sheet = .consent
                } else if family.link != nil {
                    try? await enterApp()
                } else if hasSeenWelcome, player.adventureStart == nil {
                    updatePlayer(player.id) { $0.adventureStart = Date() }
                }
                await family.refreshCoverage()
                await family.refreshHomework()
                try? await flushFamilyChanges()
                await records.refreshAppleAccess()
                await records.retireOldRecordings()
                await clearRemovedPlayers()
                await syncRemindersForCurrentRoute()
            }
            .onChange(of: records.stage) { _ in Task { await handleReminderOpen() } }
            .onChange(of: records.activeID) { _ in
                arcadeLevelLoad = nil; arcadeLevelChoice = nil
                if sheet == .arcadeLevels { sheet = nil }
                if setupHandoff?.owner != records.scope { setupHandoff = nil }
                if queuedSetupPractice?.owner != records.scope { queuedSetupPractice = nil }
                if firstSetupGuide?.owner != records.scope { firstSetupGuide = nil; firstSetupGuidePresented = false }
                if setupRewalkOwner != records.activeID { setupRewalkOwner = nil }
                bindCurrentChild()
                if family.needsSharingChoice { sheet = .consent }
                Task {
                    await family.refreshCoverage()
                    await family.refreshHomework()
                    try? await flushFamilyChanges()
                }
            }
            .onChange(of: records.entitlement) { _ in bindCurrentChild() }
            .onChange(of: family.change) { change in
                if change != nil { updateRecords { try await flushFamilyChanges() } }
            }
            .onChange(of: experience?.id) { id in
                if id == nil { records.flushWeeklyReportOnLeavingPractice() }
                Task { await syncRemindersForCurrentRoute() }
            }
            .onChange(of: section) { destination in
                if destination != .books { records.flushWeeklyReportOnLeavingPractice() }
                Task { await syncRemindersForCurrentRoute() }
            }
            .onChange(of: sheet) { _ in Task { await syncRemindersForCurrentRoute() } }
            .onChange(of: scenePhase) { phase in
                if phase == .active {
                    Task { await handleReminderOpen() }
                    today = Date()
                    Task {
                        try? await records.refresh()
                        await family.refreshCoverage()
                        await family.refreshHomework()
                        try? await flushFamilyChanges()
                        await records.refreshAppleAccess()
                        await records.retireOldRecordings()
                        await clearRemovedPlayers()
                        await syncRemindersForCurrentRoute()
                    }
                } else if phase == .background {
                    records.flushWeeklyReportOnLeavingPractice()
                }
            }
            .onReceive(NotificationCenter.default.publisher(for: UIApplication.significantTimeChangeNotification)) { _ in
                today = Date()
                Task { try? await records.refresh() }
            }
        }
    }

    private var appContent: some View {
        ZStack {
            if records.stage == .loading || records.stage == .chooseOrigin || records.stage == .unavailable {
                startupStatus
            } else if didOnboard {
                mainTabs
            } else if records.isPreview {
                FirstRunView(
                    buddy: playerBinding(\.buddy),
                    buddies: [.echo, .fox, .frog],
                    onExplore: { updateRecords { try await enterApp() } },
                    onTherapistLogin: startTherapistLogin
                )
            } else {
                NativeFamilySetupView(records: records, rewalk: setupRewalkOwner != nil && setupRewalkOwner == records.activeID,
                    priceFollows: family.libraryAccess.requiresTrialFirst,
                    reminders: NativeSetupReminderActions(
                        refreshAuthorization: { _ = await trialReminders.refreshAuthorization() },
                        shouldOfferSetup: { trialReminders.shouldOfferSetup(priceFollows: $0, confirmedFreeTrial: $1) },
                        enableReminders: { await trialReminders.enableReminders() }),
                    makeStoreProbe: makeSetupStoreProbe,
                    onPrepare: prepareFamilyChild,
                    onComplete: completeFamilySetup, onTherapistLogin: startTherapistLogin)
            }
        }
    }

    private var mainTabs: some View {
        TabView(selection: $section) {
            HomeView(
                buddy: records.activeChild.flatMap { NativeFamilyState.profile(of: $0)["character"] as? String }
                    .flatMap(PreviewBuddy.init(rawValue:)) ?? player.buddy,
                targetSound: selectedSound,
                completedGames: player.completedGames,
                goal: records.summary?.goal,
                dailyStory: dailyStory,
                dailyGame: dailyGame,
                adventureDone: records.summary?.quest.state == "done",
                home: records.summary?.home,
                storyAccess: family.libraryAccess.allowsStory,
                onAdventure: {
                    guard records.summary?.quest.state != "done" else { return }
                    if family.libraryAccess.allowsStory, let dailyStory {
                        experience = .story(dailyStory, owner: records.activeID)
                    } else if dailyStory == nil, let dailyGame {
                        openGame(dailyGame)
                    } else {
                        openStoreIfEligible()
                    }
                },
                onOpen: { section = $0 },
                onGrownUps: { sheet = .grownUps },
                onBuddy: { sheet = .buddies },
                onCollection: { sheet = .collection }
            )
            .tag(Destination.home)
            .tabItem { Label("Home", systemImage: "house.fill") }

            NativeArcadeLevelCards(access: arcadeLevelsAccess, refresh: experience?.id ?? "") {
                GamesView(completed: player.completedGames, access: family.libraryAccess, foundStories: foundStories,
                          onReplayStory: { openFoundStory($0) }) {
                    openGame($0)
                }
            }
                .tag(Destination.games)
                .tabItem { Label("Games", systemImage: "gamecontroller.fill") }

            BookShelfView(targetSound: records.summary?.bookSound ?? selectedSound, access: family.libraryAccess,
                          readTitles: records.summary?.booksRead ?? [],
                          oldReadSounds: records.summary?.oldReadSounds ?? [],
                          onFinished: { [owner = records.activeID] title in recordBook(title, owner: owner) },
                          onLocked: openStoreIfEligible,
                          spokenReading: readingAccess(owner: records.activeID, book: true, isCurrent: { section == .books }),
                          bookmarks: readingPlaces)
                .id(player.id)
                .tag(Destination.books)
                .tabItem { Label("Books", systemImage: "book.fill") }

            PracticeModelsView(targetSound: selectedSound, onGrownUps: { sheet = .grownUps },
                               onPractice: { startPractice() })
                .tag(Destination.practice)
                .tabItem { Label("Practice", systemImage: "waveform") }
        }
        .tint(SonaPalette.teal)
    }

    @ViewBuilder private func experienceContent(_ experience: Experience) -> some View {
        switch experience {
        case .setup(let destination):
            NativeSetupContinuationView(childName: destination.name,
                isCurrent: { !reminderExiting && records.activeID == destination.owner && self.experience?.id == destination.id.uuidString },
                onPlay: { finishSetupHandoff(destination) })
                .id(destination.id)
        case .story(let story, let owner):
            AdventureView(targetSound: story.sound ?? "", day: story.day, storyID: story.id,
                isSimple: records.summary?.playStyle == "simple",
                initialPage: records.summary?.quest.page ?? 0,
                resumeAtGame: records.summary?.quest.seen == true && !story.talk,
                beginWithEnding: records.summary?.quest.state == "done",
                onReadingPage: { page in saveStoryPlace(story, page: page, owner: owner) },
                onIntroFinished: { saveStoryIntro(story, owner: owner) },
                onTalkingIntroFinished: { completeTalkingIntro(story, owner: owner) },
                spokenGame: adventureGameAccess(story: story, owner: owner),
                spokenReading: readingAccess(owner: owner, book: false, isCurrent: { self.experience?.id == experience.id })) {
                self.experience = nil
            }
        case .storyReplay(let story, let owner, let id):
            if story.talk {
                AdventureView(targetSound: story.sound ?? "", day: story.day, storyID: story.id,
                    isSimple: records.summary?.playStyle == "simple",
                    spokenReading: readingAccess(owner: owner, book: false, isCurrent: { self.experience?.id == id.uuidString })) {
                        self.experience = nil
                    }
            } else {
                NativeStoryPlayHost(game: story.game, access: replayAccess(story: story, owner: owner, id: id),
                    onFinish: {}, onExit: { self.experience = nil },
                    onReplay: { openFoundStory(story) }) {
                        foundStoryBoard(story.game)
                    }
            }
        case .practice(let destination):
            if let launch = practiceLaunch, launch.id == destination.id, let game = destination.game {
                let live = { !reminderExiting && records.activeID == destination.owner && self.experience?.id == destination.id.uuidString }
                NativeGuidedArcadeView(game: game, isCurrent: live, load: { card in
                    guard live() else { throw NativeFamilyRuleError.playerChanged }
                    return try await records.read(.arcadeCheckpoint, input: .init(
                        sound: launch.content.target.sound, game: game.shippingID, card: card,
                        boostLevel: launch.content.rung.rawValue, boostAsk: launch.content.target.word,
                        boostPosition: destination.selection.practicePosition))
                }, credit: { saying in
                    guard live() else { throw NativeFamilyRuleError.playerChanged }
                    try await applyPlayRep(saying, owner: destination.owner)
                }, onFinish: {
                    finishVerifiedGame(game, after: destination)
                }, onReplay: {
                    startPractice(game, replacing: destination.id, retainingLevel: destination.arcadeRound?.level)
                }, onExit: {
                    self.experience = nil
                }) { stage, finish, loseLife in
                    play(game, stage: stage, onLifeLost: loseLife, onFinish: finish)
                }
                .environment(\.arcadeRoundContext, destination.arcadeRound)
                .id(destination.id)
            } else {
                GuidedPracticeView(plan: destination.selection.plan,
                    isCurrent: { !reminderExiting && records.activeID == destination.owner && self.experience?.id == experience.id },
                    apply: { effect in try await applyPractice(effect, to: destination) },
                    onReady: { ready in
                        firstSetupGuide = nil; firstSetupGuidePresented = false
                        if destination.game == nil { self.experience = nil }
                        else { practiceLaunch = PracticeLaunch(id: destination.id, content: ready.content) }
                    })
            }
        case .speechGame(let speech):
            NativeSayPlayRound(gameID: speech.game.shippingID, selection: speech.selection,
                isCurrent: { !reminderExiting && records.activeID == speech.owner && self.experience?.id == speech.id.uuidString },
                credit: { credit in try await applyPlayRep(credit, owner: speech.owner) },
                onFinish: {
                    if records.isPreview { finish(speech.game, playerID: speech.playerID) }
                    saveQuestCompletion(speech.game, owner: speech.owner, id: speech.id)
                },
                onReplay: { startSpeechGame(speech.game, replacing: speech.id, retainingLevel: speech.arcadeRound?.level, retainingDinoMemory: speech.dinoMemory) },
                onExit: { self.experience = nil }) {
                    play(speech.game) { }
                }
                .environment(\.arcadeRoundContext, speech.arcadeRound)
                .environment(\.dinoCollectionAccess, dinoCollectionAccess(for: speech))
        case .feed(let feed):
            NativeFeedRound(selection: feed.selection,
                isCurrent: { !reminderExiting && records.activeID == feed.owner && self.experience?.id == feed.id.uuidString },
                credit: { credit in try await applyPlayRep(credit, owner: feed.owner) },
                onFeed: { move in try await storeFeedBite(move, for: feed) },
                onFinish: {
                    if records.isPreview { finish(.feed, playerID: feed.playerID) }
                    saveQuestCompletion(.feed, owner: feed.owner, id: feed.id)
                },
                onReplay: { startFeed(replacing: feed.id) },
                onExit: { self.experience = nil })
        }
    }

    @ViewBuilder private func sheetContent(_ destination: FamilySheet) -> some View {
        switch destination {
        case .buddies:
            NativeBuddyShopView(records: records)
        case .collection:
            NativeRewardsHost(records: records, arcadeLevels: arcadeLevelsAccess)
        case .arcadeLevels:
            if let choice = arcadeLevelChoice, choice.owner == records.activeID {
                NativeArcadeLevelSheet(title: choice.game.title, info: choice.info, choose: { level in
                    guard let access = arcadeLevelsAccess, choice.owner == records.activeID else { throw CancellationError() }
                    let round = try await NativeArcadeLevels(access: access).chooseForLaunch(gameID: choice.game.shippingID, level: level)
                    guard choice.owner == records.activeID, sheet == .arcadeLevels else { throw CancellationError() }
                    arcadeLevelChoice = nil; sheet = nil
                    launchGame(choice.game, round: round)
                }, close: { arcadeLevelChoice = nil; sheet = nil })
            }
        case .store:
            SonaNavigation {
                if let storefront = storefront() { storefront() }
            }
        case .grownUps:
            GrownUpsView(
                targetSound: targetSoundBinding,
                player: player,
                players: records.isPreview ? roster.players : records.playerViews,
                onSwitchPlayer: switchPlayer,
                onAddPlayer: addPlayer,
                onRemovePlayer: records.isPreview ? nil : { try await removePlayer($0) },
                familyUsername: family.link?.user.isEmpty == false ? family.link?.user : nil,
                sharingProgress: family.link?.consentAt != nil,
                homework: assignedHomework,
                displayedSound: selectedSound,
                practice: records.summary,
                onSendProgress: family.link?.consentAt != nil && !family.needsSharingChoice
                    ? { await sendParentProgress() } : nil,
                focusOptions: records.summary?.soundChoices ?? [],
                onToggleFocus: toggleFocus,
                playerSettings: { AnyView(NativeFamilyPreferencesView(records: records)) },
                onFamilyLogin: {
                    openLoginAfterSettings = true
                    sheet = nil
                },
                onChangePassword: { current, replacement in
                    try await family.changePassword(current: current, replacement: replacement)
                },
                onStopSharing: {
                    try await family.stopSharing()
                    try await flushFamilyChanges()
                },
                storefront: storefront(allowsWebsiteRestore: true),
                movingPhones: movingPhones,
                weeklyReport: weeklyReport
            )
        case .login:
            FamilyLoginView { user, password in
                bindCurrentChild()
                try await family.signIn(username: user, password: password)
                try await flushFamilyChanges()
            }
        case .consent:
            FamilyConsentView(
                clinicianName: family.link?.clinician ?? "",
                hasCoverage: family.link?.covered ?? false
            ) { shares in
                let snapshot: FamilyEnrollmentSnapshot? = shares ? try await records.read(.enrollmentSnapshot) : nil
                try await family.chooseSharing(shares, snapshot: snapshot)
                try await flushFamilyChanges()
                try await enterApp()
            }
            .interactiveDismissDisabled()
        }
    }

    private func routeAfterSheet() {
        if family.needsSharingChoice {
            sheet = .consent
        } else if openLoginAfterSettings {
            openLoginAfterSettings = false
            sheet = .login
        } else if let handoff = setupHandoff {
            setupHandoff = nil
            if handoff.afterStore(currentOwner: records.scope, allowsPractice: family.libraryAccess.allowsPractice) == .microphone {
                presentSetupContinuation(handoff)
            }
        }
    }

    private func enterApp() async throws {
        section = .home
        if !records.isPreview {
            // Login/consent is independent of a child's saved setup. A kept
            // family goes Home; a new child still supplies their choices.
            _ = try await prepareFamilyChild()
            return
        }
        if player.adventureStart == nil { updatePlayer(player.id) { $0.adventureStart = Date() } }
        hasSeenWelcome = true
    }

    private func completeFamilySetup(_ draft: NativeSetupDraft, form: NativeSetupForm,
                                     owner: NativeFamilyChildID) async throws {
        guard owner == records.activeID else { throw NativeFamilyRuleError.playerChanged }
        let receipt = "setup/" + draft.receipt.uuidString
        var input = NativeRuleFields(name: draft.name, age: draft.age, focusSounds: draft.focusSounds,
            mode: draft.mode, pathReason: draft.pathReason, minutes: draft.minutes, character: draft.character)
        input.rewalk = form.rewalk
        input.interests = form.showSales ? draft.interests : nil
        let acceptedEmail = form.askUpdates && !draft.email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? draft.email : nil
        let consent = NativeFamilySetupConsent(askQuestions: form.askQuestions,
            therapy: form.askQuestions ? draft.therapy : "", displayedUpdates: form.askUpdates,
            acceptedReportEmail: acceptedEmail)
        do {
            _ = try await records.completeFamilySetup(input: input, consent: consent, owner: owner, receipt: receipt)
        } catch NativeFamilyRuleError.replayed {
            try await records.refresh()
        }
        try Task.checkCancellation()
        guard records.activeID == owner,
              records.activeChild.map({ NativeFamilyState.profile(of: $0)["onboarded"] as? Bool == true }) == true
        else { throw NativeFamilyRuleError.playerChanged }
        setupRewalkOwner = nil; section = .home
        guard !form.isClinician else { return }
        let scope = NativeFamilyState.scope(of: owner)
        let marker = NativeSetupHandoff(owner: scope)
        switch NativeSetupHandoff.afterSave(owner: scope, currentOwner: records.scope,
            requiresTrialFirst: family.libraryAccess.requiresTrialFirst, allowsPractice: family.libraryAccess.allowsPractice) {
        case .store:
            setupHandoff = marker
            openStoreIfEligible()
        case .microphone:
            presentSetupContinuation(marker)
        default:
            break
        }
    }

    private func makeSetupStoreProbe(_ owner: NativeFamilyChildID) -> NativeSetupStoreProbe? {
        guard let configuration = try? FamilyAccessConfiguration.bundled(),
              let client = NativeStorefrontHost.makeClient() else { return nil }
        return NativeSetupStoreProbe(client: client, configuration: configuration,
            readRevision: { try await records.appleAccessRevision(for: owner.origin) },
            persist: { patch in
                _ = try await records.recordAppleAccess(active: patch.active, checkedAt: patch.lastAuthoritativeRefresh,
                                                       origin: owner.origin, source: patch.source)
            }, isCurrent: { records.activeID == owner })
    }

    private func presentSetupContinuation(_ marker: NativeSetupHandoff) {
        guard marker.isValid(currentOwner: records.scope), let owner = records.activeID,
              family.libraryAccess.allowsPractice else { return }
        let name = records.activeChild.map { NativeFamilyState.profile(of: $0)["childName"] as? String ?? "" } ?? ""
        experience = .setup(.init(owner: owner, name: name.isEmpty ? "your child" : name, marker: marker))
    }

    private func finishSetupHandoff(_ destination: SetupContinuationDestination) {
        guard records.activeID == destination.owner, experience?.id == destination.id.uuidString else { return }
        switch destination.marker.afterHandoff(currentOwner: records.scope,
            requiresTrialFirst: family.libraryAccess.requiresTrialFirst, allowsPractice: family.libraryAccess.allowsPractice) {
        case .store:
            experience = nil; setupHandoff = destination.marker
            openStoreIfEligible()
        case .fruitSlice:
            queuedSetupPractice = destination.marker
            experience = nil
        default:
            experience = nil
        }
    }

    private func experienceDismissed() {
        guard experience == nil else { return }
        if let marker = queuedSetupPractice {
            queuedSetupPractice = nil
            guard marker.isValid(currentOwner: records.scope), family.libraryAccess.allowsPractice else { return }
            // Wait for the setup cover to leave before mounting the speech owner.
            startPractice(.slice, setupGuide: marker)
            return
        }
        guard firstSetupGuidePresented else { return }
        firstSetupGuidePresented = false
        if firstSetupGuide?.isValid(currentOwner: records.scope) == true, let owner = records.activeID {
            setupRewalkOwner = owner; section = .home
        }
        firstSetupGuide = nil
    }

    private func prepareFamilyChild() async throws -> NativeFamilyChildID {
        if let childPreparation { return try await childPreparation.value }
        let preparation = Task { @MainActor in
            if records.stage == .needsSetup, records.activeID == nil {
                try await records.addChild(name: "", age: "", operationID: UUID())
            }
            guard let owner = records.activeID else { throw NativeFamilyRuleError.playerChanged }
            bindCurrentChild()
            return owner
        }
        childPreparation = preparation
        defer { childPreparation = nil }
        return try await preparation.value
    }

    private func startTherapistLogin() {
        guard !openingFamilyAction else { return }
        openingFamilyAction = true
        updateRecords {
            defer { openingFamilyAction = false }
            _ = try await prepareFamilyChild()
            sheet = .login
        }
    }

    private func openStoreIfEligible() {
        guard family.libraryAccess.offersLockedContent else { return }
        sheet = .store
    }

    private func toggleFocus(_ sound: String) {
        guard let owner = records.activeID else { return }
        updateRecords {
            let _: NativePracticeSummary = try await records.write(.changeFocus, input: .init(sound: sound), owner: owner)
        }
    }

    private func updateRecords(_ work: @escaping @MainActor () async throws -> Void) {
        Task {
            do { try await work() }
            catch { practiceStatus = "Sona couldn’t update this player. Try again." }
        }
    }

    @ViewBuilder
    private var startupStatus: some View {
        switch records.stage {
        case .loading:
            ProgressView("Opening Sona")
        case .unavailable:
            VStack(spacing: 15) {
                Text("Sona couldn’t open the family records.").font(.headline)
                Button("Try again") { Task { await openRecords() } }
            }
            .padding(24)
        case .chooseOrigin:
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Text("Choose a saved family").font(.largeTitle.weight(.heavy))
                    ForEach(records.document?.families.filter { !$0.slots.isEmpty } ?? [], id: \.origin) { saved in
                        Button {
                            updateRecords { try await records.selectOrigin(saved.origin) }
                        } label: {
                            let names = saved.children.compactMap {
                                NativeFamilyState.profile(of: $0)["childName"] as? String
                            }.filter { !$0.isEmpty }.joined(separator: ", ")
                            Text(names.isEmpty ? "\(saved.slots.count) players" : names)
                                .frame(minHeight: 44)
                        }
                    }
                }
                .padding(24)
            }
        case .ready, .needsSetup:
            EmptyView()
        }
    }

    private func openRecords() async {
        await records.open(sounds: GrownUpsView.sounds, preferredSound: player.targetSound)
        if records.isPreview, let index = roster.players.firstIndex(where: { $0.id == roster.activeID }) {
            try? await records.selectPreviewPlayer(index + 1, sounds: GrownUpsView.sounds, preferredSound: player.targetSound)
        }
        bindCurrentChild()
        try? await flushFamilyChanges()
    }

    private func bindCurrentChild() {
        guard let child = records.activeChild, let origin = records.document?.primaryFamily else { return }
        if NativeFamilyState.profile(of: child)["onboarded"] as? Bool == true {
            NativeSetupDraftStore(defaults: .standard, owner: NativeFamilyState.scope(of: child.id)).remove()
        }
        family.bind(child: child, household: origin, isPreview: records.isPreview,
                    access: records.entitlement, canSellHere: NativeStorefrontHost.canSell)
    }

    private func flushFamilyChanges() async throws {
        while let change = family.change {
            try await records.applyClinicianChange(change)
            family.acknowledgeChange(change.id)
        }
    }

    private func storefront(allowsWebsiteRestore: Bool = false) -> (() -> AnyView)? {
        guard let origin = records.document?.primaryOrigin,
              let configuration = try? FamilyAccessConfiguration.bundled() else { return nil }
        return {
            AnyView(NativeStorefrontHost(records: records, configuration: configuration, origin: origin, allowsWebsiteRestore: allowsWebsiteRestore, reminders: trialReminders)
                .id(origin))
        }
    }

    private var movingPhones: (() -> AnyView)? {
        guard let origin = records.document?.primaryOrigin, let service = records.movingPhonesService(for: origin) else { return nil }
        return { AnyView(NativeMovingPhonesHost(service: service).id(origin)) }
    }

    private var weeklyReport: (() -> AnyView)? {
        guard let origin = records.document?.primaryOrigin, let store = records.weeklyReportStore(for: origin) else { return nil }
        return { AnyView(NativeWeeklyReportHost(store: store, premium: family.libraryAccess.premium).id(origin)) }
    }

    private func switchPlayer(_ id: String) {
        section = .home
        if records.isPreview {
            updateRoster { $0.select(id) }
            if let index = roster.players.firstIndex(where: { $0.id == id }) {
                updateRecords { try await records.selectPreviewPlayer(index + 1, sounds: GrownUpsView.sounds, preferredSound: player.targetSound) }
            }
        } else if let child = records.document?.primaryFamily?.children.first(where: { NativeFamilyState.scope(of: $0.id) == id }) {
            updateRecords { try await records.selectChild(child.id) }
        }
    }

    private func addPlayer() {
        section = .home
        if records.isPreview {
            updateRoster { $0.addPlayer() }
            switchPlayer(roster.activeID)
        } else {
            updateRecords { try await records.addChild(name: "", age: "", operationID: UUID()) }
        }
    }

    private func removePlayer(_ scope: String) async throws -> Bool {
        guard let owner = records.document?.primaryFamily?.children.first(where: { NativeFamilyState.scope(of: $0.id) == scope })?.id
        else { throw NativeFamilyRuleError.playerChanged }
        try await records.removeChild(owner)
        await clearRemovedPlayers()
        await syncRemindersForCurrentRoute()
        return records.document?.pendingLocalPlayerRemovals?.contains(owner) != true
    }

    private func clearRemovedPlayers() async {
        guard !clearingRemovedPlayers, !records.isPreview,
              let pending = records.document?.pendingLocalPlayerRemovals, !pending.isEmpty else { return }
        clearingRemovedPlayers = true
        defer { clearingRemovedPlayers = false }
        for child in pending {
            do {
                try family.discardRemovedChild(child, isPreview: false)
                NativeSetupDraftStore(defaults: .standard, owner: NativeFamilyState.scope(of: child)).remove()
                try await records.removeObsoletePlayerCopies(child)
            } catch { /* The persisted owner stays queued for the next launch. */ }
        }
    }

    private func recordBook(_ title: String, owner: NativeFamilyChildID?) {
        guard let owner else { return }
        updateRecords {
            let _: NativePracticeSummary = try await records.write(.bookRead, input: .init(title: title), owner: owner)
        }
    }

    private func saveStoryPlace(_ story: NativeAdventure, page: Int, owner: NativeFamilyChildID?) {
        guard story.talk, let owner, records.activeID == owner else { return }
        updateRecords {
            let _: Bool = try await records.write(.storyPlace, input: .init(id: story.id, page: page), owner: owner)
        }
    }

    private func saveStoryIntro(_ story: NativeAdventure, owner: NativeFamilyChildID?) {
        guard !story.talk, let owner, records.activeID == owner else { return }
        updateRecords {
            let _: Bool = try await records.write(.storySeen, input: .init(id: story.id), owner: owner)
        }
    }

    private func readingAccess(owner: NativeFamilyChildID?, book: Bool,
                               isCurrent: @escaping @MainActor () -> Bool) -> NativeReadingAccess? {
        guard let owner else { return nil }
        return NativeReadingAccess(selection: { input in
            guard records.activeID == owner, isCurrent() else { throw NativeFamilyRuleError.playerChanged }
            return try await records.read(book ? .bookWord : .storyWord,
                input: .init(sound: input.sound.uppercased(), word: input.word, title: input.title,
                             captions: input.captions, caption: input.caption))
        }, isCurrent: { !reminderExiting && records.activeID == owner && isCurrent() }, consent: {
            readerMicrophoneAllowed || records.document?.primaryFamily?.storage["sona.micok"] == "1" ? .allowed : .ask
        }, rememberPermission: { readerMicrophoneAllowed = true }, credit: { credit in
            try await applyPlayRep(credit, owner: owner)
        })
    }

    private func completeTalkingIntro(_ story: NativeAdventure, owner: NativeFamilyChildID?) {
        guard story.talk, let owner, records.activeID == owner else { return }
        updateRecords {
            let _: FamilyJSONValue = try await records.write(.questFinish, input: .init(game: story.game), owner: owner,
                                                             receipt: "\(UUID().uuidString)/talk")
        }
    }

    private func adventureGameAccess(story: NativeAdventure, owner: NativeFamilyChildID?) -> NativeAdventureGameAccess? {
        guard let owner, !story.talk else { return nil }
        return NativeAdventureGameAccess(load: { game in
            guard records.activeID == owner, family.libraryAccess.allowsStory, game == story.game else {
                throw NativeFamilyRuleError.playerChanged
            }
            return try await records.read(.speechGame, input: .init(game: game))
        }, isCurrent: {
            records.activeID == owner && experience?.id == "story-\(story.id)"
        }, credit: { credit in
            try await applyPlayRep(credit, owner: owner)
        }, finish: { game, receipt in
            do {
                let _: FamilyJSONValue = try await records.write(.questFinish, input: .init(game: game), owner: owner,
                                                                receipt: "\(receipt.uuidString)/story")
            } catch NativeFamilyRuleError.replayed {
                try await records.refresh()
            }
        })
    }

    private func openFoundStory(_ story: NativeAdventure) {
        guard let owner = records.activeID, family.libraryAccess.allowsStory,
              foundStories.contains(where: { $0.id == story.id }) else { return }
        experience = .storyReplay(story, owner: owner, id: UUID())
    }

    private func replayAccess(story: NativeAdventure, owner: NativeFamilyChildID, id: UUID) -> NativeAdventureGameAccess {
        NativeAdventureGameAccess(load: { game in
            guard records.activeID == owner, family.libraryAccess.allowsStory,
                  foundStories.contains(where: { $0.id == story.id && $0.game == game }) else {
                throw NativeFamilyRuleError.playerChanged
            }
            return try await records.read(.speechGame, input: .init(game: game))
        }, isCurrent: { !reminderExiting && records.activeID == owner && experience?.id == id.uuidString },
           credit: { try await applyPlayRep($0, owner: owner) }, finish: { _, _ in })
    }

    @ViewBuilder private func foundStoryBoard(_ key: String) -> some View {
        if let game = NativeStoryGame(rawValue: key) {
            StoryGamesView(game: game) { experience = nil }
        } else if let game = StoryVillageGame(rawValue: key) {
            StoryVillageGamesView(game: game) {}
        } else if let game = StoryWorkshopGame(rawValue: key) {
            StoryWorkshopGamesView(game: game) {}
        }
    }

    private var readingPlaces: Binding<[String: BookBookmark]> {
        guard !records.isPreview, let owner = records.activeID else { return playerBinding(\.bookmarks) }
        return Binding {
            records.document?.bookmarks(for: owner).mapValues { BookBookmark(page: $0.page, finished: $0.finished) } ?? [:]
        } set: { marks in
            let saved = records.document?.bookmarks(for: owner) ?? [:]
            updateRecords {
                for (bookID, bookmark) in marks where saved[bookID] != NativeFamilyReadingPlace(page: bookmark.page, finished: bookmark.finished) {
                    try await records.recordReadingPlace(bookmark, bookID: bookID, owner: owner)
                }
            }
        }
    }

    private func finish(_ game: NativeGame, playerID: String) {
        updatePlayer(playerID) { $0.completedGames.insert(game.id) }
    }

    private func finishVerifiedGame(_ game: NativeGame, after practice: PracticeDestination) {
        guard practiceLaunch?.id == practice.id, records.activeID == practice.owner else { return }
        if records.isPreview { finish(game, playerID: practice.playerID) }
        saveQuestCompletion(game, owner: practice.owner, id: practice.id)
    }

    private func saveQuestCompletion(_ game: NativeGame, owner: NativeFamilyChildID, id: UUID) {
        updateRecords {
            let _: FamilyJSONValue = try await records.write(.questFinish, input: .init(game: game.shippingID), owner: owner,
                receipt: "\(id.uuidString)/game", gameCompletion: game.id)
        }
    }

    private var arcadeLevelsAccess: NativeArcadeLevelsAccess? {
        guard let owner = records.activeID else { return nil }
        return records.arcadeLevelsAccess(owner: owner, revision: arcadeLevelRevision, canOpen: { key in
            guard let game = NativeGame.allCases.first(where: { $0.shippingID == key }) else { return false }
            return family.libraryAccess.allows(game)
        }, didChange: { arcadeLevelRevision += 1 })
    }

    private func openGame(_ game: NativeGame) {
        guard family.libraryAccess.allows(game) else { openStoreIfEligible(); return }
        guard arcadeLevelLoad == nil, practiceLoad == nil, experience == nil,
              let owner = records.activeID, let access = arcadeLevelsAccess else { return }
        let token = UUID(); arcadeLevelLoad = token
        Task { @MainActor in
            defer { if arcadeLevelLoad == token { arcadeLevelLoad = nil } }
            do {
                let preparation = try await NativeArcadeLevels(access: access).prepare(gameID: game.shippingID)
                guard records.activeID == owner, arcadeLevelLoad == token, experience == nil else { return }
                switch preparation {
                case .choose(let info):
                    arcadeLevelChoice = ArcadeLevelChoice(game: game, owner: owner, info: info)
                    sheet = .arcadeLevels
                case .launch(let round): launchGame(game, round: round)
                }
            } catch is CancellationError { }
            catch { practiceStatus = "Sona couldn’t open this game. Try again." }
        }
    }

    private func launchGame(_ game: NativeGame, round: NativeArcadeRoundContext) {
        guard family.libraryAccess.allows(game), round.gameID == game.shippingID else { return }
        if game.guidedPracticeFile != nil { startPractice(game, preparedRound: round) }
        else if game == .feed { startFeed() }
        else { startSpeechGame(game, preparedRound: round) }
    }

    private func capturedArcadeRound(for game: NativeGame?, prepared: NativeArcadeRoundContext?, retainingLevel: Int?) async throws -> NativeArcadeRoundContext? {
        guard let game else { return nil }
        if let prepared { return prepared }
        guard let access = arcadeLevelsAccess else { throw CancellationError() }
        switch try await NativeArcadeLevels(access: access).prepare(gameID: game.shippingID, askIfNew: false, retainingLevel: retainingLevel) {
        case .launch(let round): return round
        case .choose: throw NativeArcadeLevels.Failure.invalidProjection
        }
    }

    private func startFeed(replacing previous: UUID? = nil) {
        guard practiceLoad == nil, let owner = records.activeID else { return }
        let id = UUID(), playerID = player.id
        practiceLoad = id
        Task {
            defer { if practiceLoad == id { practiceLoad = nil } }
            do {
                let selection: NativeFeedSelection = try await records.read(.feedGame)
                guard records.activeID == owner, experience?.id == previous?.uuidString, practiceLoad == id else { return }
                guard selection.isSupported else { throw NativeFamilyRuleError.invalidKey }
                experience = .feed(FeedDestination(id: id, owner: owner, playerID: playerID, selection: selection))
            } catch {
                practiceStatus = "Sona couldn’t open Feed Echo. Try again."
            }
        }
    }

    private func storeFeedBite(_ move: UUID, for feed: FeedDestination) async throws -> Int {
        guard records.activeID == feed.owner, experience?.id == feed.id.uuidString else {
            throw NativeFamilyRuleError.playerChanged
        }
        do {
            return try await records.write(.feedGrowth, owner: feed.owner, receipt: "\(move.uuidString)/feed")
        } catch NativeFamilyRuleError.replayed {
            guard records.activeID == feed.owner else { throw NativeFamilyRuleError.playerChanged }
            return try await records.read(.feedCount)
        }
    }

    private func startSpeechGame(_ game: NativeGame, replacing previous: UUID? = nil, preparedRound: NativeArcadeRoundContext? = nil, retainingLevel: Int? = nil, retainingDinoMemory: NativeDinoCollectionMemory? = nil) {
        guard practiceLoad == nil, let owner = records.activeID else { return }
        let id = UUID(), playerID = player.id
        practiceLoad = id
        Task {
            defer { if practiceLoad == id { practiceLoad = nil } }
            do {
                let round = try await capturedArcadeRound(for: game, prepared: preparedRound, retainingLevel: retainingLevel)
                let selection: NativeSpeechGameSelection? = try await records.read(.speechGame, input: .init(game: game.shippingID))
                guard records.activeID == owner, experience?.id == previous?.uuidString, practiceLoad == id else { return }
                guard let selection, !selection.targets.isEmpty else { throw NativeFamilyRuleError.invalidKey }
                experience = .speechGame(SpeechGameDestination(id: id, owner: owner, game: game, playerID: playerID, selection: selection, arcadeRound: round, dinoMemory: game == .dino ? (retainingDinoMemory.flatMap { $0.owner == owner ? $0 : nil } ?? NativeDinoCollectionMemory(owner: owner)) : nil))
            } catch {
                practiceStatus = "Sona couldn’t open this game. Try again."
            }
        }
    }

    private func dinoCollectionAccess(for destination: SpeechGameDestination) -> NativeDinoCollectionAccess? {
        guard destination.game == .dino, let memory = destination.dinoMemory else { return nil }
        return records.dinoCollectionAccess(owner: destination.owner, memory: memory,
            isCurrent: { experience?.id == destination.id.uuidString && family.libraryAccess.allows(.dino) })
    }

    private func applyPlayRep(_ credit: GameSayingCredit, owner: NativeFamilyChildID) async throws {
        guard owner == records.activeID else { throw NativeFamilyRuleError.playerChanged }
        do {
            let _: FamilyJSONValue = try await records.write(.gameRep, input: .init(sound: credit.sound), owner: owner,
                receipt: "\(credit.gateID.uuidString)/saying/\(credit.sequence)")
        } catch NativeFamilyRuleError.replayed {
            try await records.refresh()
        }
    }

    private func startPractice(_ game: NativeGame? = nil, replacing previous: UUID? = nil,
                               preparedRound: NativeArcadeRoundContext? = nil, retainingLevel: Int? = nil,
                               setupGuide: NativeSetupHandoff? = nil) {
        guard family.libraryAccess.allowsPractice else { openStoreIfEligible(); return }
        guard practiceLoad == nil, let owner = records.activeID else { return }
        let id = UUID(), playerID = player.id
        if let setupGuide {
            firstSetupGuide = setupGuide
            firstSetupGuidePresented = false
        }
        practiceLoad = id
        Task {
            defer {
                if practiceLoad == id { practiceLoad = nil }
                if let setupGuide, firstSetupGuide == setupGuide, experience?.id != id.uuidString {
                    firstSetupGuide = nil
                    firstSetupGuidePresented = false
                }
            }
            do {
                let round = try await capturedArcadeRound(for: game, prepared: preparedRound, retainingLevel: retainingLevel)
                let selection: NativePracticeSelection = try await records.read(.practiceTarget, input: .init(game: game?.guidedPracticeFile))
                guard records.activeID == owner, experience?.id == previous?.uuidString, practiceLoad == id else { return }
                practiceLaunch = nil
                experience = .practice(PracticeDestination(id: id, owner: owner, game: game, playerID: playerID, selection: selection, arcadeRound: round))
            } catch {
                practiceStatus = "Sona couldn’t open this practice. Try again."
            }
        }
    }

    private func sendParentProgress() async -> Bool {
        guard let owner = records.activeID,
              let snapshot: FamilyEnrollmentSnapshot = try? await records.read(.enrollmentSnapshot),
              owner == records.activeID else { return false }
        return await family.shareProgress(snapshot: snapshot, owner: owner, manual: true)
    }

    private func applyPractice(_ effect: PracticeFlowMachine.Effect, to destination: PracticeDestination) async throws {
        guard records.activeID == destination.owner, experience?.id == destination.id.uuidString else {
            throw NativeFamilyRuleError.playerChanged
        }
        let owner = destination.owner
        do {
            switch effect {
            case .saveVerifiedAttempt(let attempt):
                let content = attempt.content, result = attempt.result
                guard result.reps > 0, result.verdict != .unknown else { return }
                let input = NativeRuleFields(sound: content.target.sound, word: content.target.word, level: content.rung.rawValue,
                                             pos: content.position, pass: result.verdict == .pass, reps: result.reps)
                let _: NativePracticeSummary = try await records.write(.attempt, input: input, owner: owner,
                    receipt: "\(destination.id.uuidString)/attempt/\(attempt.id.sequence)")
                Task {
                    guard records.activeID == owner,
                          let snapshot: FamilyEnrollmentSnapshot = try? await records.read(.enrollmentSnapshot) else { return }
                    await family.shareProgress(snapshot: snapshot, owner: owner)
                }
            case .recordRungWin(let content):
                let input = NativeRuleFields(sound: content.target.sound, pos: destination.selection.practicePosition, rung: content.rung.index)
                let _: FamilyJSONValue = try await records.write(.rungWin, input: input, owner: owner,
                    receipt: "\(destination.id.uuidString)/rung")
            case .readyForGame(let ready):
                let input = NativeRuleFields(sound: ready.content.target.sound, advance: ready.advanceRing, sessionTries: ready.practiceSessionTries)
                let _: NativePracticeSummary = try await records.write(.roundReady, input: input, owner: owner,
                    receipt: "\(destination.id.uuidString)/ready")
            case .beginTurn, .cancelTurn, .showQuiet:
                break
            }
        } catch NativeFamilyRuleError.replayed {
            try await records.refresh()
        }
    }

    @ViewBuilder
    private func play(_ game: NativeGame, stage: Int = 0, onLifeLost: (() -> Void)? = nil,
                      onFinish: @escaping () -> Void) -> some View {
        switch game {
        case .slice:
            FruitSliceView(stage: stage, onLifeLost: onLifeLost, onRoundFinished: onFinish)
        case .glide:
            FlyingGamesView(game: .glide, stage: stage, onLifeLost: onLifeLost, onRoundFinished: onFinish)
        case .rise:
            FlyingGamesView(game: .rise, stage: stage, onLifeLost: onLifeLost, onRoundFinished: onFinish)
        case .sprint:
            SprintView(onRoundFinished: onFinish, stage: stage, onLifeLost: onLifeLost)
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
            ArcadeRoundView(game: game, onRoundFinished: onFinish, stage: stage, onLifeLost: onLifeLost)
        }
    }
}

enum Destination: Hashable {
    case home, games, books, practice
}

@MainActor private struct NativeMovingPhonesHost: View {
    @StateObject private var service: FamilyMovingPhonesService

    init(service: FamilyMovingPhonesService) {
        _service = StateObject(wrappedValue: service)
    }

    var body: some View { FamilyMovingPhonesView(service: service) }
}

@MainActor private struct NativeWeeklyReportHost: View {
    let store: NativeFamilyReportStore
    let premium: Bool

    var body: some View {
        Form { NativeFamilyReportView(store: store, premium: premium) }
            .navigationTitle("Weekly progress report")
    }
}

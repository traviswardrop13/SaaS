import SwiftUI

private struct ArcadeRoundContextKey: EnvironmentKey {
    static let defaultValue: NativeArcadeRoundContext? = nil
}
private struct ArcadeGameCardsKey: EnvironmentKey {
    static let defaultValue: [String: NativeArcadeLevelCatalog.Game] = [:]
}
extension EnvironmentValues {
    var arcadeRoundContext: NativeArcadeRoundContext? {
        get { self[ArcadeRoundContextKey.self] }
        set { self[ArcadeRoundContextKey.self] = newValue }
    }
    var arcadeGameCards: [String: NativeArcadeLevelCatalog.Game] {
        get { self[ArcadeGameCardsKey.self] }
        set { self[ArcadeGameCardsKey.self] = newValue }
    }
}

/// Pure shelf reads. Presenting Home/Games never spends the one-time ask.
struct NativeArcadeLevelCards<Content: View>: View {
    let access: NativeArcadeLevelsAccess?
    let refresh: String
    @ViewBuilder let content: () -> Content
    @State private var cards: [String: NativeArcadeLevelCatalog.Game] = [:]
    var body: some View {
        content().environment(\.arcadeGameCards, cards)
            .task(id: "\(access?.scope ?? "")/\(access?.revision ?? 0)/\(refresh)") {
                cards = [:]
                guard let access else { return }
                do {
                    let result = try await NativeArcadeLevels(access: access).catalog()
                    guard access.isCurrent(), !Task.isCancelled else { return }
                    cards = Dictionary(uniqueKeysWithValues: result.games.map { ($0.key, $0) })
                } catch { /* A missing tag never blocks the existing game. */ }
            }
    }
}

struct NativeArcadeLevelSheet: View {
    let title: String
    let info: NativeArcadeLevelInfo
    let choose: @MainActor (Int) async throws -> Void
    let close: () -> Void
    @State private var settling = true
    @State private var busy = false
    @State private var note = ""
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 16) {
                    ForEach(info.levels) { level in
                        Button {
                            guard !settling, !busy else { return }
                            guard level.open else { note = lockedNote(level); return }
                            busy = true; note = ""
                            Task { @MainActor in
                                do { try await choose(level.n) }
                                catch is CancellationError { close() }
                                catch { note = "Sona couldn’t save that choice. Try again." }
                                busy = false
                            }
                        } label: {
                            HStack(spacing: 14) {
                                Text(String(level.n)).font(.system(size: 33, weight: .heavy, design: .rounded))
                                VStack(alignment: .leading, spacing: 7) {
                                    Text(level.line).font(.headline)
                                    if !level.open { Label(String(level.at), systemImage: "trophy.fill").font(.footnote) }
                                }
                                Spacer()
                                Image(systemName: level.open ? (level.n == info.pick ? "checkmark.circle.fill" : "circle") : "lock.fill")
                            }.padding(18).frame(maxWidth: .infinity, minHeight: 90)
                                .background(.white, in: RoundedRectangle(cornerRadius: 20))
                        }
                        .buttonStyle(.plain).disabled(settling || busy)
                        .accessibilityLabel(level.open ? "Level \(level.n). \(level.line)" : "Level \(level.n). Opens at \(level.at) trophies. You have \(level.have).")
                        .accessibilityIdentifier("arcade-level-\(level.n)")
                    }
                    if busy { ProgressView() }
                    if !note.isEmpty { Text(note).font(.subheadline).multilineTextAlignment(.center).accessibilityIdentifier("arcade-level-note") }
                }.padding(20)
            }
            .background(SonaPalette.paper.ignoresSafeArea())
            .foregroundStyle(SonaPalette.ink)
            .navigationTitle(title).navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close", action: close).disabled(settling || busy) } }
        }
        .navigationViewStyle(.stack)
        .interactiveDismissDisabled(settling || busy)
        .task {
            do { try await Task.sleep(nanoseconds: 500_000_000); try Task.checkCancellation(); settling = false }
            catch { }
        }
    }
    private func lockedNote(_ level: NativeArcadeLevelInfo.Level) -> String {
        "Level \(level.n) opens at \(level.at) trophies. Keep practicing!"
    }
}

/// The Road's persistent chooser never calls ask and never launches a game.
struct NativeArcadeLevelsRoadSection: View {
    let access: NativeArcadeLevelsAccess
    @State private var catalog: NativeArcadeLevelCatalog?
    @State private var busy = false
    @State private var note = ""
    var body: some View {
        Group {
            if let catalog, catalog.open >= 2 {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Game levels").font(.system(.title2, design: .rounded).weight(.heavy))
                    ForEach(catalog.games.filter { $0.allowed && !$0.info.levels.isEmpty }) { game in
                        VStack(alignment: .leading, spacing: 9) {
                            Text(game.name).font(.headline)
                            HStack {
                                ForEach(game.info.levels) { level in
                                    Button {
                                        guard !busy else { return }
                                        guard level.open else {
                                            note = "Level \(level.n) opens at \(level.at) trophies. Keep practicing!"; return
                                        }
                                        busy = true
                                        Task { @MainActor in
                                            do {
                                                self.catalog = try await NativeArcadeLevels(access: access).chooseOnRoad(gameID: game.key, level: level.n)
                                                note = ""
                                            } catch is CancellationError { self.catalog = nil }
                                            catch { note = "Sona couldn’t save that choice. Try again." }
                                            busy = false
                                        }
                                    } label: {
                                        HStack {
                                            Text(String(level.n)).bold()
                                            if !level.open { Image(systemName: "lock.fill") }
                                            else if level.n == game.info.pick { Image(systemName: "checkmark") }
                                        }.frame(maxWidth: .infinity, minHeight: 48)
                                            .background(level.n == game.info.pick ? SonaPalette.mint : .white, in: Capsule())
                                    }.buttonStyle(.plain).disabled(busy)
                                        .accessibilityLabel(level.open ? "Level \(level.n). \(level.line)" : "Level \(level.n). Opens at \(level.at) trophies. You have \(level.have).")
                                        .accessibilityIdentifier("road-level-\(game.key)-\(level.n)")
                                }
                            }
                        }
                    }
                    if !note.isEmpty { Text(note).font(.subheadline).accessibilityIdentifier("road-level-note") }
                }.padding(18).background(SonaPalette.paper, in: RoundedRectangle(cornerRadius: 22))
            }
        }
        .task(id: "\(access.scope)/\(access.revision)") {
            catalog = nil
            do { catalog = try await NativeArcadeLevels(access: access).catalog() }
            catch { }
        }
    }
}

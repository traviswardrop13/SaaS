import SwiftUI

/// Review data only. The caller supplies local preview records; this view
/// never derives speech practice, goal days or rewards from finger play.
struct ParentPreviewProgressSnapshot: Equatable {
    let selectedSound: String
    let completedGameTitles: [String]
    let bookPositions: [ParentPreviewBookPosition]

    init(selectedSound: String = "", completedGameTitles: [String] = [], bookPositions: [ParentPreviewBookPosition] = []) {
        self.selectedSound = selectedSound
        self.completedGameTitles = completedGameTitles
        self.bookPositions = bookPositions
    }

    var games: [String] {
        Array(Set(completedGameTitles.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }))
            .sorted { $0.localizedStandardCompare($1) == .orderedAscending }
    }

    var books: [ParentPreviewBookPosition] {
        var seen = Set<String>()
        return bookPositions.filter { $0.totalPages > 0 && !$0.id.isEmpty && seen.insert($0.id).inserted }
            .sorted { $0.title.localizedStandardCompare($1.title) == .orderedAscending }
    }
}

struct ParentPreviewBookPosition: Identifiable, Equatable {
    let id: String
    let title: String
    /// The saved bookmark is zero-based, just like BookBookmark.page.
    let pageIndex: Int
    let totalPages: Int
    let finished: Bool

    var displayedPage: Int { max(0, min(pageIndex, max(1, totalPages) - 1)) + 1 }
    var positionLabel: String { finished ? "Reached the last page" : "Last open: page \(displayedPage) of \(totalPages)" }
}

/// Embed behind the app's existing grown-ups gate. No authentication, clinical
/// data, storage, analytics or network capability is present here.
struct ParentPreviewProgressView: View {
    let snapshot: ParentPreviewProgressSnapshot

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                heading
                summary
                gameRecords
                bookRecords
                practiceNote
            }
            .padding(22)
            .frame(maxWidth: 700, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .top)
        }
        .background(ParentProgressStyle.paper.ignoresSafeArea())
        .foregroundStyle(ParentProgressStyle.ink)
        .navigationTitle("Preview progress")
        .navigationBarTitleDisplayMode(.inline)
        .preferredColorScheme(.light)
    }

    private var heading: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("A little look at their play.")
                .font(.system(.largeTitle, design: .rounded).weight(.heavy))
                .accessibilityAddTraits(.isHeader)
                .accessibilityIdentifier("parent-preview-progress")
                .fixedSize(horizontal: false, vertical: true)
            Text("These are the game completions and book positions saved in this native preview.")
                .font(.body).foregroundStyle(ParentProgressStyle.muted)
                .fixedSize(horizontal: false, vertical: true)
            let sound = snapshot.selectedSound.trimmingCharacters(in: .whitespacesAndNewlines)
            Label(sound.isEmpty ? "Practice sound not selected" : "Selected sound: \(sound)", systemImage: "waveform")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(ParentProgressStyle.teal)
                .padding(.horizontal, 13).padding(.vertical, 10)
                .background(ParentProgressStyle.teal.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
                .accessibilityIdentifier("parent-preview-sound")
        }
    }

    private var summary: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 145), spacing: 12)], alignment: .leading, spacing: 12) {
            stat(number: snapshot.games.count, title: "Games completed", symbol: "gamecontroller")
                .accessibilityIdentifier("parent-preview-game-count")
            stat(number: snapshot.books.count, title: "Books with a bookmark", symbol: "bookmark")
                .accessibilityIdentifier("parent-preview-book-count")
        }
    }

    private func stat(number: Int, title: String, symbol: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Image(systemName: symbol).font(.title2).foregroundStyle(ParentProgressStyle.teal)
                .accessibilityHidden(true)
            Text(number.formatted()).font(.system(.largeTitle, design: .rounded).weight(.bold))
            Text(title).font(.subheadline.weight(.medium)).fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, minHeight: 132, alignment: .topLeading)
        .padding(18)
        .background(.white, in: RoundedRectangle(cornerRadius: 21))
        .accessibilityElement(children: .combine)
    }

    private var gameRecords: some View {
        VStack(alignment: .leading, spacing: 15) {
            sectionHeading("Games completed", symbol: "gamecontroller")
            if snapshot.games.isEmpty {
                Text("No game rounds have finished in this preview yet.")
                    .foregroundStyle(ParentProgressStyle.muted)
            } else {
                VStack(spacing: 0) {
                    ForEach(snapshot.games, id: \.self) { title in
                        HStack(alignment: .firstTextBaseline, spacing: 12) {
                            Image(systemName: "checkmark.circle.fill").foregroundStyle(ParentProgressStyle.teal)
                                .accessibilityHidden(true)
                            Text(title).font(.body.weight(.medium))
                            Spacer(minLength: 0)
                        }
                        .padding(.vertical, 12)
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel(title + ", round completed")
                        if title != snapshot.games.last { Divider() }
                    }
                }
                .padding(.horizontal, 17)
                .background(.white, in: RoundedRectangle(cornerRadius: 20))
                Text("Each game appears once, even after another round.")
                    .font(.footnote).foregroundStyle(ParentProgressStyle.muted)
            }
        }
        .accessibilityIdentifier("parent-preview-games")
    }

    private var bookRecords: some View {
        VStack(alignment: .leading, spacing: 15) {
            sectionHeading("Book positions", symbol: "book")
            if snapshot.books.isEmpty {
                Text("Open a story to save a place for next time.")
                    .foregroundStyle(ParentProgressStyle.muted)
            } else {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(snapshot.books) { book in
                        VStack(alignment: .leading, spacing: 7) {
                            Text(book.title).font(.body.weight(.semibold))
                            Text(book.positionLabel).font(.subheadline).foregroundStyle(ParentProgressStyle.muted)
                        }
                        .padding(.vertical, 14)
                        .accessibilityElement(children: .combine)
                        if book.id != snapshot.books.last?.id { Divider() }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 17)
                .background(.white, in: RoundedRectangle(cornerRadius: 20))
            }
            Text("A saved page shows where the book was open. Page turns do not confirm reading or spoken practice.")
                .font(.footnote).foregroundStyle(ParentProgressStyle.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityIdentifier("parent-preview-books")
    }

    private var practiceNote: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Speech practice and rewards", systemImage: "info.circle")
                .font(.system(.headline, design: .rounded).weight(.bold))
            Text("Speech sessions, daily goals and Trophy Road balances are not connected to this preview yet. Game completions and page turns add no practice reps or rewards.")
                .font(.subheadline).foregroundStyle(ParentProgressStyle.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(18)
        .background(ParentProgressStyle.teal.opacity(0.07), in: RoundedRectangle(cornerRadius: 20))
        .accessibilityIdentifier("parent-preview-practice-note")
    }

    private func sectionHeading(_ title: String, symbol: String) -> some View {
        Label(title, systemImage: symbol)
            .font(.system(.title3, design: .rounded).weight(.bold))
            .accessibilityAddTraits(.isHeader)
    }
}

private enum ParentProgressStyle {
    static let paper = Color(red: 0.99, green: 0.98, blue: 0.95)
    static let ink = Color(red: 0.18, green: 0.20, blue: 0.23)
    static let muted = Color(red: 0.37, green: 0.40, blue: 0.42)
    static let teal = Color(red: 0.04, green: 0.44, blue: 0.46)
}

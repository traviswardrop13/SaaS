import SwiftUI
import UIKit
import ImageIO

/// Reading position only. Finishing a book never creates a speech-practice rep.
struct BookBookmark: Codable, Equatable {
    var page: Int
    var finished: Bool

    init(page: Int = 0, finished: Bool = false) {
        self.page = page
        self.finished = finished
    }
}

struct BookShelfView: View {
    let targetSound: String
    let access: FamilyLibraryAccess
    @Binding var bookmarks: [String: BookBookmark]

    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(\.scenePhase) private var scenePhase
    @State private var catalog: [NativeBook] = []
    @State private var catalogFailed = false
    @State private var selectedBook: NativeBook?
    @State private var today = Date()

    private var sound: String {
        targetSound.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
    }

    private var visibleBooks: [NativeBook] {
        let day = BookCalendar.day(today)
        return catalog.filter {
            (sound.isEmpty || $0.sound.uppercased() == sound) && $0.inSeason(on: day)
        }.sorted { first, second in
            let firstOpen = first.isOpen(on: day), secondOpen = second.isOpen(on: day)
            if firstOpen != secondOpen { return firstOpen }
            if !firstOpen { return (first.opens ?? "") < (second.opens ?? "") }
            return false // Stable source order for all currently open books.
        }
    }

    private var continuingBook: NativeBook? {
        visibleBooks.first {
            guard $0.isOpen(on: BookCalendar.day(today)), access.allowsBook(named: $0.title),
                  let mark = bookmarks[$0.id] else { return false }
            return !mark.finished && mark.page > 0 && mark.page < $0.pages.count
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    shelfHeading

                    if catalogFailed {
                        emptyShelf("Stories couldn’t open", message: "Please try again.", symbol: "book.closed")
                        Button("Try again", action: loadCatalog)
                    } else if visibleBooks.isEmpty {
                        emptyShelf(
                            "No stories here yet",
                            message: "There aren’t any available books for this sound today.",
                            symbol: "books.vertical"
                        )
                    } else {
                        if let book = continuingBook {
                            continueCard(book)
                        }

                        LazyVGrid(
                            columns: typeSize.isAccessibilitySize
                                ? [GridItem(.flexible())]
                                : [GridItem(.adaptive(minimum: 130, maximum: 240), spacing: 18, alignment: .top)],
                            alignment: .leading, spacing: 25
                        ) {
                            ForEach(visibleBooks) { book in
                                bookCard(book)
                            }
                        }
                    }
                }
                .padding(22)
                .frame(maxWidth: 840)
                .frame(maxWidth: .infinity)
            }
            .background(BookPalette.paper)
            .navigationTitle("Books")
            .toolbarBackground(BookPalette.paper, for: .navigationBar)
            .fullScreenCover(item: $selectedBook) { book in
                NativeBookReader(
                    book: book,
                    bookmark: Binding(
                        get: { bookmarks[book.id] ?? BookBookmark() },
                        set: { bookmarks[book.id] = $0 }
                    )
                )
            }
        }
        .tint(BookPalette.teal)
        .preferredColorScheme(.light)
        .task { loadCatalog() }
        .onChange(of: targetSound) { _ in selectedBook = nil }
        .onChange(of: scenePhase) { phase in
            if phase == .active { today = Date() }
        }
    }

    private func emptyShelf(_ title: String, message: String, symbol: String) -> some View {
        VStack(spacing: 10) {
            Image(systemName: symbol)
                .font(.system(size: 37))
                .accessibilityHidden(true)
            Text(title).font(.system(.headline, design: .rounded, weight: .heavy))
            Text(message).font(.system(.subheadline, design: .rounded))
        }
        .multilineTextAlignment(.center)
        .foregroundStyle(BookPalette.secondary)
        .padding(24)
        .frame(maxWidth: .infinity)
    }

    private var shelfHeading: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Choose a story to read.")
                .font(.system(.title3, design: .rounded, weight: .medium))
                .foregroundStyle(BookPalette.secondary)

            HStack(spacing: 8) {
                Image(systemName: "books.vertical")
                Text(sound.isEmpty ? "All sounds" : NativeBook.soundLabel(sound) + " sound stories")
            }
            .font(.system(.subheadline, design: .rounded, weight: .bold))
            .foregroundStyle(BookPalette.teal)
            .padding(.horizontal, 13)
            .padding(.vertical, 10)
            .background(BookPalette.mint, in: Capsule())
            .accessibilityIdentifier("books-current-sound")
            .accessibilityHint("Your current sound. Changes belong in Grown-ups.")
        }
    }

    private func continueCard(_ book: NativeBook) -> some View {
        Button {
            selectedBook = book
        } label: {
            HStack(spacing: 16) {
                BookArtwork(path: book.cover, emoji: book.emoji, mode: .fill)
                    .frame(width: 76, height: 88)
                    .clipShape(RoundedRectangle(cornerRadius: 14))

                VStack(alignment: .leading, spacing: 6) {
                    Text("CONTINUE READING")
                        .font(.system(.caption, design: .rounded, weight: .heavy))
                        .tracking(0.8)
                        .foregroundStyle(BookPalette.teal)
                    Text(book.title)
                        .font(.system(.headline, design: .rounded, weight: .bold))
                        .foregroundStyle(BookPalette.ink)
                    Text("Page \((bookmarks[book.id]?.page ?? 0) + 1) of \(book.pages.count)")
                        .font(.system(.caption, design: .rounded))
                        .foregroundStyle(BookPalette.secondary)
                }
                Spacer(minLength: 0)
                Image(systemName: "arrow.right")
                    .foregroundStyle(BookPalette.teal)
            }
            .padding(14)
            .background(.white.opacity(0.8), in: RoundedRectangle(cornerRadius: 22))
            .overlay(RoundedRectangle(cornerRadius: 22).strokeBorder(BookPalette.line))
        }
        .buttonStyle(BookPressStyle())
        .accessibilityIdentifier("books-continue")
    }

    private func bookCard(_ book: NativeBook) -> some View {
        let released = book.isOpen(on: BookCalendar.day(today))
        let open = released && access.allowsBook(named: book.title)
        let status = released ? "Premium" : "Coming " + BookCalendar.label(book.opens ?? "")
        let finished = bookmarks[book.id]?.finished == true

        return Button {
            guard open else { return }
            selectedBook = book
        } label: {
            VStack(alignment: .leading, spacing: 10) {
                BookArtwork(path: book.cover, emoji: book.emoji, mode: .fill)
                    .aspectRatio(1, contentMode: .fit)
                    .clipShape(RoundedRectangle(cornerRadius: 20))
                    .overlay(alignment: .topTrailing) {
                        if finished {
                            Image(systemName: "checkmark")
                                .font(.system(.caption, design: .rounded, weight: .heavy))
                                .foregroundStyle(.white)
                                .padding(9)
                                .background(BookPalette.teal, in: Circle())
                                .padding(9)
                        }
                    }
                    .overlay(RoundedRectangle(cornerRadius: 20).strokeBorder(BookPalette.line.opacity(0.5)))

                Text(book.title)
                    .font(.system(.headline, design: .rounded, weight: .bold))
                    .foregroundStyle(BookPalette.ink)
                    .fixedSize(horizontal: false, vertical: true)

                Text(open ? "\(book.pages.count) pages" : status)
                    .font(.system(.caption, design: .rounded, weight: .medium))
                    .foregroundStyle(BookPalette.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .topLeading)
            .opacity(open ? 1 : 0.55)
            .contentShape(Rectangle())
        }
        .buttonStyle(BookPressStyle())
        .disabled(!open)
        .accessibilityElement(children: .ignore)
        .accessibilityAddTraits(.isButton)
        .accessibilityLabel(book.title + (finished ? ", finished" : "") + ", \(book.pages.count) pages")
        .accessibilityHint(open ? (finished ? "Read again" : "Open story") : status)
        .accessibilityIdentifier("book-" + book.id)
    }

    private func loadCatalog() {
        do {
            let url = Bundle.main.url(forResource: "Books", withExtension: "json", subdirectory: "Content")
                ?? Bundle.main.url(forResource: "Books", withExtension: "json")
            guard let url else { throw BookArtworkError.unavailable }
            let decoded = try JSONDecoder().decode(NativeBookCatalog.self, from: Data(contentsOf: url))
            guard decoded.version == 1, !decoded.books.isEmpty,
                  Set(decoded.books.map(\.id)).count == decoded.books.count,
                  decoded.books.allSatisfy({ !$0.pages.isEmpty }) else { throw BookArtworkError.unavailable }
            catalog = decoded.books
            catalogFailed = false
        } catch {
            catalogFailed = true
        }
    }
}

private struct NativeBookCatalog: Decodable {
    let version: Int
    let books: [NativeBook]
}

private struct NativeBook: Decodable, Identifiable {
    let id: String
    let title: String
    let sound: String
    let emoji: String
    let cover: String
    let coverAlt: String
    let pages: [NativeBookPage]
    let opens: String?
    let season: NativeBookSeason?

    func inSeason(on day: String) -> Bool {
        guard let season else { return true }
        return season.startsOn <= day && day <= season.endsOn
    }

    func isOpen(on day: String) -> Bool { opens.map { $0 <= day } ?? true }

    static func soundLabel(_ sound: String) -> String { sound == "THV" ? "TH (voiced)" : sound }
}

private struct NativeBookSeason: Decodable {
    let startsOn: String
    let endsOn: String
}

private struct NativeBookPage: Decodable {
    let text: String
    let art: String
    let alt: String
    let emoji: String
    let crop: BookArtCrop?
}

private struct BookArtCrop: Decodable, Hashable, Sendable {
    let column: Int
    let row: Int
    let columns: Int
    let rows: Int
}

private enum BookCalendar {
    static func day(_ date: Date) -> String {
        let format = DateFormatter()
        format.locale = Locale(identifier: "en_US_POSIX")
        format.calendar = Calendar(identifier: .gregorian)
        format.timeZone = .current
        format.dateFormat = "yyyy-MM-dd"
        return format.string(from: date)
    }

    static func label(_ day: String) -> String {
        let parser = DateFormatter()
        parser.locale = Locale(identifier: "en_US_POSIX")
        parser.calendar = Calendar(identifier: .gregorian)
        parser.dateFormat = "yyyy-MM-dd"
        guard let date = parser.date(from: day) else { return day }
        return date.formatted(.dateTime.month(.abbreviated).day())
    }
}

private struct NativeBookReader: View {
    let book: NativeBook
    @Binding var bookmark: BookBookmark
    @Environment(\.dismiss) private var dismiss
    @Environment(\.dynamicTypeSize) private var typeSize
    @State private var page: Int

    init(book: NativeBook, bookmark: Binding<BookBookmark>) {
        self.book = book
        self._bookmark = bookmark
        let mark = bookmark.wrappedValue
        self._page = State(initialValue: mark.finished || mark.page <= 0 ? -1 : min(mark.page, book.pages.count - 1))
    }

    private var isCover: Bool { page < 0 }
    private var isEnd: Bool { page >= book.pages.count }
    private var currentPage: NativeBookPage { book.pages[min(max(0, page), book.pages.count - 1)] }

    var body: some View {
        GeometryReader { geometry in
            VStack(spacing: 0) {
                readerHeader

                if typeSize.isAccessibilitySize || geometry.size.height < 450 {
                    ScrollView {
                        readerContent(artHeight: 240)
                            .padding(.vertical, 8)
                    }
                } else {
                    readerContent(artHeight: nil)
                        .frame(maxHeight: .infinity)
                }

                readerControls
                    .padding(.horizontal, 20)
                    .padding(.top, 12)
                    .padding(.bottom, 12)
            }
            .frame(maxWidth: 900)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(BookPalette.paper.ignoresSafeArea())
        .preferredColorScheme(.light)
        .onChange(of: page) { value in
            guard value >= 0 else { return }
            bookmark = BookBookmark(page: min(value, book.pages.count), finished: bookmark.finished || value >= book.pages.count)
        }
    }

    private var readerHeader: some View {
        HStack(spacing: 12) {
            Button { dismiss() } label: {
                Image(systemName: "xmark")
                    .font(.system(.body, design: .rounded, weight: .bold))
                    .frame(width: 44, height: 44)
                    .background(.white.opacity(0.8), in: Circle())
            }
            .accessibilityLabel("Back to Books")
            .accessibilityIdentifier("book-close")

            Text(book.title)
                .font(.system(.subheadline, design: .rounded, weight: .semibold))
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)

            if !isCover && !isEnd {
                Text("\(page + 1) / \(book.pages.count)")
                    .font(.system(.caption, design: .rounded, weight: .bold))
                    .monospacedDigit()
                    .accessibilityLabel("Page \(page + 1) of \(book.pages.count)")
                    .accessibilityIdentifier("book-page-count")
            }
        }
        .foregroundStyle(BookPalette.ink)
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
    }

    private func readerContent(artHeight: CGFloat?) -> some View {
        VStack(spacing: 14) {
            BookArtwork(
                path: isCover ? book.cover : currentPage.art,
                crop: isCover ? nil : currentPage.crop,
                emoji: isCover ? book.emoji : currentPage.emoji,
                mode: .fit
            )
            .frame(height: artHeight)
            .frame(maxWidth: .infinity, maxHeight: artHeight == nil ? .infinity : nil)
            .clipShape(RoundedRectangle(cornerRadius: 22))
            .accessibilityHidden(true)
            .contentShape(Rectangle())
            .gesture(DragGesture(minimumDistance: 40).onEnded { value in
                guard abs(value.translation.width) > abs(value.translation.height) else { return }
                if value.translation.width < -40 { nextPage() }
                else if value.translation.width > 40 { previousPage() }
            })

            VStack(spacing: 10) {
                if isCover {
                    Text(book.title)
                        .font(.system(.largeTitle, design: .rounded, weight: .heavy))
                        .accessibilityAddTraits(.isHeader)
                    Text("A picture book to enjoy together.")
                        .font(.system(.body, design: .rounded))
                        .foregroundStyle(BookPalette.secondary)
                } else if isEnd {
                    Text("The End")
                        .font(.system(.largeTitle, design: .rounded, weight: .heavy))
                        .accessibilityAddTraits(.isHeader)
                        .accessibilityIdentifier("book-finished")
                    Text("You finished \(book.title).")
                        .font(.system(.body, design: .rounded))
                        .foregroundStyle(BookPalette.secondary)
                } else {
                    Text(currentPage.text)
                        .font(.system(.title2, design: .rounded, weight: .semibold))
                        .accessibilityIdentifier("book-page-text")
                }
            }
            .foregroundStyle(BookPalette.ink)
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
            .padding(20)
            .frame(maxWidth: .infinity)
            .background(.white.opacity(0.82), in: RoundedRectangle(cornerRadius: 22))
        }
        .padding(.horizontal, 20)
    }

    private var readerControls: some View {
        HStack(spacing: 12) {
            Button {
                if isEnd { page = -1 } else { previousPage() }
            } label: {
                Group {
                    if isEnd { Text("Read again") }
                    else { Image(systemName: "arrow.left") }
                }
                .font(.system(.body, design: .rounded, weight: .bold))
                .foregroundStyle(BookPalette.ink)
                .padding(.horizontal, isEnd ? 15 : 20)
                .frame(minHeight: 52)
                .background(.white, in: RoundedRectangle(cornerRadius: 17))
                .overlay(RoundedRectangle(cornerRadius: 17).strokeBorder(BookPalette.line))
            }
            .disabled(isCover)
            .opacity(isCover ? 0 : 1)
            .accessibilityHidden(isCover)
            .accessibilityLabel(isEnd ? "Read again" : "Previous page")
            .accessibilityIdentifier("book-previous")

            Button {
                if isEnd { dismiss() } else { nextPage() }
            } label: {
                HStack(spacing: 10) {
                    Text(isCover ? "Open story" : isEnd ? "Books" : page == book.pages.count - 1 ? "Finish story" : "Next")
                    Spacer(minLength: 4)
                    Image(systemName: isEnd ? "books.vertical" : "arrow.right")
                }
                .font(.system(.body, design: .rounded, weight: .bold))
                .foregroundStyle(.white)
                .padding(.horizontal, 18)
                .padding(.vertical, 14)
                .frame(maxWidth: .infinity, minHeight: 52)
                .background(BookPalette.teal, in: RoundedRectangle(cornerRadius: 17))
            }
            .accessibilityIdentifier("book-next")
        }
        .buttonStyle(BookPressStyle())
    }

    private func nextPage() {
        guard !isEnd else { return }
        page += 1
    }

    private func previousPage() {
        guard page >= 0 else { return }
        page -= 1
    }
}

private enum BookPalette {
    static let paper = Color(red: 1, green: 0.969, blue: 0.933)
    static let ink = Color(red: 0.153, green: 0.137, blue: 0.216)
    static let secondary = Color(red: 0.40, green: 0.37, blue: 0.43)
    static let mint = Color(red: 0.88, green: 0.96, blue: 0.93)
    static let line = Color(red: 0.84, green: 0.82, blue: 0.78)
    static let teal = Color(red: 0.067, green: 0.498, blue: 0.518)
}

private struct BookPressStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed ? 0.84 : 1)
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.985 : 1)
            .animation(reduceMotion ? nil : .easeOut(duration: 0.1), value: configuration.isPressed)
    }
}

private enum BookArtworkError: Error { case unavailable }

/// A bounded native image cache. No page, script, voice, or personal identifier
/// is sent: requests are only the validated original Sona book asset paths.
private actor BookArtworkLoader {
    static let shared = BookArtworkLoader()
    private let images = NSCache<NSString, UIImage>()
    private let data = NSCache<NSString, NSData>()
    private let session: URLSession

    init() {
        images.totalCostLimit = 24 * 1024 * 1024
        images.countLimit = 40
        data.totalCostLimit = 12 * 1024 * 1024
        let config = URLSessionConfiguration.default
        config.httpShouldSetCookies = false
        config.httpCookieAcceptPolicy = .never
        config.httpMaximumConnectionsPerHost = 4
        config.urlCache = URLCache(memoryCapacity: 12 * 1024 * 1024, diskCapacity: 96 * 1024 * 1024)
        session = URLSession(configuration: config)
    }

    func image(path: String, crop: BookArtCrop?) async throws -> UIImage {
        guard path.range(of: #"^/assets/books/[a-z0-9/_-]+\.webp$"#, options: .regularExpression) != nil,
              let url = URL(string: "https://app.speaksona.com" + path) else { throw BookArtworkError.unavailable }
        let key = (path + "|" + String(describing: crop)) as NSString
        if let cached = images.object(forKey: key) { return cached }

        let bytes: Data
        if let cached = data.object(forKey: path as NSString) {
            bytes = cached as Data
        } else {
            let request = URLRequest(url: url, cachePolicy: .returnCacheDataElseLoad, timeoutInterval: 20)
            let (received, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode),
                  received.count <= 12 * 1024 * 1024 else { throw BookArtworkError.unavailable }
            bytes = received
            data.setObject(bytes as NSData, forKey: path as NSString, cost: bytes.count)
        }
        try Task.checkCancellation()
        guard let source = CGImageSourceCreateWithData(bytes as CFData, nil) else { throw BookArtworkError.unavailable }
        let decoded: CGImage
        if let crop {
            guard crop.columns > 0, crop.rows > 0, crop.column >= 0, crop.row >= 0,
                  crop.column < crop.columns, crop.row < crop.rows,
                  let original = CGImageSourceCreateImageAtIndex(source, 0, [kCGImageSourceShouldCache: false] as CFDictionary) else {
                throw BookArtworkError.unavailable
            }
            // Match library.html cutScenes: floor each of the 3×2 cell sizes.
            let width = original.width / crop.columns, height = original.height / crop.rows
            guard width > 0, height > 0,
                  let scene = original.cropping(to: CGRect(x: crop.column * width, y: crop.row * height, width: width, height: height)) else {
                throw BookArtworkError.unavailable
            }
            decoded = Self.resized(scene, maximum: 1400)
        } else {
            guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
                kCGImageSourceCreateThumbnailFromImageAlways: true,
                kCGImageSourceCreateThumbnailWithTransform: true,
                kCGImageSourceThumbnailMaxPixelSize: 1400,
                kCGImageSourceShouldCacheImmediately: true
            ] as CFDictionary) else { throw BookArtworkError.unavailable }
            decoded = image
        }
        let image = UIImage(cgImage: decoded)
        images.setObject(image, forKey: key, cost: decoded.bytesPerRow * decoded.height)
        return image
    }

    private static func resized(_ image: CGImage, maximum: CGFloat) -> CGImage {
        let scale = min(1, maximum / CGFloat(max(image.width, image.height)))
        guard scale < 1 else { return image }
        let width = max(1, Int(CGFloat(image.width) * scale)), height = max(1, Int(CGFloat(image.height) * scale))
        guard let context = CGContext(
            data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
            space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return image }
        context.interpolationQuality = .high
        context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
        return context.makeImage() ?? image
    }
}

private struct BookArtwork: View {
    let path: String
    var crop: BookArtCrop? = nil
    let emoji: String
    let mode: ContentMode

    @State private var image: UIImage?
    @State private var failed = false
    @State private var retry = 0

    private var requestID: String { path + "|" + String(describing: crop) + "|\(retry)" }

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                BookPalette.mint.opacity(0.55)
                if let image {
                    Image(uiImage: image)
                        .resizable()
                        .aspectRatio(contentMode: mode)
                        .frame(width: geometry.size.width, height: geometry.size.height)
                        .clipped()
                } else if failed {
                    VStack(spacing: 8) {
                        Text(emoji).font(.system(size: min(54, max(25, geometry.size.width * 0.25))))
                        Button("Load picture") { retry += 1 }
                            .font(.system(.caption, design: .rounded, weight: .bold))
                            .foregroundStyle(BookPalette.teal)
                            .padding(8)
                            .frame(minHeight: 44)
                    }
                } else {
                    ProgressView().tint(BookPalette.teal)
                        .accessibilityLabel("Loading picture")
                }
            }
        }
        .task(id: requestID) {
            image = nil
            failed = false
            do {
                let loaded = try await BookArtworkLoader.shared.image(path: path, crop: crop)
                guard !Task.isCancelled else { return }
                image = loaded
            } catch {
                guard !Task.isCancelled else { return }
                failed = true
            }
        }
    }
}

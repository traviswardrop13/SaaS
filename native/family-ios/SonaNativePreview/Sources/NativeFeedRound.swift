import SwiftUI
import UIKit

/// Feed Echo's bespoke word-first board. The regular SayPlay overlay is not
/// involved: hearing one word unlocks its pictures; a correct pick then feeds.
struct NativeFeedRound: View {
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @StateObject private var model: NativeFeedController

    init(selection: NativeFeedSelection, isCurrent: @escaping @MainActor () -> Bool,
         credit: @escaping @MainActor (GameSayingCredit) async throws -> Void,
         onFeed: @escaping @MainActor (UUID) async throws -> Int,
         onFinish: @escaping @MainActor () -> Void,
         onReplay: @escaping @MainActor () -> Void, onExit: @escaping @MainActor () -> Void) {
        _model = StateObject(wrappedValue: NativeFeedController(selection: selection, isCurrent: isCurrent,
            credit: credit, onFeed: onFeed, onFinish: onFinish, onReplay: onReplay, onExit: onExit))
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                header
                if model.phase == .finished {
                    finish
                } else if model.phase == .unavailable || model.phase == .closed {
                    Text("Feed Echo couldn’t open.").font(.headline)
                    action("Back home", id: "native-feed-unavailable-exit") { Task { await model.exit() } }
                } else {
                    board
                }
            }
            .padding(18).frame(maxWidth: 580)
            .frame(maxWidth: .infinity, minHeight: 580, alignment: .top)
        }
        .background(FeedPalette.paper.ignoresSafeArea())
        .foregroundStyle(FeedPalette.ink)
        .preferredColorScheme(.light)
        .allowsHitTesting(!hasOverlay)
        .accessibilityHidden(hasOverlay)
        .overlay { if hasOverlay { startOverlay } }
        .onChange(of: scenePhase) { model.setForeground($0 == .active) }
        .onDisappear { Task { await model.close() } }
    }

    private var hasOverlay: Bool { [.ready, .permission, .farewell].contains(model.phase) }

    private var header: some View {
        HStack(spacing: 12) {
            Button { Task { await model.exit() } } label: {
                Image(systemName: "xmark").font(.body.bold()).frame(width: 46, height: 46)
                    .background(.white, in: Circle())
            }.accessibilityLabel("Back home").accessibilityIdentifier("native-feed-close")
            Text("Feed Echo · \(model.selection.soundLabel) sound")
                .font(.system(.headline, design: .rounded).weight(.heavy))
                .accessibilityAddTraits(.isHeader).accessibilityIdentifier("native-feed-title")
            Spacer(minLength: 0)
            Label(String(model.heardCount), systemImage: "star.fill")
                .font(.subheadline.bold()).foregroundStyle(FeedPalette.teal)
                .accessibilityLabel("Echo heard you \(model.heardCount) times")
                .accessibilityIdentifier("native-feed-heard-count")
        }.buttonStyle(.plain)
    }

    private var board: some View {
        VStack(spacing: 17) {
            VStack(spacing: 8) {
                if let turn = model.turn, model.phase != .feeding {
                    (Text("Where’s the ") + markedWord(turn) + Text("?"))
                        .font(.system(.title2, design: .rounded).weight(.heavy))
                        .accessibilityIdentifier("native-feed-ask")
                } else {
                    Text(model.status).font(.system(.title2, design: .rounded).weight(.heavy))
                }
                if model.phase != .feeding {
                    Text(model.status).font(.subheadline.weight(.semibold))
                        .foregroundStyle(FeedPalette.muted).multilineTextAlignment(.center)
                        .accessibilityIdentifier("native-feed-status")
                }
            }
            .padding(15).frame(maxWidth: .infinity)
            .background(.white, in: RoundedRectangle(cornerRadius: 22))

            VStack(spacing: 0) {
                Image(echoAsset).resizable().scaledToFit().frame(height: 170)
                    .scaleEffect(reduceMotion ? 1 : echoScale, anchor: .bottom)
                    .animation(reduceMotion ? nil : .spring(response: 0.35), value: model.fed)
                    .accessibilityLabel("Echo")
                HStack(spacing: 10) {
                    ForEach(0..<model.selection.turns.count, id: \.self) { index in
                        ZStack {
                            Circle().fill(FeedPalette.paper).frame(width: 35, height: 35)
                            if model.fedPictures.indices.contains(index) {
                                Text(model.fedPictures[index].emoji).font(.system(size: 25))
                            }
                        }.accessibilityHidden(true)
                    }
                }
                .padding(.horizontal, 16).padding(.vertical, 10)
                .background(.white, in: Capsule())
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(model.fed) of \(model.selection.turns.count) pictures fed")
                .accessibilityIdentifier("native-feed-plate")
            }

            if let turn = model.turn {
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                    ForEach(Array(turn.choices.enumerated()), id: \.offset) { index, word in
                        Button { model.pick(word) } label: {
                            VStack(spacing: 9) {
                                Text(word.emoji).font(.system(size: 48)).accessibilityHidden(true)
                                Text(word.word).font(.system(.headline, design: .rounded).weight(.bold))
                                    .foregroundStyle(FeedPalette.ink)
                            }
                            .frame(maxWidth: .infinity, minHeight: 115).padding(6)
                            .background(.white, in: RoundedRectangle(cornerRadius: 21))
                            .overlay(RoundedRectangle(cornerRadius: 21).strokeBorder(
                                model.heard && word.word == turn.target.word ? FeedPalette.teal : .clear, lineWidth: 4))
                            .opacity(model.heard ? 1 : 0.82)
                            .contentShape(RoundedRectangle(cornerRadius: 21))
                        }
                        .buttonStyle(.plain).disabled(model.phase == .feeding)
                        .accessibilityLabel(word.word + (model.heard && word.word == turn.target.word ? ", glowing picture" : ""))
                        .accessibilityIdentifier("native-feed-choice-\(index)")
                    }
                }
            }
            if model.phase == .waiting || model.phase == .paused {
                action(model.needsSaveRetry ? "Try again" : "Listen again", id: "native-feed-listen-again") { model.listenAgain() }
            } else if [.opening, .checking, .saving, .preparing].contains(model.phase) {
                ProgressView().accessibilityLabel(model.status)
            }
        }
    }

    private var startOverlay: some View {
        ZStack {
            Color.black.opacity(0.30).ignoresSafeArea().accessibilityHidden(true)
            VStack(spacing: 17) {
                Image(model.phase == .permission ? available("echo-listen") : available("echo-welcome"))
                    .resizable().scaledToFit().frame(width: 100, height: 100).accessibilityHidden(true)
                if model.phase == .ready {
                    Text("Feed Echo").font(.system(.title, design: .rounded).weight(.heavy))
                        .accessibilityIdentifier("native-feed-start-title")
                    Text("Say the word, then feed Echo the picture!").multilineTextAlignment(.center)
                    Text("Today’s sound: \(model.selection.soundLabel)").font(.subheadline)
                    action("Let’s play", id: "native-feed-start") { model.start() }
                    Button("Back to games") { Task { await model.exit() } }
                        .font(.body.bold()).frame(minHeight: 44)
                        .accessibilityIdentifier("native-feed-start-exit")
                } else if model.phase == .permission {
                    Text("Let Echo hear you!").font(.system(.title, design: .rounded).weight(.heavy))
                    Text("Say each word to feed Echo.")
                    Text(model.selection.microphonePromise).font(.footnote).multilineTextAlignment(.center)
                    action("Turn on Echo’s ears", id: "native-feed-permission-yes") { model.enableMicrophone() }
                    Button("Not now") { model.notNow() }.font(.body.bold()).frame(minHeight: 44)
                        .accessibilityIdentifier("native-feed-permission-no")
                } else {
                    Text("That’s okay!").font(.system(.title, design: .rounded).weight(.heavy))
                    Text("Echo needs to hear you to eat. We’ll ask again next time you’re ready.")
                        .multilineTextAlignment(.center)
                    Text("Grown-ups: you can turn the microphone on whenever you like, from this screen or your phone’s Settings.")
                        .font(.footnote).multilineTextAlignment(.center)
                    action("Okay", id: "native-feed-not-now-exit") { Task { await model.exit() } }
                }
            }
            .padding(25).frame(maxWidth: 360)
            .background(FeedPalette.paper, in: RoundedRectangle(cornerRadius: 28)).padding(24)
            .accessibilityElement(children: .contain).accessibilityAddTraits(.isModal)
        }
    }

    private var finish: some View {
        VStack(spacing: 20) {
            Image(available("echo-cheer")).resizable().scaledToFit().frame(height: 195).accessibilityHidden(true)
            Text("Yum! You fed Echo!").font(.system(.largeTitle, design: .rounded).weight(.heavy))
                .multilineTextAlignment(.center).accessibilityIdentifier("native-feed-complete")
            Text("Five tasty discoveries. Concert time!").font(.body).multilineTextAlignment(.center)
            action("Play again", id: "native-feed-replay") { Task { await model.replay() } }
            Button("Back home") { Task { await model.exit() } }.font(.body.bold()).frame(minHeight: 44)
                .accessibilityIdentifier("native-feed-home")
        }.padding(.vertical, 28)
    }

    private var echoScale: CGFloat {
        CGFloat(1 + Double(min(max(0, model.lifetimeFed), 80)) * 0.004) * (1 + CGFloat(model.fed) * 0.07)
    }
    private var echoAsset: String {
        if [.speaking, .preparing].contains(model.phase) { return available("echo-talk") }
        if [.listening, .checking].contains(model.phase) { return available("echo-listen") }
        if model.heard || model.phase == .feeding { return available("echo-cheer") }
        return available("echo-welcome")
    }
    private func available(_ name: String) -> String { UIImage(named: name) == nil ? "echo-welcome" : name }

    private func action(_ title: String, id: String, run: @escaping () -> Void) -> some View {
        Button(action: run) {
            Text(title).font(.system(.body, design: .rounded).weight(.bold))
                .frame(maxWidth: .infinity, minHeight: 53).padding(.horizontal, 12)
                .foregroundStyle(.white).background(FeedPalette.teal, in: Capsule())
        }.buttonStyle(.plain).accessibilityIdentifier(id)
    }

    private func markedWord(_ turn: NativeFeedSelection.Turn) -> Text {
        let html = turn.markedWord
        guard let regex = try? NSRegularExpression(pattern: #"<b class="snd">([\s\S]*?)</b>"#) else { return Text(turn.target.word) }
        let source = html as NSString
        let matches = regex.matches(in: html, range: NSRange(location: 0, length: source.length))
        guard !matches.isEmpty else { return Text(turn.target.word) }
        var text = Text(""), cursor = 0
        for match in matches {
            if match.range.location > cursor { text = text + Text(source.substring(with: NSRange(location: cursor, length: match.range.location - cursor))) }
            text = text + Text(source.substring(with: match.range(at: 1))).foregroundColor(FeedPalette.sound)
            cursor = NSMaxRange(match.range)
        }
        if cursor < source.length { text = text + Text(source.substring(from: cursor)) }
        return text
    }
}

private enum FeedPalette {
    static let paper = Color(red: 1, green: 0.97, blue: 0.91)
    static let ink = Color(red: 0.29, green: 0.17, blue: 0.08)
    static let muted = Color(red: 0.48, green: 0.40, blue: 0.33)
    static let teal = Color(red: 0.04, green: 0.46, blue: 0.49)
    static let sound = Color(red: 0.86, green: 0.36, blue: 0.12)
}

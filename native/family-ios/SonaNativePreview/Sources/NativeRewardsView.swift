import SwiftUI
import UIKit

/// Renders immutable shipping-policy projections. Every mutation crosses the
/// injected, child-scoped canonical-policy boundary; no reward math lives here.
struct NativeRewardsView: View {
    let snapshot: NativeRewardsSnapshot
    let perform: NativeRewardsPerformer
    let arcadeLevels: NativeArcadeLevelsAccess?
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var current: NativeRewardsSnapshot
    @State private var path = RewardsPath.lifetime
    @State private var presentation: RewardsPresentation?
    @State private var busy = false
    @State private var failedRequest: NativeRewardsRequest?
    @State private var actionTask: Task<Void, Never>?

    init(snapshot: NativeRewardsSnapshot, arcadeLevels: NativeArcadeLevelsAccess? = nil, perform: @escaping NativeRewardsPerformer) {
        self.snapshot = snapshot
        self.perform = perform
        self.arcadeLevels = arcadeLevels
        _current = State(initialValue: snapshot)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                heading
                landCard
                errorCard
                monthNotice
                dailyChest
                if let arcadeLevels { NativeArcadeLevelsRoadSection(access: arcadeLevels) }
                Picker("Reward path", selection: $path) {
                    Text("Trophy Road").tag(RewardsPath.lifetime)
                    Text(current.road.month.name + " path").tag(RewardsPath.month)
                }.pickerStyle(.segmented).accessibilityIdentifier("native-rewards-path")
                if path == .lifetime {
                    roadStops
                } else {
                    monthStops
                }
                stickerBook
            }
            .padding(20)
            .frame(maxWidth: 650, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .top)
        }
        .background(RewardsPalette.paper.ignoresSafeArea())
        .foregroundStyle(RewardsPalette.ink)
        .navigationTitle("Trophy Road")
        .navigationBarTitleDisplayMode(.inline)
        .preferredColorScheme(.light)
        .allowsHitTesting(presentation == nil)
        .overlay { if let presentation { rewardMoment(presentation) } }
        .task { submit(.settle) }
        .onChange(of: snapshot) { fresh in
            if fresh.scope != current.scope {
                actionTask?.cancel()
                busy = false
                presentation = nil
                failedRequest = nil
                current = fresh
                submit(.settle)
            } else if !busy {
                current = fresh
            }
        }
        .onChange(of: scenePhase) { phase in
            if phase == .active && presentation == nil && !busy { submit(.settle) }
        }
        .onDisappear { actionTask?.cancel(); actionTask = nil; busy = false; presentation = nil }
    }

    private var heading: some View {
        HStack(alignment: .top, spacing: 12) {
            Text("Your Trophy Road")
                .font(.system(.largeTitle, design: .rounded).weight(.heavy))
                .accessibilityAddTraits(.isHeader)
                .accessibilityIdentifier("native-rewards-title")
            Spacer(minLength: 0)
            VStack(alignment: .trailing, spacing: 9) {
                Label(current.road.trophies.formatted(), systemImage: "trophy.fill")
                    .foregroundStyle(RewardsPalette.teal)
                    .accessibilityLabel("\(current.road.trophies) trophies")
                    .accessibilityIdentifier("native-rewards-trophies")
                Label(current.road.coins.formatted(), systemImage: "circle.fill")
                    .foregroundStyle(RewardsPalette.ink)
                    .accessibilityLabel("\(current.road.coins) coins")
                    .accessibilityIdentifier("native-rewards-coins")
            }
            .font(.system(.subheadline, design: .rounded).weight(.bold))
            .padding(12).background(.white, in: RoundedRectangle(cornerRadius: 17))
        }
    }

    private var landCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(current.road.land.name)
                .font(.system(.title2, design: .rounded).weight(.heavy))
                .padding(9).background(.white, in: RoundedRectangle(cornerRadius: 12))
            Spacer(minLength: 22)
            VStack(alignment: .leading, spacing: 8) {
                Text("Next gift at \(current.road.next.at) trophies")
                    .font(.system(.headline, design: .rounded).weight(.bold))
                Text(giftWords(current.road.next.gift)).font(.subheadline)
                if let next = nextWaiting {
                    Button { begin(next.action, big: next.big) } label: {
                        Label("Open next", systemImage: "arrow.right")
                            .font(.body.bold()).frame(minHeight: 44)
                    }.disabled(busy)
                        .accessibilityIdentifier("native-rewards-open-next")
                }
            }
            .padding(14).frame(maxWidth: .infinity, alignment: .leading)
            .background(.white.opacity(0.97), in: RoundedRectangle(cornerRadius: 17))
        }
        .padding(16).frame(maxWidth: .infinity, minHeight: 210, alignment: .leading)
        .background {
            GeometryReader { geo in
                Image(current.road.land.art).resizable().scaledToFill()
                    .frame(width: geo.size.width, height: geo.size.height).clipped()
                    .accessibilityHidden(true)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 25))
    }

    @ViewBuilder private var errorCard: some View {
        if let request = failedRequest {
            VStack(alignment: .leading, spacing: 10) {
                Text("Your gifts couldn’t open just now.").font(.headline)
                Text("Try again when you’re ready.").font(.subheadline)
                Button("Try again") { submit(allowed(request.action) ? request.action : .settle) }
                    .font(.body.bold()).frame(minHeight: 44).disabled(busy)
                    .accessibilityIdentifier("native-rewards-retry")
            }
            .padding(16).frame(maxWidth: .infinity, alignment: .leading)
            .background(.white, in: RoundedRectangle(cornerRadius: 18))
        }
    }

    @ViewBuilder private var monthNotice: some View {
        if !current.road.rolled.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text("Your earlier month gifts are in your wallet!").font(.headline)
                Button("Got it") { submit(.markRolledSeen) }
                    .font(.body.bold()).frame(minHeight: 44).disabled(busy)
                    .accessibilityIdentifier("native-rewards-month-seen")
            }
            .padding(16).frame(maxWidth: .infinity, alignment: .leading)
            .background(RewardsPalette.mint, in: RoundedRectangle(cornerRadius: 19))
        }
    }

    private var dailyChest: some View {
        VStack(alignment: .leading, spacing: 15) {
            HStack(alignment: .center, spacing: 15) {
                Image("road-chest").resizable().scaledToFit().frame(width: 82, height: 82)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 7) {
                    Text("Today’s chest").font(.system(.title3, design: .rounded).weight(.heavy))
                    Text(current.road.chest.opened ? "You opened today’s chest!" : current.road.chest.ready ? "Your chest is ready!" : "Reach your goal today to open your chest!")
                        .font(.subheadline).fixedSize(horizontal: false, vertical: true)
                    if !current.road.chest.opened {
                        Text("\(current.road.chest.big ? "Big chest: " : "Inside: ")\(current.road.chest.coins) coins\(current.road.chest.sticker ? " and a sticker" : "")")
                            .font(.footnote.weight(.semibold))
                    }
                }
            }
            if current.road.chest.ready && !current.road.chest.opened {
                rewardsButton("Open it", id: "native-rewards-open-chest") { begin(.openChest, big: current.road.chest.big, chest: true) }
            } else if !current.road.chest.opened {
                ProgressView(value: Double(min(current.goal.n, current.goal.goal)), total: Double(max(1, current.goal.goal)))
                    .tint(RewardsPalette.teal)
                    .accessibilityLabel("\(current.goal.n) of \(current.goal.goal) reps today")
                Text("\(min(current.goal.n, current.goal.goal))/\(current.goal.goal)")
                    .font(.caption.weight(.semibold)).foregroundStyle(RewardsPalette.muted)
            }
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading)
        .background(.white, in: RoundedRectangle(cornerRadius: 23))
    }

    private var roadStops: some View {
        LazyVStack(alignment: .leading, spacing: 12) {
            ForEach(current.stops) { stop in
                stopRow(stop, action: .openRoad(stop.n), monthly: false)
            }
        }
    }

    private var monthStops: some View {
        VStack(alignment: .leading, spacing: 13) {
            Text("\(current.road.month.count) trophies this month")
                .font(.system(.headline, design: .rounded).weight(.bold))
            ForEach(current.road.month.steps) { stop in
                stopRow(stop, action: .openMonth(stop.n), monthly: true)
            }
        }
    }

    private func stopRow(_ stop: NativeRewardStop, action: NativeRewardsRequest.Action, monthly: Bool) -> some View {
        Button { begin(action, big: stop.big) } label: {
            HStack(alignment: .center, spacing: 14) {
                Image(systemName: stop.got ? "checkmark.circle.fill" : stop.big ? "gift.fill" : "trophy.fill")
                    .font(.title2).foregroundStyle(RewardsPalette.teal)
                    .frame(width: 43, height: 50).accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 6) {
                    Text("\(stop.at) trophies").font(.system(.headline, design: .rounded).weight(.bold))
                    Text(giftWords(stop.gift)).font(.subheadline).foregroundStyle(RewardsPalette.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
                Text(stop.got ? "Opened" : stop.canOpen ? "Open!" : "")
                    .font(.caption.bold()).foregroundStyle(RewardsPalette.teal)
            }
            .padding(14).frame(maxWidth: .infinity, alignment: .leading)
            .background(stop.canOpen ? RewardsPalette.mint : .white, in: RoundedRectangle(cornerRadius: 20))
            .contentShape(RoundedRectangle(cornerRadius: 20))
        }
        .buttonStyle(.plain).disabled(!stop.canOpen || busy)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("At \(stop.at) trophies\(monthly ? " this month" : ""): \(giftWords(stop.gift)). \(stop.got ? "Opened." : stop.canOpen ? "Open." : "Ahead on the path.")")
        .accessibilityIdentifier("native-rewards-\(monthly ? "month" : "road")-\(stop.n)")
    }

    private var stickerBook: some View {
        VStack(alignment: .leading, spacing: 15) {
            Text("Your stickers").font(.system(.title2, design: .rounded).weight(.heavy))
                .accessibilityAddTraits(.isHeader)
            let earned = current.stickers.filter(\.earned)
            if earned.isEmpty {
                Text("Find stickers in chests and along your road.")
                    .font(.subheadline).foregroundStyle(RewardsPalette.muted)
            } else {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 84), spacing: 12)], spacing: 16) {
                    ForEach(earned) { sticker in
                        VStack(spacing: 7) {
                            Text(sticker.e).font(.system(size: 42)).accessibilityHidden(true)
                            Text(sticker.name).font(.caption.weight(.semibold)).multilineTextAlignment(.center)
                        }
                        .frame(maxWidth: .infinity, minHeight: 91).padding(8)
                        .background(.white, in: RoundedRectangle(cornerRadius: 17))
                        .accessibilityElement(children: .ignore).accessibilityLabel(sticker.name + " sticker")
                        .accessibilityIdentifier("native-rewards-sticker-\(sticker.id)")
                    }
                }
            }
        }.padding(.top, 8)
    }

    private func rewardMoment(_ state: RewardsPresentation) -> some View {
        ZStack {
            Color.black.opacity(0.32).ignoresSafeArea().accessibilityHidden(true)
            VStack(spacing: 18) {
                switch state {
                case .chest(_, let big, let taps):
                    Text(big ? "A Big Chest!" : "Your chest")
                        .font(.system(.title2, design: .rounded).weight(.heavy))
                    Button { tapChest() } label: {
                        Image("road-chest").resizable().scaledToFit().frame(width: 170, height: 150)
                    }.buttonStyle(.plain).accessibilityLabel("Tap the chest to open it")
                        .accessibilityIdentifier("native-rewards-chest-tap")
                    Text(taps == 0 ? "Tap, tap, tap!" : taps == 1 ? "Tap, tap!" : "One more tap!")
                        .font(.system(.title3, design: .rounded).weight(.bold))
                        .accessibilityIdentifier("native-rewards-chest-instruction")
                    Button("Not now") { presentation = nil }.frame(minHeight: 44)
                        .accessibilityIdentifier("native-rewards-chest-cancel")
                case .loading:
                    ProgressView().progressViewStyle(.circular)
                    Text("Opening your gift…").font(.headline)
                case .gifts(let gifts, let index):
                    grantArt(gifts[index])
                    Text(gifts[index].message)
                        .font(.system(.title2, design: .rounded).weight(.heavy))
                        .multilineTextAlignment(.center)
                        .accessibilityIdentifier("native-rewards-gift-message")
                    rewardsButton("Yay!", id: "native-rewards-next-gift") {
                        if index + 1 < gifts.count { presentation = .gifts(gifts, index: index + 1) }
                        else { presentation = nil }
                    }
                }
            }
            .padding(26).frame(maxWidth: 360)
            .background(RewardsPalette.paper, in: RoundedRectangle(cornerRadius: 28))
            .padding(24).accessibilityElement(children: .contain).accessibilityAddTraits(.isModal)
        }
        .transition(.opacity)
    }

    @ViewBuilder private func grantArt(_ grant: NativeRewardGrant) -> some View {
        if let sticker = grant.sticker, let info = current.stickers.first(where: { $0.id == sticker }) {
            Text(info.e).font(.system(size: 92)).accessibilityHidden(true)
        } else if let item = grant.item, item.kind == "characters", let image = UIImage(named: "buddy-" + item.id) {
            Image(uiImage: image).resizable().scaledToFit().frame(width: 140, height: 140).accessibilityHidden(true)
        } else {
            Image(systemName: grant.coins != nil || grant.alt != nil ? "circle.fill" : grant.level != nil ? "trophy.fill" : "gift.fill")
                .font(.system(size: 85)).foregroundStyle(RewardsPalette.teal).frame(height: 130).accessibilityHidden(true)
        }
    }

    private func rewardsButton(_ title: String, id: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).font(.system(.body, design: .rounded).weight(.bold))
                .frame(maxWidth: .infinity, minHeight: 51).padding(.horizontal, 12)
                .foregroundStyle(.white).background(RewardsPalette.teal, in: RoundedRectangle(cornerRadius: 16))
        }.buttonStyle(.plain).disabled(busy).accessibilityIdentifier(id)
    }

    private var nextWaiting: (action: NativeRewardsRequest.Action, big: Bool)? {
        if let n = current.road.lowestWaiting, let stop = current.stops.first(where: { $0.n == n && $0.canOpen }) {
            return (.openRoad(n), stop.big)
        }
        if let step = current.road.month.steps.first(where: \.canOpen) { return (.openMonth(step.n), step.big) }
        return nil
    }

    private func giftWords(_ gifts: [NativeRewardGift]) -> String { gifts.map(\.label).joined(separator: " · ") }

    private func allowed(_ action: NativeRewardsRequest.Action) -> Bool {
        switch action {
        case .settle, .markRolledSeen: return true
        case .openChest: return current.road.chest.ready && !current.road.chest.opened
        case .openRoad(let n): return current.stops.first(where: { $0.n == n })?.canOpen == true
        case .openMonth(let n): return current.road.month.steps.first(where: { $0.n == n })?.canOpen == true
        }
    }

    private func begin(_ action: NativeRewardsRequest.Action, big: Bool, chest: Bool = false) {
        guard !busy, allowed(action) else { return }
        if chest || big { presentation = .chest(action, big: big, taps: 0) }
        else { presentation = .loading; submit(action) }
    }

    private func tapChest() {
        guard !busy, case .chest(let action, let big, let taps) = presentation else { return }
        guard allowed(action) else { presentation = nil; submit(.settle); return }
        if taps < 2 {
            presentation = .chest(action, big: big, taps: taps + 1)
        } else {
            presentation = .loading
            submit(action)
        }
    }

    @MainActor private func submit(_ action: NativeRewardsRequest.Action) {
        guard !busy, allowed(action) else { return }
        let request = NativeRewardsRequest(scope: current.scope, action: action)
        busy = true
        failedRequest = nil
        actionTask = Task { @MainActor in
            do {
                let update = try await perform(request)
                guard !Task.isCancelled, current.scope == request.scope else { return }
                guard update.snapshot.scope == request.scope else { throw NativeRewardsDataError.invalidProjection }
                current = update.snapshot
                busy = false
                if update.accepted && !update.gifts.isEmpty {
                    presentation = .gifts(update.gifts, index: 0)
                } else {
                    presentation = nil
                }
            } catch {
                guard !Task.isCancelled, current.scope == request.scope else { return }
                busy = false
                presentation = nil
                failedRequest = request
            }
        }
    }
}

private enum RewardsPath { case lifetime, month }
private enum RewardsPresentation {
    case chest(NativeRewardsRequest.Action, big: Bool, taps: Int)
    case loading
    case gifts([NativeRewardGrant], index: Int)
}
private enum RewardsPalette {
    static let paper = Color(red: 1, green: 0.98, blue: 0.94)
    static let ink = Color(red: 0.20, green: 0.19, blue: 0.24)
    static let muted = Color(red: 0.39, green: 0.41, blue: 0.42)
    static let teal = Color(red: 0.04, green: 0.46, blue: 0.49)
    static let mint = Color(red: 0.90, green: 0.95, blue: 0.91)
}

import SwiftUI
import SonaFamilyMigration

/// The current family setup questions and silent previews. The parent owns
/// the atomic save, price, microphone and child handoff after these questions.
@MainActor struct NativeFamilySetupView: View {
    @ObservedObject var records: NativeFamilyState
    var rewalk = false
    var priceFollows = false
    var reminders: NativeSetupReminderActions = .unavailable
    var makeStoreProbe: ((NativeFamilyChildID) -> NativeSetupStoreProbe?)? = nil
    let onPrepare: () async throws -> NativeFamilyChildID
    let onComplete: (NativeSetupDraft, NativeSetupForm, NativeFamilyChildID) async throws -> Void
    let onTherapistLogin: () -> Void

    @State private var form: NativeSetupForm?
    @State private var draft = NativeSetupDraft()
    @State private var owner: NativeFamilyChildID?
    @State private var preparingOwner: NativeFamilyChildID?
    @State private var loading = false
    @State private var saving = false
    @State private var completed = false
    @State private var message = ""
    @State private var emailMessage = ""
    @State private var visible = false
    @State private var generation = UUID()
    @State private var loadToken = UUID()
    @State private var tapGate = NativeSetupTapGate()
    @State private var transitioning = false
    @State private var transitionToken = UUID()
    @State private var helloReady = false
    @State private var helloVisited = false
    @State private var beatDone = false
    @State private var building = false
    @State private var visibleBuildAnswers = 0
    @State private var waitingForPreflight = false
    @State private var reminderBusy = false
    @State private var reminderToken: UUID?
    @State private var helloTask: Task<Void, Never>?
    @State private var transitionTask: Task<Void, Never>?
    @State private var buildTask: Task<Void, Never>?
    @State private var reminderDeadline: Task<Void, Never>?
    @State private var saveTask: Task<Void, Never>?
    @State private var reloadTask: Task<Void, Never>?
    @StateObject private var preflight = NativeSetupPreflight()
    @FocusState private var focusedField: Field?
    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(\.accessibilityReduceMotion) private var reducedMotion

    private enum Field: Hashable { case name, email }
    private var paper: Color { NativeSetupArtworkStyle.color(0xfff5e9) }
    private var ink: Color { NativeSetupArtworkStyle.ink }
    private var coral: Color { NativeSetupArtworkStyle.coral }
    // Screen bounds do not shrink with the keyboard. The name step therefore
    // keeps its type, field and age-chip sizes while iOS raises the footer.
    private var compact: Bool { UIScreen.main.bounds.height < 700 }
    private var pageBlocked: Bool {
        loading || saving || completed || building || transitioning || waitingForPreflight || reminderBusy || draft.submitted
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            if let form, let owner, owner == records.activeID {
                ScrollView {
                    VStack(alignment: .leading, spacing: compact ? 14 : 22) {
                        page(form)
                        if !message.isEmpty {
                            Text(message).font(.footnote).foregroundStyle(ink)
                                .accessibilityAddTraits(.updatesFrequently)
                                .accessibilityIdentifier("setup-status")
                        }
                    }
                    .frame(maxWidth: 500)
                    .frame(maxWidth: .infinity, alignment: .top)
                    .padding(.horizontal, compact ? 22 : 24)
                    .padding(.top, draft.step == .name ? 8 : 16)
                    .padding(.bottom, 12)
                }
                .disabled(pageBlocked)
                if showsFooter(form) { footer(form) }
            } else if message.isEmpty || loading {
                Spacer(); ProgressView("Opening Sona"); Spacer()
            } else {
                Spacer()
                Text(message).padding()
                Button("Try again") { reloadTask = Task { await load() } }
                    .frame(minHeight: 44).accessibilityIdentifier("setup-retry-open")
                Spacer()
            }
        }
        .background(paper.ignoresSafeArea())
        .foregroundStyle(ink)
        .tint(coral)
        .overlay { if building { buildOverlay } }
        .onAppear { visible = true }
        .task { visible = true; await load() }
        .onDisappear { leaveView() }
        .onChange(of: draft) { persist($0) }
        .onChange(of: draft.step) { step in
            emailMessage = ""
            if let form { entered(step, form: form) }
        }
        .onChange(of: records.activeID) { next in
            if let captured = owner ?? preparingOwner, captured != next {
                invalidateOwner()
                reloadTask = Task { await load() }
            }
        }
        .onChange(of: preflight.busy) { busy in
            guard !busy, waitingForPreflight, let form, currentOwner != nil, draft.step == .ready else { return }
            waitingForPreflight = false
            leaveReady(form)
        }
        .onChange(of: reducedMotion) { reduced in
            if reduced {
                helloTask?.cancel(); helloReady = true
                if building { visibleBuildAnswers = readyAnswers.count }
            }
        }
    }

    private var header: some View {
        VStack(spacing: 8) {
            HStack {
                if owner != nil, draft.step != .welcome, !draft.submitted, !completed {
                    Button(action: back) {
                        Image(systemName: "chevron.left").frame(width: 44, height: 44)
                    }
                    .accessibilityLabel("Back").accessibilityIdentifier("setup-back")
                    .disabled(pageBlocked)
                }
                if draft.step != .name || !compact {
                    Text("Sona").font(.system(.title, design: .rounded).weight(.heavy))
                }
                Spacer(minLength: 0)
                if let form, draft.step == .welcome, form.showTherapistLogin {
                    Button("Log in") {
                        guard !pageBlocked, currentOwner != nil else { return }
                        focusedField = nil; onTherapistLogin()
                    }
                    .font(.subheadline.weight(.semibold)).frame(minWidth: 44, minHeight: 44)
                    .accessibilityIdentifier("onboarding-therapist-login")
                }
                if draft.step == .updates, !draft.submitted {
                    Button("Skip") { skipCurrent() }
                        .font(.subheadline).foregroundStyle(NativeSetupArtworkStyle.muted)
                        .frame(minWidth: 44, minHeight: 44)
                        .disabled(pageBlocked).accessibilityIdentifier("setup-email-skip")
                }
            }
            if let form, draft.step.isQuestion {
                let questions = form.order.filter(\.isQuestion)
                HStack(spacing: 5) {
                    ForEach(Array(questions.enumerated()), id: \.offset) { index, step in
                        Capsule().fill(index <= (questions.firstIndex(of: draft.step) ?? -1) ? coral : NativeSetupArtworkStyle.color(0xead7bf))
                            .frame(height: 3)
                    }
                }
                .accessibilityHidden(true)
            }
        }
        .padding(.horizontal, 22).padding(.top, 6).padding(.bottom, 6)
        .frame(minHeight: 44)
    }

    @ViewBuilder private func page(_ form: NativeSetupForm) -> some View {
        switch draft.step {
        case .welcome:
            VStack(alignment: .leading, spacing: 20) {
                kicker("Speech practice")
                heading("Little sounds.\nBig adventures.")
                ZStack(alignment: .bottom) {
                    NativeSetupArtworkImage(path: "/assets/crafted/orchard-game.webp", contentMode: .fill)
                    NativeSetupArtworkImage(path: "/assets/crafted/echo-welcome.webp")
                        .padding(.top, 20).padding(.bottom, 35)
                    Text("Hi, I’m Echo!").font(.system(.headline, design: .rounded).weight(.heavy))
                        .padding(10).background(paper, in: Capsule()).padding(.bottom, 12)
                }
                .frame(height: compact ? 220 : 290).clipped()
                .clipShape(RoundedRectangle(cornerRadius: 30))
                .overlay(RoundedRectangle(cornerRadius: 30).stroke(NativeSetupArtworkStyle.color(0xffe09a), lineWidth: 6))
                .rotationEffect(.degrees(3)).padding(.horizontal, 5)
                .accessibilityHidden(true)
            }
        case .name:
            namePage
        case .fruitDemo:
            NativeSetupDemoView(kind: .fruit, compact: compact)
        case .pianoDemo:
            NativeSetupDemoView(kind: .piano, compact: compact)
        case .rachel:
            NativeSetupRachelView().padding(.top, 6)
        case .interests:
            heading("What does \(displayName) love?").privacySensitive()
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 9) {
                ForEach(NativeSetupDraft.interestIDs, id: \.self) { id in
                    choice(selected: draft.interests.contains(id), id: "setup-interest-" + id) {
                        guard !pageBlocked else { return }; draft.toggleInterest(id)
                    } content: {
                        interestArt(id).frame(width: 44, height: 50).accessibilityHidden(true)
                        Text(interestLabel(id)).font(.system(size: 14, weight: .heavy, design: .rounded))
                    }
                }
            }
            skipButton(id: "setup-interests-skip")
        case .therapy:
            heading("Is \(displayName) in speech therapy?").privacySensitive()
            Text("Your answer stays on this phone.").foregroundStyle(NativeSetupArtworkStyle.muted)
            ForEach([("t_yes", "Yes"), ("t_none", "No"), ("t_no", "Not yet")], id: \.0) { id, label in
                choice(selected: draft.therapy == id, id: "setup-therapy-" + id) {
                    guard takeTransition() else { return }
                    _ = draft.answerTherapy(id, in: form)
                } content: { Text(label) }
            }
            skipButton(id: "setup-therapy-skip")
        case .sounds:
            heading("Which sounds?")
            Text("Tap the sounds your child is working on.")
            LazyVGrid(columns: [GridItem(.adaptive(minimum: typeSize.isAccessibilitySize ? 180 : 100))], spacing: 10) {
                ForEach(form.sounds) { sound in
                    choice(selected: draft.mode == "speech" && draft.focusSounds.contains(sound.id), id: "setup-sound-" + sound.id) {
                        guard !pageBlocked else { return }; draft.toggleSound(sound.id)
                    } content: {
                        VStack(spacing: 5) {
                            Text(sound.label).font(.headline)
                            sound.pieces.reduce(Text("")) { text, piece in
                                text + Text(piece.text).foregroundColor(piece.marked ? .orange : NativeSetupArtworkStyle.muted)
                            }
                        }
                    }.accessibilityLabel(sound.accessibilityLabel)
                }
            }
            Button("Not sure? Pick all sounds") {
                guard takeTransition() else { return }
                draft.chooseAllSounds(); _ = draft.next(in: form)
            }
            .frame(minHeight: 44).accessibilityIdentifier("setup-all-sounds")
            Text("Sona practices — it doesn't test or diagnose.").font(.footnote).foregroundStyle(NativeSetupArtworkStyle.muted)
        case .minutes:
            heading("How long each day?")
            ForEach([3, 5, 10], id: \.self) { minutes in
                choice(selected: draft.minutes == minutes, id: "setup-minutes-\(minutes)") {
                    guard takeTransition() else { return }
                    _ = draft.answerMinutes(minutes, in: form)
                } content: { Text("\(minutes) minutes") }
            }
            skipButton(id: "setup-minutes-skip")
        case .updates:
            updatesPage
        case .ready:
            NativeSetupArtworkImage(path: "/assets/crafted/echo-cheer.webp")
                .frame(maxWidth: .infinity).frame(height: compact ? 130 : 185).accessibilityHidden(true)
            heading(draft.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Practice is ready!" : "\(displayName)'s practice is ready!")
                .privacySensitive().accessibilityIdentifier("setup-ready")
            answerChips
            if form.showPlanMoment {
                HStack(spacing: 14) {
                    NativeSetupArtworkImage(path: "/assets/crafted/home-fruit.webp", contentMode: .fill)
                        .frame(width: compact ? 100 : 130, height: compact ? 80 : 100).clipped().accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Day 1").font(.caption.weight(.heavy)).foregroundStyle(coral)
                        Text("Play a game, then read a book.").font(.headline)
                    }
                    Spacer(minLength: 0)
                }
                .padding(12).background(.white, in: RoundedRectangle(cornerRadius: 18))
            }
        case .reminder:
            reminderPage
        }
    }

    private var namePage: some View {
        VStack(alignment: .leading, spacing: compact ? 8 : 12) {
            heading("Who's practicing?")
            if !compact || focusedField != .name { Text("First name or nickname").font(.subheadline.weight(.semibold)) }
            TextField("First name", text: $draft.name)
                .textContentType(nil).textInputAutocapitalization(.words).disableAutocorrection(true)
                .submitLabel(.done).onSubmit { focusedField = nil }
                .focused($focusedField, equals: .name)
                .padding(12).frame(minHeight: 48).background(.white, in: RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(NativeSetupArtworkStyle.color(0xead7bf)))
                .privacySensitive().accessibilityLabel("First name or nickname").accessibilityIdentifier("setup-name")
            Text("Age").font(.subheadline.weight(.semibold)).padding(.top, compact ? 16 : 30)
            HStack(spacing: 8) {
                ForEach([("4", "2–4"), ("6", "5–6"), ("8", "7+")], id: \.0) { band, label in
                    Button {
                        guard !pageBlocked else { return }
                        let typing = focusedField == .name
                        draft.selectAge(band)
                        if typing { focusedField = .name }
                    } label: {
                        Text(label).font(.headline).frame(maxWidth: .infinity, minHeight: 48)
                            .background(draft.ageBand == band ? NativeSetupArtworkStyle.color(0xffe4cc) : .white, in: Capsule())
                            .overlay(Capsule().stroke(draft.ageBand == band ? coral : NativeSetupArtworkStyle.color(0xead7bf)))
                    }
                    .buttonStyle(.plain).accessibilityValue(draft.ageBand == band ? "Selected" : "Not selected")
                    .accessibilityAddTraits(draft.ageBand == band ? .isSelected : [])
                    .accessibilityIdentifier("setup-age-" + band)
                }
            }
        }
    }

    private var updatesPage: some View {
        VStack(alignment: .leading, spacing: 16) {
            heading("See their progress\nevery Monday")
            ForEach(["Days they practiced", "Times they said their sound", "Sounds they’re working on"], id: \.self) { text in
                Label(text, systemImage: "checkmark").font(.subheadline.weight(.semibold))
            }
            if focusedField != .email {
                NativeSetupArtworkImage(path: "/assets/crafted/echo-cheer.webp")
                    .frame(maxWidth: .infinity).frame(height: compact ? 115 : 180).accessibilityHidden(true)
            }
            Text("Your email").font(.subheadline.weight(.semibold)).padding(.top, 12)
            TextField("you@email.com", text: $draft.email)
                .keyboardType(.emailAddress).textContentType(.emailAddress)
                .textInputAutocapitalization(.never).disableAutocorrection(true)
                .submitLabel(.done).onSubmit { focusedField = nil }
                .focused($focusedField, equals: .email)
                .padding(12).frame(minHeight: 48).background(.white, in: RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(emailMessage.isEmpty ? NativeSetupArtworkStyle.color(0xead7bf) : coral))
                .privacySensitive().accessibilityLabel("Your email").accessibilityIdentifier("setup-email")
            if !emailMessage.isEmpty {
                Text(emailMessage).font(.footnote.weight(.semibold)).foregroundStyle(coral)
                    .accessibilityAddTraits(.updatesFrequently).accessibilityIdentifier("setup-email-status")
            }
            Text("Unsubscribe anytime.").font(.footnote).foregroundStyle(NativeSetupArtworkStyle.muted)
        }
    }

    private var reminderPage: some View {
        VStack(alignment: .leading, spacing: 20) {
            heading("Want reminders during your free trial?")
            Text("A practice reminder each day, and one the day before it ends.")
                .foregroundStyle(NativeSetupArtworkStyle.muted)
            notification("Ready for 5 minutes of practice? Echo is waiting to play.", when: "now")
            notification("Your free trial ends tomorrow.", when: nil)
            Button { enableReminders() } label: {
                HStack {
                    if reminderBusy { ProgressView() }
                    Text("Turn on reminders").font(.headline)
                }.frame(maxWidth: .infinity, minHeight: 54)
            }
            .buttonStyle(.borderedProminent).disabled(reminderBusy || draft.submitted || transitioning)
            .accessibilityIdentifier("setup-reminders-yes")
            Button("Not now") {
                guard let form, takeTransition() else { return }; commit(form)
            }
            .frame(maxWidth: .infinity, minHeight: 44).foregroundStyle(NativeSetupArtworkStyle.muted)
            .disabled(reminderBusy || draft.submitted || transitioning).accessibilityIdentifier("setup-reminders-no")
        }
    }
    private func notification(_ body: String, when: String?) -> some View {
        HStack(alignment: .top, spacing: 10) {
            NativeSetupArtworkImage(path: "/icon-192.png").frame(width: 34, height: 34)
                .clipShape(RoundedRectangle(cornerRadius: 8)).accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 3) {
                Text("Sona").font(.subheadline.weight(.bold))
                Text(body).font(.subheadline)
            }
            Spacer(minLength: 0)
            if let when { Text(when).font(.caption).foregroundStyle(NativeSetupArtworkStyle.muted) }
        }
        .padding(13).frame(maxWidth: .infinity, alignment: .leading)
        .background(.white.opacity(0.85), in: RoundedRectangle(cornerRadius: 18))
    }

    private var displayName: String {
        let name = draft.name.trimmingCharacters(in: .whitespacesAndNewlines)
        return name.isEmpty ? "your child" : name
    }
    private var readyAnswers: [String] {
        var answers: [String] = []
        switch draft.ageBand {
        case "4": answers.append("Ages 2–4")
        case "6": answers.append("Ages 5–6")
        case "8": answers.append("Ages 7+")
        default: break
        }
        let labels = draft.focusSounds.map { id in form?.sounds.first(where: { $0.id == id })?.label ?? id }
        answers.append(draft.mode == "play" ? "Every sound, easiest first" : (labels.count == 1 ? "Sound: " : "Sounds: ") + labels.joined(separator: " · "))
        if form?.order.contains(.minutes) == true, let minutes = draft.minutes, [3, 5, 10].contains(minutes) {
            answers.append("\(minutes) min a day")
        }
        return answers
    }
    private var answerChips: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(Array(readyAnswers.enumerated()), id: \.offset) { _, answer in
                Text(answer).font(.subheadline.weight(.semibold))
                    .padding(.horizontal, 13).padding(.vertical, 8)
                    .background(.white, in: Capsule())
            }
        }
    }
    private var buildOverlay: some View {
        VStack(spacing: 22) {
            NativeSetupArtworkImage(path: "/assets/crafted/echo-welcome.webp")
                .frame(height: compact ? 140 : 210).accessibilityHidden(true)
            heading("Building \(displayName)'s practice…").privacySensitive()
            VStack(spacing: 10) {
                ForEach(Array(readyAnswers.enumerated()), id: \.offset) { index, answer in
                    Text(answer).font(.subheadline.weight(.semibold)).padding(10)
                        .background(.white, in: Capsule()).opacity(index < visibleBuildAnswers ? 1 : 0)
                }
            }
            .animation(reducedMotion ? nil : .easeOut(duration: 0.2), value: visibleBuildAnswers)
        }
        .padding(24).frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(paper.ignoresSafeArea())
        .accessibilityElement(children: .combine).accessibilityAddTraits(.updatesFrequently)
        .accessibilityIdentifier("setup-build-beat")
    }

    private func heading(_ text: String) -> some View {
        Text(text).font(.system(size: compact ? 27 : 34, weight: .heavy, design: .rounded))
            .fixedSize(horizontal: false, vertical: true).accessibilityAddTraits(.isHeader)
    }
    private func kicker(_ text: String) -> some View {
        Text(text).tracking(1.5).textCase(.uppercase)
            .font(.system(size: 11, weight: .heavy, design: .rounded)).foregroundStyle(coral)
    }
    private func choice<Content: View>(selected: Bool, id: String, action: @escaping () -> Void,
                                      @ViewBuilder content: () -> Content) -> some View {
        Button(action: action) {
            HStack(spacing: 8) {
                content()
                Spacer(minLength: 0)
                if selected { Image(systemName: "checkmark.circle.fill").accessibilityHidden(true) }
            }
            .padding(12).frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
            .background(selected ? NativeSetupArtworkStyle.color(0xffe4cc) : .white, in: RoundedRectangle(cornerRadius: 17))
            .overlay(RoundedRectangle(cornerRadius: 17).stroke(selected ? coral : NativeSetupArtworkStyle.color(0xead7bf)))
        }
        .buttonStyle(.plain).accessibilityValue(selected ? "Selected" : "Not selected")
        .accessibilityAddTraits(selected ? .isSelected : []).accessibilityIdentifier(id)
    }
    private func interestLabel(_ id: String) -> String {
        ["sports": "Sports", "music": "Music", "dinosaurs": "Dinosaurs", "animals": "Animals",
         "space": "Space", "building": "Building", "food": "Food"][id] ?? ""
    }
    @ViewBuilder private func interestArt(_ id: String) -> some View {
        if id == "building" {
            ZStack {
                NativeSetupArtworkImage(path: "/assets/crafted/stack-block-blue-v2.webp").frame(width: 27).offset(x: -8, y: 11)
                NativeSetupArtworkImage(path: "/assets/crafted/stack-block-orange-v2.webp").frame(width: 27).offset(x: 8, y: 11)
                NativeSetupArtworkImage(path: "/assets/crafted/stack-block-yellow-v2.webp").frame(width: 27).offset(y: -10)
            }
        } else {
            let paths = ["sports": "/assets/crafted/game/ball.webp", "music": "/assets/crafted/hat-headphones.webp",
                         "dinosaurs": "/assets/crafted/game/dino-trex.webp", "animals": "/assets/crafted/buddy-bunny-rest.webp",
                         "space": "/assets/crafted/game/rocket-ship.webp", "food": "/assets/crafted/fruit-strawberry.webp"]
            NativeSetupArtworkImage(path: paths[id] ?? "")
        }
    }
    private func skipButton(id: String) -> some View {
        Button("Skip") { skipCurrent() }.frame(minWidth: 44, minHeight: 44)
            .foregroundStyle(NativeSetupArtworkStyle.muted).accessibilityIdentifier(id)
    }
    private func showsFooter(_ form: NativeSetupForm) -> Bool {
        if draft.submitted { return true }
        if draft.step == .reminder { return false }
        if draft.step == .therapy { return NativeSetupDraft.therapyIDs.contains(draft.therapy) }
        if draft.step == .minutes { return draft.minutes.map { [3, 5, 10].contains($0) } == true }
        return true
    }
    private func footer(_ form: NativeSetupForm) -> some View {
        Button(footerTitle) { advance(form) }
            .font(.system(.headline, design: .rounded).weight(.heavy))
            .frame(maxWidth: .infinity, minHeight: compact ? 52 : 56)
            .background(coral, in: Capsule()).foregroundStyle(.white)
            .disabled(!footerEnabled(form))
            .accessibilityIdentifier(draft.step == .welcome ? "onboarding-continue" : "setup-continue")
            .padding(.horizontal, 24).padding(.top, 10).padding(.bottom, 12)
    }
    private var footerTitle: String {
        if waitingForPreflight { return "One moment…" }
        if draft.submitted { return saving ? "One moment…" : "Try again" }
        if draft.step == .welcome { return "Get started" }
        if draft.step == .updates { return "Get the report" }
        return "Continue"
    }
    private func footerEnabled(_ form: NativeSetupForm) -> Bool {
        guard currentOwner != nil, !loading, !saving, !completed, !building, !transitioning, !waitingForPreflight, !reminderBusy else { return false }
        if draft.submitted { return true }
        if draft.step == .welcome { return helloReady }
        // A blank report address must be allowed to reach its authored
        // validation/focus message; Skip is its separate way past the ask.
        if draft.step == .updates { return true }
        return draft.canContinue(in: form)
    }

    private var currentOwner: NativeFamilyChildID? {
        guard visible, let owner, owner == records.activeID else { return nil }
        return owner
    }
    private func live(_ token: UUID, owner captured: NativeFamilyChildID) -> Bool {
        visible && generation == token && owner == captured && records.activeID == captured
    }
    private func draftStore(_ owner: NativeFamilyChildID) -> NativeSetupDraftStore {
        .init(defaults: .standard, owner: NativeFamilyState.scope(of: owner))
    }
    private func persist(_ value: NativeSetupDraft) {
        guard let owner = currentOwner, !loading, !completed else { return }
        do { try draftStore(owner).save(value) }
        catch { message = "Sona couldn’t keep this setup. Try again." }
    }
    private func takeTransition() -> Bool {
        guard currentOwner != nil, !pageBlocked, tapGate.accept(at: ProcessInfo.processInfo.systemUptime) else { return false }
        focusedField = nil; message = ""; settle()
        return true
    }
    private func settle() {
        transitioning = true
        let token = UUID(), lifetime = generation
        transitionToken = token
        transitionTask?.cancel()
        transitionTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 450_000_000)
            guard !Task.isCancelled, visible, generation == lifetime, transitionToken == token else { return }
            transitioning = false
        }
    }
    private func skipCurrent() {
        guard let form, takeTransition() else { return }
        _ = draft.skipCurrent(in: form)
    }
    private func back() {
        guard let form, takeTransition() else { return }
        waitingForPreflight = false
        _ = draft.back(in: form, reminderEligible: draft.step == .reminder)
    }
    private func advance(_ form: NativeSetupForm) {
        guard footerEnabled(form) else { return }
        if draft.submitted { commit(form); return }
        if draft.step == .updates {
            let address = draft.email.trimmingCharacters(in: .whitespacesAndNewlines)
            if address.isEmpty { emailMessage = "Add your email, or tap Skip."; focusedField = .email; return }
            guard NativeSetupDraft.isValidEmail(address) else {
                emailMessage = "That email doesn't look right."; focusedField = .email; return
            }
            draft.email = address
        }
        guard takeTransition() else { return }
        if draft.step == .ready {
            if preflight.busy { waitingForPreflight = true }
            else { leaveReady(form) }
            return
        }
        _ = draft.next(in: form)
    }
    private func leaveReady(_ form: NativeSetupForm) {
        guard currentOwner != nil, draft.step == .ready, !saving, !draft.submitted else { return }
        let offer = form.showSales && reminders.shouldOfferSetup(priceFollows, preflight.confirmedFreeTrial)
        if offer, form.orderedSteps(reminderEligible: true).contains(.reminder) {
            settle()
            _ = draft.next(in: form, reminderEligible: true)
        } else { commit(form) }
    }

    private func entered(_ step: NativeSetupDraft.Step, form: NativeSetupForm) {
        guard let captured = currentOwner else { return }
        focusedField = nil
        if step == .name {
            let token = generation
            Task { @MainActor in
                await Task.yield()
                guard live(token, owner: captured), draft.step == .name, !draft.submitted else { return }
                focusedField = .name
            }
        }
        if step == .welcome {
            if helloVisited || reducedMotion || rewalk || !form.showSales { helloReady = true }
            else {
                helloVisited = true; helloReady = false
                let token = generation
                helloTask?.cancel()
                helloTask = Task { @MainActor in
                    try? await Task.sleep(nanoseconds: 1_750_000_000)
                    guard !Task.isCancelled, live(token, owner: captured), draft.step == .welcome else { return }
                    helloReady = true
                }
            }
        }
        if step == .ready {
            guard !draft.submitted, !building else { return }
            if form.showPlanMoment && !beatDone { beginBuild(form, owner: captured) }
            else { startPreflight(form, owner: captured) }
        }
    }
    private func beginBuild(_ form: NativeSetupForm, owner captured: NativeFamilyChildID) {
        beatDone = true; building = true
        let still = reducedMotion, count = readyAnswers.count, token = generation
        visibleBuildAnswers = still ? count : 0
        let started = ProcessInfo.processInfo.systemUptime
        buildTask?.cancel()
        buildTask = Task { @MainActor in
            if !still {
                for index in 0..<count {
                    try? await Task.sleep(nanoseconds: index == 0 ? 350_000_000 : 500_000_000)
                    guard !Task.isCancelled, live(token, owner: captured), draft.step == .ready else { return }
                    visibleBuildAnswers = reducedMotion ? count : index + 1
                }
            }
            let total = still ? 1.0 : 2.2
            let remaining = max(0, total - (ProcessInfo.processInfo.systemUptime - started))
            try? await Task.sleep(nanoseconds: UInt64(remaining * 1_000_000_000))
            guard !Task.isCancelled, live(token, owner: captured), draft.step == .ready else { return }
            building = false; settle(); startPreflight(form, owner: captured)
        }
    }
    private func startPreflight(_ form: NativeSetupForm, owner captured: NativeFamilyChildID) {
        guard !draft.submitted else { return }
        let token = generation, scope = NativeFamilyState.scope(of: captured)
        let probe = form.showSales && priceFollows ? makeStoreProbe?(captured) : nil
        let reminderActions = reminders
        preflight.start(owner: scope, eligiblePath: form.showSales && priceFollows,
            isCurrent: { live(token, owner: captured) },
            ownership: { await probe?.checkOwnership() },
            monthlyTrial: { await probe?.confirmedMonthlyTrial() ?? false },
            notificationStatus: { await reminderActions.refreshAuthorization() })
    }
    private func enableReminders() {
        guard let captured = currentOwner, draft.step == .reminder, takeTransition() else { return }
        reminderBusy = true
        let operation = UUID(), lifetime = generation, actions = reminders
        reminderToken = operation
        reminderDeadline?.cancel()
        reminderDeadline = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 12_000_000_000)
            guard !Task.isCancelled, live(lifetime, owner: captured) else { return }
            finishReminder(operation, lifetime: lifetime, owner: captured)
        }
        // Do not cancel this authorized service operation on the UI deadline
        // or disappearance. Its late OS answer may persist permission, but the
        // token below can never navigate or submit the questions twice.
        Task { @MainActor in
            _ = await actions.enableReminders()
            finishReminder(operation, lifetime: lifetime, owner: captured)
        }
    }
    private func finishReminder(_ operation: UUID, lifetime: UUID, owner captured: NativeFamilyChildID) {
        guard live(lifetime, owner: captured), reminderToken == operation, reminderBusy,
              draft.step == .reminder, let form else { return }
        reminderToken = nil; reminderBusy = false
        reminderDeadline?.cancel(); reminderDeadline = nil
        commit(form)
    }
    private func commit(_ form: NativeSetupForm) {
        guard let captured = currentOwner, !saving, !completed else { return }
        saving = true; message = ""; focusedField = nil
        if !draft.submitted { draft.submitted = true }
        let submitted = draft, token = generation
        saveTask = Task { @MainActor in
            do {
                // This exact payload and UUID remain on disk on any uncertain
                // outcome. The parent replays the accepted atomic receipt.
                try draftStore(captured).save(submitted)
                try Task.checkCancellation()
                guard live(token, owner: captured) else { return }
                try await onComplete(submitted, form, captured)
                // A later visit may already hold a different draft for this
                // same child. Completing this save cannot erase that draft.
                let store = draftStore(captured)
                if store.read()?.receipt == submitted.receipt { store.remove() }
                if live(token, owner: captured) { completed = true; saving = false }
            } catch {
                guard !Task.isCancelled, live(token, owner: captured) else { return }
                saving = false
                message = "Sona couldn’t finish this setup. Try again."
            }
        }
    }

    private func load() async {
        guard visible else { return }
        cancelPresentation()
        saveTask?.cancel()
        let token = UUID()
        loadToken = token; generation = UUID()
        loading = true; saving = false; completed = false; message = ""
        owner = nil; preparingOwner = nil; form = nil
        building = false; transitioning = false; beatDone = false
        helloReady = false; helloVisited = false; tapGate = NativeSetupTapGate()
        do {
            let captured = try await onPrepare()
            try Task.checkCancellation()
            guard visible, loadToken == token else { return }
            guard records.activeID == captured else { throw NativeFamilyRuleError.playerChanged }
            preparingOwner = captured
            let value: NativeSetupForm = try await records.read(.setupForm, input: .init(rewalk: rewalk))
            try Task.checkCancellation()
            guard visible, loadToken == token else { return }
            guard records.activeID == captured else { throw NativeFamilyRuleError.playerChanged }
            let scratchpad = draftStore(captured)
            var restored = scratchpad.read() ?? value.initialDraft
            if restored.submitted {
                let accepted = try await records.hasAcceptedFamilySetup(owner: captured, receipt: restored.receipt)
                try Task.checkCancellation()
                guard visible, loadToken == token else { return }
                guard records.activeID == captured else { throw NativeFamilyRuleError.playerChanged }
                if accepted {
                    // An interrupted acknowledgement may leave an already saved
                    // draft. A later explicit rewalk gets a new receipt/form.
                    // Never erase a newer draft or an unaccepted attempt.
                    if scratchpad.read()?.receipt == restored.receipt { scratchpad.remove() }
                    restored = scratchpad.read() ?? value.initialDraft
                }
            }
            if !restored.submitted {
                restored = restored.normalized(in: value)
                restored.owner = NativeFamilyState.scope(of: captured)
            }
            owner = captured; preparingOwner = nil; form = value; draft = restored
            try draftStore(captured).save(restored)
            loading = false
            entered(restored.step, form: value)
        } catch {
            guard !Task.isCancelled, visible, loadToken == token else { return }
            loading = false; preparingOwner = nil
            message = "Sona couldn’t open this setup. Try again."
        }
    }
    private func cancelPresentation() {
        helloTask?.cancel(); helloTask = nil
        transitionTask?.cancel(); transitionTask = nil
        buildTask?.cancel(); buildTask = nil
        reminderDeadline?.cancel(); reminderDeadline = nil
        reminderToken = nil; reminderBusy = false; waitingForPreflight = false
        preflight.reset(); focusedField = nil
    }
    private func invalidateOwner() {
        generation = UUID(); loadToken = UUID()
        cancelPresentation(); saveTask?.cancel(); reloadTask?.cancel()
        owner = nil; preparingOwner = nil; form = nil; draft = NativeSetupDraft()
        loading = false; saving = false; completed = false; building = false; transitioning = false
        helloReady = false; helloVisited = false; beatDone = false; tapGate = NativeSetupTapGate()
        message = ""; emailMessage = ""
    }
    private func leaveView() {
        visible = false; generation = UUID(); loadToken = UUID()
        cancelPresentation(); reloadTask?.cancel()
        // A successful atomic save can remove this view before its parent
        // finishes the post-save handoff. Do not cancel that parent operation.
    }
}

import Foundation

/// Local choices only. Access, notification consent and practice never come
/// from this scratchpad. Eligibility comes from the canonical form projection.
struct NativeSetupDraft: Codable, Equatable {
    enum Step: String, Codable, CaseIterable {
        case welcome, name
        case fruitDemo = "reel", pianoDemo = "piano"
        case rachel, interests, therapy, sounds, minutes, updates, ready
        case reminder = "remind"
        init(from decoder: Decoder) throws {
            let value = try decoder.singleValueContainer().decode(String.self)
            if value == "buddy" { self = .name; return } // retired native draft alias
            guard let step = Self(rawValue: value) else {
                throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown setup step"))
            }
            self = step
        }
        var isQuestion: Bool { [.name, .interests, .therapy, .sounds, .minutes].contains(self) }
    }

    static let interestIDs = ["sports", "music", "dinosaurs", "animals", "space", "building", "food"]
    static let therapyIDs = ["t_yes", "t_none", "t_no"]
    var name = ""
    var age = ""
    var focusSounds: [String] = []
    var mode = "speech"
    var pathReason = ""
    var minutes: Int? = 5
    var character = "fox"
    var interests: [String] = []
    var therapy = ""
    var email = ""
    var role = "parent"
    var rewalk = false
    var owner: String?
    var step: Step = .welcome
    var receipt = UUID()
    var submitted = false

    init() {}
    private enum CodingKeys: String, CodingKey {
        case name, age, focusSounds, mode, pathReason, minutes, character, interests, therapy, email, role, rewalk, owner, step, receipt, submitted
    }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        name = try c.decodeIfPresent(String.self, forKey: .name) ?? ""
        age = try c.decodeIfPresent(String.self, forKey: .age) ?? ""
        focusSounds = try c.decodeIfPresent([String].self, forKey: .focusSounds) ?? []
        mode = try c.decodeIfPresent(String.self, forKey: .mode) ?? "speech"
        pathReason = try c.decodeIfPresent(String.self, forKey: .pathReason) ?? ""
        minutes = c.contains(.minutes) ? try c.decodeIfPresent(Int.self, forKey: .minutes) : nil
        character = try c.decodeIfPresent(String.self, forKey: .character) ?? "fox"
        interests = try c.decodeIfPresent([String].self, forKey: .interests) ?? []
        therapy = try c.decodeIfPresent(String.self, forKey: .therapy) ?? ""
        email = try c.decodeIfPresent(String.self, forKey: .email) ?? ""
        role = try c.decodeIfPresent(String.self, forKey: .role) ?? "parent"
        rewalk = try c.decodeIfPresent(Bool.self, forKey: .rewalk) ?? false
        owner = try c.decodeIfPresent(String.self, forKey: .owner)
        step = try c.decodeIfPresent(Step.self, forKey: .step) ?? .welcome
        let heldReceipt = try c.decodeIfPresent(UUID.self, forKey: .receipt)
        receipt = heldReceipt ?? UUID()
        submitted = try c.decodeIfPresent(Bool.self, forKey: .submitted) ?? false
        if submitted && heldReceipt == nil {
            throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Submitted draft has no receipt"))
        }
    }

    var hasName: Bool { !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    var hasSoundChoice: Bool { mode == "play" || mode == "speech" && !focusSounds.isEmpty }
    var ageBand: String {
        guard let value=Int(age), (2...14).contains(value) else { return "" }
        return value<5 ? "4" : value<7 ? "6" : "8"
    }
    static func isValidAge(_ value: String) -> Bool {
        value.isEmpty || value.range(of: "^[0-9]{1,2}$", options: .regularExpression) != nil && Int(value).map { (2...14).contains($0) } == true
    }
    static func isValidEmail(_ value: String) -> Bool {
        value.trimmingCharacters(in: .whitespacesAndNewlines).range(of: "^\\S+@\\S+\\.\\S+$", options: .regularExpression) != nil
    }
    mutating func selectAge(_ band: String) {
        guard !submitted, ["4", "6", "8"].contains(band) else { return }
        age = band // selection never toggles an existing age off
    }
    mutating func toggleSound(_ sound: String) {
        guard !submitted else { return }
        mode = "speech"; pathReason = ""
        if let index = focusSounds.firstIndex(of: sound) { focusSounds.remove(at: index) }
        else { focusSounds.append(sound) }
    }
    mutating func chooseAllSounds() {
        guard !submitted else { return }
        mode = "play"; pathReason = "unsure"; focusSounds = []
    }
    mutating func toggleInterest(_ id: String) {
        guard !submitted, Self.interestIDs.contains(id) else { return }
        if let index = interests.firstIndex(of: id) { interests.remove(at: index) }
        else { interests.append(id) }
    }

    func canContinue(in form: NativeSetupForm) -> Bool {
        guard !submitted else { return false }
        switch step {
        case .name: return hasName && Self.isValidAge(age)
        case .sounds: return mode == "play" || mode == "speech" && !focusSounds.isEmpty && focusSounds.allSatisfy(Set(form.sounds.map(\.id)).contains)
        case .therapy: return Self.therapyIDs.contains(therapy)
        case .minutes: return minutes.map { [3, 5, 10].contains($0) } == true
        case .updates: return Self.isValidEmail(email)
        case .reminder: return false // its own two actions finish the questions
        default: return true
        }
    }
    @discardableResult mutating func next(in form: NativeSetupForm, reminderEligible: Bool = false) -> Bool {
        guard canContinue(in: form) else { return false }
        return advance(in: form, reminderEligible: reminderEligible)
    }
    @discardableResult mutating func back(in form: NativeSetupForm, reminderEligible: Bool = false) -> Bool {
        guard !submitted else { return false }
        let order = form.orderedSteps(reminderEligible: reminderEligible || step == .reminder)
        guard let index = order.firstIndex(of: step), index > 0 else { return false }
        step = order[index - 1]; return true
    }
    @discardableResult mutating func answerTherapy(_ id: String, in form: NativeSetupForm) -> Bool {
        guard !submitted, step == .therapy, Self.therapyIDs.contains(id) else { return false }
        therapy = id; return advance(in: form)
    }
    @discardableResult mutating func answerMinutes(_ value: Int, in form: NativeSetupForm) -> Bool {
        guard !submitted, step == .minutes, [3, 5, 10].contains(value) else { return false }
        minutes = value; return advance(in: form)
    }
    @discardableResult mutating func skipCurrent(in form: NativeSetupForm) -> Bool {
        guard !submitted else { return false }
        switch step {
        case .interests: interests = []
        case .therapy: therapy = ""
        case .minutes: minutes = nil
        case .updates: email = ""
        default: return false
        }
        return advance(in: form)
    }
    private mutating func advance(in form: NativeSetupForm, reminderEligible: Bool = false) -> Bool {
        let order = form.orderedSteps(reminderEligible: reminderEligible)
        guard let index = order.firstIndex(of: step), index + 1 < order.count else { return false }
        step = order[index + 1]; return true
    }
    // Compatibility for the previous essential-only caller; full UI uses form.
    mutating func next(askMinutes: Bool) {
        _ = next(in: .init(askMinutes: askMinutes, sounds: focusSounds.map { .init(id:$0,label:$0,pieces:[]) }))
    }
    mutating func back(askMinutes: Bool) { _ = back(in: .init(askMinutes: askMinutes)) }

    func normalized(in form: NativeSetupForm) -> Self {
        guard !submitted else { return self } // uncertain commit keeps exact payload
        var draft = self
        draft.rewalk = form.rewalk; draft.role = form.isClinician ? "slp" : "parent"
        if !Self.isValidAge(draft.age) { draft.age = "" }
        let valid = Set(form.sounds.map(\.id))
        if !draft.focusSounds.allSatisfy(valid.contains) { draft.focusSounds = [] }
        draft.focusSounds = draft.focusSounds.reduce(into: []) { if !$0.contains($1) { $0.append($1) } }
        if draft.mode != "play" { draft.mode = "speech"; draft.pathReason = "" }
        else { draft.focusSounds = [] }
        draft.interests = Self.interestIDs.filter(draft.interests.contains)
        if !Self.therapyIDs.contains(draft.therapy) { draft.therapy = "" }
        if !form.askMinutes || form.isClinician { draft.minutes = nil }
        else if let value = draft.minutes, ![3, 5, 10].contains(value) { draft.minutes = nil }
        let order = form.order
        if !order.contains(draft.step) {
            let rank = Self.Step.allCases.firstIndex(of: draft.step) ?? 0
            draft.step = order.first { (Self.Step.allCases.firstIndex(of: $0) ?? 0) >= rank } ?? .ready
        }
        // A partially written or retired draft must return to the first
        // required answer it no longer has, rather than trap on ready.
        if let index = order.firstIndex(of: draft.step), let nameIndex = order.firstIndex(of: .name),
           index > nameIndex, (!draft.hasName || !Self.isValidAge(draft.age)) {
            draft.step = .name
        }
        if let index = order.firstIndex(of: draft.step), let soundsIndex = order.firstIndex(of: .sounds),
           index > soundsIndex, !draft.hasSoundChoice {
            draft.step = .sounds
        }
        return draft
    }
}

struct NativeSetupForm: Decodable {
    struct Sound: Decodable, Identifiable {
        struct Piece: Decodable { let text: String; let marked: Bool }
        let id, label: String
        let pieces: [Piece]
        var example: String { pieces.map(\.text).joined() }
        var accessibilityLabel: String {
            let title = id == "TH" ? "TH, unvoiced" : id == "THV" ? "TH, voiced" : label
            return example.isEmpty ? title : "\(title), as in \(example)"
        }
    }
    let name, age, character: String
    let askMinutes: Bool
    let sounds: [Sound]
    let showSales, askQuestions, askUpdates, showPlanMoment, showTherapistLogin, isClinician, rewalk: Bool
    let focusSounds: [String]
    let mode, pathReason, email: String
    let interests: [String]
    let legacyDraftJSON: String?
    let slot: String
    let isSingleChild: Bool

    init(name: String = "", age: String = "", character: String = "fox", askMinutes: Bool = false,
         sounds: [Sound] = [], showSales: Bool = false, askQuestions: Bool = false,
         askUpdates: Bool = false, showPlanMoment: Bool = false, showTherapistLogin: Bool = false,
         isClinician: Bool = false, rewalk: Bool = false, focusSounds: [String] = [],
         mode: String = "speech", pathReason: String = "", email: String = "", interests: [String] = [],
         legacyDraftJSON: String? = nil, slot: String = "", isSingleChild: Bool = false) {
        self.name=name; self.age=age; self.character=character; self.askMinutes=askMinutes; self.sounds=sounds
        self.showSales=showSales; self.askQuestions=askQuestions; self.askUpdates=askUpdates
        self.showPlanMoment=showPlanMoment; self.showTherapistLogin=showTherapistLogin; self.isClinician=isClinician; self.rewalk=rewalk
        self.focusSounds=focusSounds; self.mode=mode; self.pathReason=pathReason; self.email=email; self.interests=interests
        self.legacyDraftJSON=legacyDraftJSON; self.slot=slot; self.isSingleChild=isSingleChild
    }
    private enum CodingKeys: String, CodingKey {
        case name, age, character, askMinutes, sounds, showSales, askQuestions, askUpdates, showPlanMoment, showTherapistLogin, isClinician, rewalk
        case focusSounds, mode, pathReason, email, interests, legacyDraftJSON, slot, isSingleChild
    }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.init(name: try c.decodeIfPresent(String.self, forKey:.name) ?? "", age: try c.decodeIfPresent(String.self,forKey:.age) ?? "",
            character: try c.decodeIfPresent(String.self,forKey:.character) ?? "fox", askMinutes: try c.decodeIfPresent(Bool.self,forKey:.askMinutes) ?? false,
            sounds: try c.decodeIfPresent([Sound].self,forKey:.sounds) ?? [], showSales: try c.decodeIfPresent(Bool.self,forKey:.showSales) ?? false,
            askQuestions: try c.decodeIfPresent(Bool.self,forKey:.askQuestions) ?? false, askUpdates: try c.decodeIfPresent(Bool.self,forKey:.askUpdates) ?? false,
            showPlanMoment: try c.decodeIfPresent(Bool.self,forKey:.showPlanMoment) ?? false, showTherapistLogin: try c.decodeIfPresent(Bool.self,forKey:.showTherapistLogin) ?? false,
            isClinician: try c.decodeIfPresent(Bool.self,forKey:.isClinician) ?? false, rewalk: try c.decodeIfPresent(Bool.self,forKey:.rewalk) ?? false,
            focusSounds: try c.decodeIfPresent([String].self,forKey:.focusSounds) ?? [], mode: try c.decodeIfPresent(String.self,forKey:.mode) ?? "speech",
            pathReason: try c.decodeIfPresent(String.self,forKey:.pathReason) ?? "", email: try c.decodeIfPresent(String.self,forKey:.email) ?? "",
            interests: try c.decodeIfPresent([String].self,forKey:.interests) ?? [], legacyDraftJSON: try c.decodeIfPresent(String.self,forKey:.legacyDraftJSON),
            slot: try c.decodeIfPresent(String.self,forKey:.slot) ?? "", isSingleChild: try c.decodeIfPresent(Bool.self,forKey:.isSingleChild) ?? false)
    }
    var order: [NativeSetupDraft.Step] { orderedSteps() }
    func orderedSteps(reminderEligible: Bool = false) -> [NativeSetupDraft.Step] {
        let sales = showSales && !rewalk && !isClinician
        var steps: [NativeSetupDraft.Step] = [.welcome,.name]
        if sales { steps += [.fruitDemo,.pianoDemo,.rachel,.interests] }
        if askQuestions && !isClinician { steps.append(.therapy) }
        steps.append(.sounds)
        if askMinutes && !isClinician { steps.append(.minutes) }
        if askUpdates && !isClinician { steps.append(.updates) }
        steps.append(.ready)
        if sales && showPlanMoment && reminderEligible { steps.append(.reminder) }
        return steps
    }
    var initialDraft: NativeSetupDraft {
        var draft=NativeSetupDraft()
        draft.name=name; draft.age=age; draft.character=character; draft.email=email; draft.interests=interests
        draft.rewalk=rewalk; draft.role=isClinician ? "slp" : "parent"
        draft.minutes=askMinutes && !rewalk && !isClinician ? 5 : nil
        if rewalk { draft.focusSounds=focusSounds; draft.mode=mode; draft.pathReason=pathReason }
        if !rewalk, let raw=legacyDraftJSON, let data=raw.data(using:.utf8),
           let held=(try? JSONSerialization.jsonObject(with:data)) as? [String:Any], ownsLegacy(held) {
            if let value=held["childName"] as? String { draft.name=value }
            if let value=held["childAge"] as? String { draft.age=value }
            else if let value=held["childAge"] as? Int { draft.age=String(value) }
            // The host projects a valid existing or same-child legacy buddy.
            // Raw scratchpad text cannot override that catalog validation.
            if let value=held["mode"] as? String { draft.mode=value }
            if let value=held["pathReason"] as? String { draft.pathReason=value }
            if let value=held["focusSounds"] as? [String] { draft.focusSounds=value }
            if let value=held["interests"] as? [String] { draft.interests=value }
            if let value=held["therapy"] as? String { draft.therapy=value }
            if let value=held["email"] as? String { draft.email=value }
            if held.keys.contains("minutes") {
                // A restored skip or corrupt old choice is never a fresh five.
                draft.minutes=(held["minutes"] as? String).flatMap(Int.init) ?? (held["minutes"] as? Int)
            }
        }
        return draft.normalized(in:self)
    }
    private func ownsLegacy(_ held: [String:Any]) -> Bool {
        if let kid=held["kid"] { return (kid as? String)==slot }
        return isSingleChild && slot.isEmpty
    }
}

struct NativeSetupDraftStore {
    enum Failure: Error { case ownerMismatch }
    let defaults: UserDefaults
    let owner: String
    static func key(owner: String) -> String { "sona.native.setup-draft.v1/"+owner }
    func read() -> NativeSetupDraft? {
        guard let data=defaults.data(forKey:Self.key(owner:owner)),
              let draft=try? JSONDecoder().decode(NativeSetupDraft.self,from:data),
              draft.owner==nil || draft.owner==owner else { return nil }
        return draft
    }
    func save(_ draft: NativeSetupDraft) throws {
        guard draft.owner==nil || draft.owner==owner else { throw Failure.ownerMismatch }
        var bound=draft;bound.owner=owner
        defaults.set(try JSONEncoder().encode(bound),forKey:Self.key(owner:owner))
    }
    func remove() { defaults.removeObject(forKey:Self.key(owner:owner)) }
}

/// Process-local, like the canonical tab marker. Never encode as a grant.
struct NativeSetupHandoff: Equatable {
    enum Action: Equatable { case home, store, microphone, handoff, fruitSlice }
    let owner: String
    let createdAt: Date
    init(owner: String, createdAt: Date = Date()) { self.owner=owner;self.createdAt=createdAt }
    func isValid(currentOwner: String?, now: Date = Date()) -> Bool {
        let age=now.timeIntervalSince(createdAt)
        return owner==currentOwner && age.isFinite && age>=0 && age<2*60*60
    }
    static func afterSave(owner: String, currentOwner: String?, requiresTrialFirst: Bool, allowsPractice: Bool) -> Action {
        guard owner==currentOwner else { return .home }
        if requiresTrialFirst { return .store }
        return allowsPractice ? .microphone : .home
    }
    func afterStore(currentOwner: String?, allowsPractice: Bool, now: Date = Date()) -> Action {
        isValid(currentOwner:currentOwner,now:now) && allowsPractice ? .microphone : .home
    }
    func afterMicrophone(currentOwner: String?, now: Date = Date()) -> Action {
        isValid(currentOwner:currentOwner,now:now) ? .handoff : .home
    }
    func afterHandoff(currentOwner: String?, requiresTrialFirst: Bool, allowsPractice: Bool,
                      isClinician: Bool = false, now: Date = Date()) -> Action {
        guard isValid(currentOwner:currentOwner,now:now) else { return .home }
        if isClinician { return .home }
        if requiresTrialFirst { return .store }
        return allowsPractice ? .fruitSlice : .home
    }
}

/// Monotonic, visit-local settle period; never persist an uptime deadline.
struct NativeSetupTapGate {
    private var allowedAt = -Double.infinity
    mutating func accept(at uptime: TimeInterval) -> Bool {
        guard uptime.isFinite, uptime>=allowedAt else { return false }
        allowedAt=uptime+0.45;return true
    }
}

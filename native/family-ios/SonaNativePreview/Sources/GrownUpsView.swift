import SwiftUI

/// Local preview settings only. Opening this sheet never grants access,
/// records practice, or changes the playable round's behavior.
struct GrownUpsView: View {
    @Binding var targetSound: String
    let hasPlayed: Bool
    let familyUsername: String?
    let onFamilyLogin: () -> Void
    let onChangePassword: (String, String) async throws -> Void

    @Environment(\.dismiss) private var dismiss
    @FocusState private var answerFocused: Bool
    @State private var digits = (0..<4).map { _ in Int.random(in: 0...9) }
    @State private var answer = ""
    @State private var unlocked = false
    @State private var showError = false

    private let sounds = ["P", "B", "M", "N", "T", "D", "K", "G", "F", "V", "S", "Z", "SH", "CH", "J", "L", "R", "TH", "THV"]
    private let numberWords = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    if unlocked {
                        settings
                    } else {
                        adultCheck
                    }
                }
                .padding(24)
                .frame(maxWidth: 540, alignment: .leading)
                .frame(maxWidth: .infinity, alignment: .top)
            }
            .background(GrownUpsPalette.paper.ignoresSafeArea())
            .foregroundStyle(GrownUpsPalette.ink)
            .navigationTitle("Grown-ups")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                        .fontWeight(.semibold)
                        .accessibilityIdentifier("grownups-close")
                }
            }
            .tint(GrownUpsPalette.teal)
        }
        .preferredColorScheme(.light)
    }

    private var adultCheck: some View {
        VStack(alignment: .leading, spacing: 24) {
            introduction(
                icon: "lock.open",
                eyebrow: "JUST FOR GROWN-UPS",
                title: "A little check first.",
                detail: "Read the words, then type those four numbers in order."
            )

            VStack(alignment: .leading, spacing: 18) {
                Text(digits.map { numberWords[$0] }.joined(separator: " · "))
                    .font(.system(.title3, design: .rounded, weight: .bold))
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityLabel("Number words: " + digits.map { numberWords[$0] }.joined(separator: ", "))
                    .accessibilityIdentifier("grownups-challenge")

                VStack(alignment: .leading, spacing: 8) {
                    Text("Four numbers")
                        .font(.subheadline.weight(.semibold))
                    TextField("Enter numbers", text: $answer)
                        .font(.system(.title2, design: .rounded, weight: .semibold))
                        .monospacedDigit()
                        .keyboardType(.numberPad)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($answerFocused)
                        .padding(16)
                        .background(GrownUpsPalette.paper, in: RoundedRectangle(cornerRadius: 15))
                        .overlay {
                            RoundedRectangle(cornerRadius: 15)
                                .strokeBorder(showError ? Color.red : GrownUpsPalette.line, lineWidth: 1.5)
                        }
                        .accessibilityLabel("Four numbers")
                        .accessibilityHint("Enter the digits for the four number words above")
                        .accessibilityIdentifier("grownups-answer")
                        .onChange(of: answer) { newValue in
                            let clean = String(newValue.filter { "0123456789".contains($0) }.prefix(4))
                            if answer != clean { answer = clean }
                            if !newValue.isEmpty { showError = false }
                        }
                }

                if showError {
                    Text("Those don’t match yet. Read the words and try again.")
                        .font(.subheadline)
                        .foregroundStyle(Color(red: 0.65, green: 0.20, blue: 0.18))
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityIdentifier("grownups-error")
                }

                Button(action: unlock) {
                    HStack {
                        Text("Unlock")
                        Spacer()
                        Image(systemName: "arrow.right")
                    }
                    .font(.body.weight(.bold))
                    .padding(17)
                    .foregroundStyle(.white)
                    .background(GrownUpsPalette.teal, in: RoundedRectangle(cornerRadius: 16))
                }
                .buttonStyle(.plain)
                .disabled(answer.count != 4)
                .opacity(answer.count == 4 ? 1 : 0.55)
                .accessibilityIdentifier("grownups-unlock")
            }
            .padding(22)
            .background(.white, in: RoundedRectangle(cornerRadius: 25))
            .overlay {
                RoundedRectangle(cornerRadius: 25)
                    .strokeBorder(GrownUpsPalette.line, lineWidth: 1)
            }
        }
    }

    private var settings: some View {
        VStack(alignment: .leading, spacing: 24) {
            introduction(
                icon: "slider.horizontal.3",
                eyebrow: "A LITTLE ROOM FOR YOU",
                title: "Make it yours.",
                detail: "A few simple choices for this native preview."
            )

            VStack(alignment: .leading, spacing: 9) {
                Text("Your login")
                    .font(.system(.title2, design: .rounded, weight: .bold))
                    .accessibilityAddTraits(.isHeader)
                if let familyUsername {
                    Text(familyUsername)
                        .privacySensitive()
                        .foregroundStyle(GrownUpsPalette.muted)
                    NavigationLink {
                        FamilyChangePasswordView(onChangePassword: onChangePassword)
                    } label: {
                        Label("Change password", systemImage: "key")
                            .frame(minHeight: 44)
                    }
                    .accessibilityIdentifier("grownups-change-password")
                } else {
                    Button(action: onFamilyLogin) {
                        Label("I have a login from my speech therapist", systemImage: "person.badge.key")
                            .frame(minHeight: 44)
                            .multilineTextAlignment(.leading)
                    }
                    .accessibilityIdentifier("grownups-family-login")
                }
            }

            VStack(alignment: .leading, spacing: 16) {
                Text("Sound on Home")
                    .font(.system(.title2, design: .rounded, weight: .bold))
                    .accessibilityAddTraits(.isHeader)
                Text("Choose a sound to show on Home. You can leave this blank.")
                    .font(.subheadline)
                    .foregroundStyle(GrownUpsPalette.muted)
                    .fixedSize(horizontal: false, vertical: true)

                LazyVGrid(columns: [GridItem(.adaptive(minimum: 82), spacing: 10)], spacing: 10) {
                    ForEach(sounds, id: \.self) { sound in
                        soundButton(sound)
                    }
                }

                Button {
                    targetSound = ""
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: targetSound.isEmpty ? "checkmark.circle.fill" : "circle")
                            .foregroundStyle(GrownUpsPalette.teal)
                        Text("Leave sound blank")
                            .font(.body.weight(.medium))
                            .foregroundStyle(GrownUpsPalette.ink)
                        Spacer(minLength: 0)
                    }
                    .padding(.vertical, 12)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityValue(targetSound.isEmpty ? "Selected" : "Not selected")
                .accessibilityIdentifier("grownups-sound-clear")
            }
            .padding(22)
            .background(.white, in: RoundedRectangle(cornerRadius: 25))

            HStack(alignment: .top, spacing: 14) {
                Image(systemName: hasPlayed ? "checkmark.seal.fill" : "leaf")
                    .font(.title2)
                    .foregroundStyle(GrownUpsPalette.teal)
                    .padding(12)
                    .background(.white.opacity(0.75), in: RoundedRectangle(cornerRadius: 15))

                VStack(alignment: .leading, spacing: 6) {
                    Text("A little progress")
                        .font(.system(.headline, design: .rounded))
                        .accessibilityAddTraits(.isHeader)
                    Text(hasPlayed ? "Finished a game." : "No game finished yet.")
                        .font(.subheadline)
                        .foregroundStyle(GrownUpsPalette.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(GrownUpsPalette.mint, in: RoundedRectangle(cornerRadius: 24))
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier("grownups-progress")
        }
    }

    private func soundButton(_ sound: String) -> some View {
        let selected = targetSound == sound
        let label = sound == "THV" ? "TH (v)" : sound
        return Button {
            targetSound = sound
        } label: {
            VStack(spacing: 7) {
                Text(label)
                    .font(.system(.title2, design: .rounded, weight: .bold))
                Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                    .font(.caption)
            }
            .foregroundStyle(selected ? .white : GrownUpsPalette.ink)
            .frame(maxWidth: .infinity, minHeight: 78)
            .padding(.vertical, 6)
            .background(selected ? GrownUpsPalette.teal : GrownUpsPalette.paper, in: RoundedRectangle(cornerRadius: 18))
            .overlay {
                RoundedRectangle(cornerRadius: 18)
                    .strokeBorder(selected ? GrownUpsPalette.teal : GrownUpsPalette.line, lineWidth: 1.5)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(label) sound")
        .accessibilityValue(selected ? "Selected" : "Not selected")
        .accessibilityAddTraits(selected ? .isSelected : [])
        .accessibilityIdentifier("grownups-sound-\(sound)")
    }

    private func introduction(icon: String, eyebrow: String, title: String, detail: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Image(systemName: icon)
                .font(.title2.weight(.medium))
                .foregroundStyle(GrownUpsPalette.teal)
                .frame(width: 54, height: 54)
                .background(GrownUpsPalette.mint, in: RoundedRectangle(cornerRadius: 18))
                .accessibilityHidden(true)
            Text(eyebrow)
                .font(.caption.weight(.bold))
                .tracking(1.1)
                .foregroundStyle(GrownUpsPalette.muted)
            Text(title)
                .font(.system(.largeTitle, design: .rounded, weight: .bold))
                .accessibilityAddTraits(.isHeader)
            Text(detail)
                .font(.body)
                .foregroundStyle(GrownUpsPalette.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func unlock() {
        guard answer == digits.map(String.init).joined() else {
            answer = ""
            showError = true
            return
        }
        answerFocused = false
        answer = ""
        unlocked = true
    }
}

private enum GrownUpsPalette {
    static let paper = Color(red: 1.0, green: 0.961, blue: 0.914)
    static let ink = Color(red: 0.153, green: 0.137, blue: 0.216)
    static let muted = Color(red: 0.40, green: 0.36, blue: 0.46)
    static let teal = Color(red: 0.067, green: 0.498, blue: 0.518)
    static let mint = Color(red: 0.87, green: 0.94, blue: 0.89)
    static let line = Color(red: 0.88, green: 0.85, blue: 0.81)
}

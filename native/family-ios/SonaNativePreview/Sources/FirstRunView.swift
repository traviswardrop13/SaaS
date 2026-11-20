import SwiftUI

enum PreviewBuddy: String, Codable, CaseIterable, Identifiable {
    case echo, fox, frog

    var id: String { rawValue }

    var title: String {
        switch self {
        case .echo: return "Echo"
        case .fox: return "Pip"
        case .frog: return "Hops"
        }
    }

    var asset: String {
        switch self {
        case .echo: return "echo-welcome"
        case .fox: return "buddy-fox"
        case .frog: return "buddy-frog"
        }
    }
}

/// A local, two-screen welcome. A buddy choice is the only value it changes.
/// It never asks for a name, microphone, account, or practice information.
struct FirstRunView: View {
    @Binding var buddy: PreviewBuddy
    let onExplore: () -> Void
    let onTherapistLogin: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var typeSize
    @State private var choosingBuddy = false

    var body: some View {
        GeometryReader { screen in
            let compact = screen.size.height < 650

            VStack(spacing: 0) {
                header
                    .padding(.horizontal, compact ? 20 : 26)
                    .padding(.top, 6)
                    .padding(.bottom, 10)

                GeometryReader { content in
                    ScrollView {
                        Group {
                            if choosingBuddy {
                                buddyChoice(height: content.size.height, compact: compact)
                            } else {
                                welcome(height: content.size.height, compact: compact)
                            }
                        }
                        .frame(maxWidth: 500)
                        .frame(maxWidth: .infinity)
                        .frame(minHeight: content.size.height)
                        .padding(.horizontal, compact ? 24 : 30)
                    }
                }

                footer(compact: compact)
                    .frame(maxWidth: 500)
                    .padding(.horizontal, compact ? 24 : 30)
                    .padding(.top, 16)
                    .padding(.bottom, compact ? 12 : 20)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(FirstRunPalette.paper.ignoresSafeArea())
        .preferredColorScheme(.light)
    }

    private var header: some View {
        HStack(spacing: 8) {
            if choosingBuddy {
                Button {
                    changePage(toBuddy: false)
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(.body, design: .rounded, weight: .bold))
                        .frame(width: 44, height: 44)
                        .contentShape(Circle())
                }
                .buttonStyle(FirstRunPressStyle())
                .accessibilityLabel("Back to welcome")
                .accessibilityIdentifier("onboarding-back")
            }

            Text("Sona")
                .font(.system(.title, design: .rounded, weight: .heavy))
                .tracking(-1)
                .accessibilityLabel("Sona native preview")

            Spacer(minLength: 8)

            Button(action: onExplore) {
                Text("Explore first")
                    .font(.system(.subheadline, design: .rounded, weight: .bold))
                    .padding(.horizontal, 10)
                    .frame(minHeight: 44)
                    .contentShape(Capsule())
            }
            .buttonStyle(FirstRunPressStyle())
            .accessibilityHint("Skip the welcome and open Home")
            .accessibilityIdentifier("onboarding-explore")
        }
        .foregroundStyle(FirstRunPalette.ink)
    }

    private func welcome(height: CGFloat, compact: Bool) -> some View {
        VStack(spacing: compact ? 16 : 24) {
            buddyPortrait(
                asset: "echo-welcome",
                size: min(270, max(140, height * 0.47)),
                color: FirstRunPalette.mint
            )

            VStack(spacing: 12) {
                Text("Little adventures.\nBig smiles.")
                    .font(.system(.largeTitle, design: .rounded, weight: .heavy))
                    .tracking(-0.9)
                    .lineSpacing(-1)
                    .foregroundStyle(FirstRunPalette.ink)
                    .accessibilityAddTraits(.isHeader)

                Text("Come play with Echo.")
                    .font(.system(.body, design: .rounded, weight: .medium))
                    .foregroundStyle(FirstRunPalette.secondary)
            }
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.vertical, 12)
        .accessibilityElement(children: .contain)
    }

    private func buddyChoice(height: CGFloat, compact: Bool) -> some View {
        VStack(spacing: compact ? 16 : 22) {
            VStack(spacing: 9) {
                Text("Pick your buddy")
                    .font(.system(.largeTitle, design: .rounded, weight: .heavy))
                    .tracking(-0.9)
                    .foregroundStyle(FirstRunPalette.ink)
                    .accessibilityAddTraits(.isHeader)

                Text("Who’s coming with you?")
                    .font(.system(.body, design: .rounded, weight: .medium))
                    .foregroundStyle(FirstRunPalette.secondary)
            }
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)

            if !typeSize.isAccessibilitySize {
                buddyPortrait(
                    asset: buddy.asset,
                    size: min(210, max(110, height * 0.34)),
                    color: FirstRunPalette.mint
                )
                .id(buddy)
                .transition(.opacity)
            }

            Group {
                if typeSize.isAccessibilitySize {
                    VStack(spacing: 12) {
                        ForEach(PreviewBuddy.allCases) { candidate in
                            buddyButton(candidate, horizontal: true)
                        }
                    }
                } else {
                    HStack(spacing: compact ? 10 : 14) {
                        ForEach(PreviewBuddy.allCases) { candidate in
                            buddyButton(candidate, horizontal: false)
                        }
                    }
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Choose your adventure buddy")
        }
        .padding(.vertical, 12)
    }

    private func buddyPortrait(asset: String, size: CGFloat, color: Color) -> some View {
        ZStack {
            Circle()
                .fill(color)
                .frame(width: size * 0.92, height: size * 0.92)
                .offset(y: size * 0.025)

            Ellipse()
                .fill(FirstRunPalette.ink.opacity(0.06))
                .frame(width: size * 0.56, height: size * 0.055)
                .offset(y: size * 0.37)

            Image(asset)
                .resizable()
                .scaledToFit()
                .frame(width: size, height: size)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }

    private func buddyButton(_ candidate: PreviewBuddy, horizontal: Bool) -> some View {
        let selected = buddy == candidate

        return Button {
            withAnimation(reduceMotion ? nil : .easeOut(duration: 0.18)) {
                buddy = candidate
            }
        } label: {
            Group {
                if horizontal {
                    HStack(spacing: 14) {
                        candidatePortrait(candidate, size: 48)
                        Text(candidate.title)
                        Spacer(minLength: 4)
                        selectionMark(selected)
                    }
                } else {
                    VStack(spacing: 6) {
                        candidatePortrait(candidate, size: 52)
                        HStack(spacing: 5) {
                            Text(candidate.title)
                            if selected {
                                Image(systemName: "checkmark")
                                    .font(.system(.caption, design: .rounded, weight: .heavy))
                                    .accessibilityHidden(true)
                            }
                        }
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .font(.system(.subheadline, design: .rounded, weight: .bold))
            .foregroundStyle(FirstRunPalette.ink)
            .padding(horizontal ? 14 : 10)
            .frame(maxWidth: .infinity, minHeight: 44)
            .background(
                selected ? FirstRunPalette.selected : Color.white.opacity(0.72),
                in: RoundedRectangle(cornerRadius: 20)
            )
            .overlay {
                RoundedRectangle(cornerRadius: 20)
                    .strokeBorder(selected ? FirstRunPalette.teal : FirstRunPalette.line, lineWidth: selected ? 2.5 : 1.5)
            }
        }
        .buttonStyle(FirstRunPressStyle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(candidate.title)
        .accessibilityValue(selected ? "Selected" : "")
        .accessibilityAddTraits(selected ? [.isSelected] : [])
        .accessibilityIdentifier("buddy-" + candidate.rawValue)
    }

    private func candidatePortrait(_ candidate: PreviewBuddy, size: CGFloat) -> some View {
        Image(candidate.asset)
            .resizable()
            .scaledToFit()
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }

    private func selectionMark(_ selected: Bool) -> some View {
        Image(systemName: selected ? "checkmark.circle.fill" : "circle")
            .font(.system(.title3, design: .rounded, weight: .medium))
            .foregroundStyle(selected ? FirstRunPalette.teal : FirstRunPalette.line)
            .accessibilityHidden(true)
    }

    private func footer(compact: Bool) -> some View {
        VStack(spacing: 16) {
            Button {
                if choosingBuddy {
                    onExplore()
                } else {
                    changePage(toBuddy: true)
                }
            } label: {
                HStack(spacing: 12) {
                    Text(choosingBuddy ? "Explore Sona" : "Let’s go")
                    Spacer(minLength: 8)
                    Image(systemName: "arrow.right")
                        .font(.system(.body, design: .rounded, weight: .bold))
                        .accessibilityHidden(true)
                }
                .font(.system(.title3, design: .rounded, weight: .heavy))
                .foregroundStyle(.white)
                .padding(.horizontal, 22)
                .padding(.vertical, 16)
                .frame(maxWidth: .infinity, minHeight: compact ? 54 : 58)
                .background(FirstRunPalette.teal, in: RoundedRectangle(cornerRadius: 19))
                .shadow(color: FirstRunPalette.deepTeal, radius: 0, x: 0, y: 4)
            }
            .buttonStyle(FirstRunPressStyle())
            .accessibilityIdentifier(choosingBuddy ? "onboarding-play" : "onboarding-next")

            if !choosingBuddy {
                Button(action: onTherapistLogin) {
                    Label("I have a login from my speech therapist", systemImage: "person.badge.key")
                        .font(.system(.subheadline, design: .rounded, weight: .bold))
                        .foregroundStyle(FirstRunPalette.deepTeal)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                        .frame(maxWidth: .infinity, minHeight: 49)
                        .background(.white, in: RoundedRectangle(cornerRadius: 16))
                        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(FirstRunPalette.deepTeal.opacity(0.25)))
                }
                .buttonStyle(FirstRunPressStyle())
                .accessibilityIdentifier("onboarding-therapist-login")
            }

            HStack(spacing: 6) {
                Capsule().fill(choosingBuddy ? FirstRunPalette.line : FirstRunPalette.teal)
                    .frame(width: choosingBuddy ? 6 : 20, height: 6)
                Capsule().fill(choosingBuddy ? FirstRunPalette.teal : FirstRunPalette.line)
                    .frame(width: choosingBuddy ? 20 : 6, height: 6)
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(choosingBuddy ? "Choose a buddy. Step 2 of 2." : "Welcome. Step 1 of 2.")
        }
    }

    private func changePage(toBuddy: Bool) {
        withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.20)) {
            choosingBuddy = toBuddy
        }
    }
}

private enum FirstRunPalette {
    static let paper = Color(red: 1, green: 0.969, blue: 0.933)
    static let ink = Color(red: 0.153, green: 0.137, blue: 0.216)
    static let secondary = Color(red: 0.40, green: 0.37, blue: 0.43)
    static let mint = Color(red: 0.83, green: 0.92, blue: 0.87)
    static let selected = Color(red: 0.88, green: 0.96, blue: 0.93)
    static let line = Color(red: 0.81, green: 0.82, blue: 0.78)
    static let teal = Color(red: 0.067, green: 0.498, blue: 0.518)
    static let deepTeal = Color(red: 0.035, green: 0.35, blue: 0.36)
}

private struct FirstRunPressStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed ? 0.82 : 1)
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.985 : 1)
            .animation(reduceMotion ? nil : .easeOut(duration: 0.10), value: configuration.isPressed)
    }
}

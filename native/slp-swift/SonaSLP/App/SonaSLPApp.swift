import SwiftUI

/// Sona for SLPs, built in SwiftUI (20 Nov 2026, Travis: "a Swift build of
/// the mobile app for the SLP dashboard"). It replaces the web-view shell in
/// native/slp-ios and talks to the same server. It sells nothing (App Store
/// rule 3.1.1): no price, no trial words, no link to buy.
@main
struct SonaSLPApp: App {
    @State private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .tint(.sonaTeal)
                .task { await model.start() }
        }
    }
}

extension Color {
    static let sonaTeal = Color(red: 0.055, green: 0.486, blue: 0.525)   // #0e7c86, the dashboard's one accent
    static let sonaButter = Color(red: 1.0, green: 0.95, blue: 0.78)
    static let sonaMuted = Color(red: 0.42, green: 0.45, blue: 0.5)
}

struct RootView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        switch model.phase {
        case .starting:
            ProgressView().controlSize(.large)
        case .signedOut:
            SignInView()
        case .needsProfile:
            ProfileSetupView()
        case .locked:
            LockedView()
        case .ready:
            MainTabs()
        }
    }
}

struct MainTabs: View {
    @State private var chatOpen = false

    var body: some View {
        TabView {
            TodayView(chatOpen: $chatOpen)
                .tabItem { Label("Today", systemImage: "calendar") }
            CaseloadView(chatOpen: $chatOpen)
                .tabItem { Label("Caseload", systemImage: "person.2") }
            SettingsView(chatOpen: $chatOpen)
                .tabItem { Label("Settings", systemImage: "gearshape") }
        }
        .sheet(isPresented: $chatOpen) { ChatView() }
    }
}

/// The message-us button every screen carries in its top bar.
struct ChatButton: View {
    @Binding var open: Bool
    var body: some View {
        Button { open = true } label: { Image(systemName: "bubble.left.and.text.bubble.right") }
            .accessibilityLabel("Message the Sona team")
    }
}

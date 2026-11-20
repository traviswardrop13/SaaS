import SwiftUI

/// Keep the back button and the iPhone single-column flow on iOS 15 while
/// using the current native navigation stack on newer devices.
struct SonaNavigation<Content: View>: View {
    @ViewBuilder let content: () -> Content

    var body: some View {
        if #available(iOS 16, *) {
            NavigationStack { content() }
        } else {
            NavigationView { content() }
                .navigationViewStyle(.stack)
        }
    }
}

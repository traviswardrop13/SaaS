#if os(iOS)
import SwiftUI

private struct NativeReminderAudioOwnersKey: EnvironmentKey {
    static let defaultValue: NativeReminderAudioOwners? = nil
}
public extension EnvironmentValues {
    var nativeReminderAudioOwners: NativeReminderAudioOwners? {
        get { self[NativeReminderAudioOwnersKey.self] }
        set { self[NativeReminderAudioOwnersKey.self] = newValue }
    }
}
@MainActor private struct NativeReminderAudioOwnerModifier<Owner: AnyObject>: ViewModifier {
    let owner: Owner
    let close: @MainActor (Owner) async -> Void
    @Environment(\.nativeReminderAudioOwners) private var owners
    @State private var registration: UUID?
    func body(content: Content) -> some View {
        content.onAppear {
            if registration == nil { registration = owners?.register(owner, close: close) }
        }.onDisappear {
            if let registration { owners?.unregister(registration) }
            registration = nil
        }
    }
}
public extension View {
    @MainActor func nativeReminderAudioOwner<Owner: AnyObject>(_ owner: Owner,
        close: @escaping @MainActor (Owner) async -> Void) -> some View {
        modifier(NativeReminderAudioOwnerModifier(owner: owner, close: close))
    }
}
#endif

import Foundation
import Combine
#if canImport(NativeTrialReminders)
import NativeTrialReminders
#endif

public struct NativeReminderOpen: Equatable, Hashable, Sendable {
    public let id: String
    public let deliveredAt: Date
    public init(id: String, deliveredAt: Date) { self.id = id; self.deliveredAt = deliveredAt }
}
public enum NativeReminderRouteAdmission: Sendable { case deferUntilReady, protectedFlow, allowed }

/// One tap survives a cold launch/foreground transition. Neither transition
/// manufactures a tap. Parent/setup flows consume a tap without navigating.
@MainActor public final class NativeReminderTapRouter: ObservableObject {
    public static let shared = NativeReminderTapRouter()
    @Published public private(set) var pending: NativeReminderOpen?
    private var seen: [NativeReminderOpen] = []
    private var handling = false
    public init() {}
    @discardableResult public func receive(_ event: NativeReminderOpen) -> Bool {
        let nudge = event.id.hasPrefix("sona-nudge-") && event.id.utf8.count == 19 && event.id.dropFirst(11).utf8.allSatisfy { (48...57).contains($0) }
        guard (event.id == NativeTrialReminderPolicy.trialID || nudge),
              event.deliveredAt.timeIntervalSince1970.isFinite, !seen.contains(event) else { return false }
        seen.append(event); if seen.count > 64 { seen.removeFirst() }
        pending = event; return true
    }
    @discardableResult public func handle(admission: @MainActor () -> NativeReminderRouteAdmission,
        closeOutgoing: @MainActor () async -> Void, showHome: @MainActor () -> Void) async -> Bool {
        guard !handling else { return false }
        handling = true; defer { handling = false }
        while let event = pending {
            switch admission() {
            case .deferUntilReady: return false
            case .protectedFlow: pending = nil; return false
            case .allowed: break
            }
            await closeOutgoing()
            guard pending == event else { continue }
            switch admission() {
            case .deferUntilReady: return false
            case .protectedFlow: pending = nil; return false
            case .allowed:
                pending = nil; showHome(); return true
            }
        }
        return false
    }
}

/// Captures the outgoing view owners, never a global/shared audio driver.
/// New registrations cannot be reached by a late cleanup of that capture.
@MainActor public final class NativeReminderAudioOwners: ObservableObject {
    private final class WeakOwner { weak var value: AnyObject?; init(_ value: AnyObject) { self.value = value } }
    private struct Entry {
        let owner: WeakOwner
        let close: @MainActor (AnyObject) async -> Void
    }
    private var entries: [UUID: Entry] = [:]
    public init() {}
    public func register<Owner: AnyObject>(_ owner: Owner, close: @escaping @MainActor (Owner) async -> Void) -> UUID {
        let token = UUID()
        entries[token] = .init(owner: WeakOwner(owner), close: { if let typed = $0 as? Owner { await close(typed) } })
        return token
    }
    public func unregister(_ token: UUID) { entries.removeValue(forKey: token) }
    public func closeCapturedOwners() async {
        let captured = entries.values.compactMap { entry -> (AnyObject, @MainActor (AnyObject) async -> Void)? in
            guard let owner = entry.owner.value else { return nil }; return (owner, entry.close)
        }
        let tasks = captured.map { owner, close in Task { await close(owner) } }
        for task in tasks { await task.value }
    }
}

#if os(iOS)
import Foundation
import UserNotifications

/// No APNs registration, token, background mode, network, badge, or audio input.
/// Foreground delivery is a banner/list only, so it cannot play into Sona's mic.
@MainActor public final class NativeTrialReminderUNClient: NSObject, NativeTrialReminderClient, UNUserNotificationCenterDelegate {
    public let isAvailable: Bool
    private let center: UNUserNotificationCenter
    public init(center: UNUserNotificationCenter = .current()) {
        self.center = center
        isAvailable = Bundle.main.bundleIdentifier == "com.speaksona.app"
        super.init()
        // Retain this client for the app lifetime. Preview never takes over.
        if isAvailable { center.delegate = self }
    }
    public func authorization() async throws -> NativeTrialReminderAuthorization {
        guard isAvailable else { return .unavailable }
        let settings = await center.notificationSettings()
        switch settings.authorizationStatus {
        case .authorized: return .granted
        case .denied: return .denied
        case .notDetermined, .provisional, .ephemeral: return .prompt
        @unknown default: return .unknown
        }
    }
    public func requestAuthorization() async throws -> Bool {
        guard isAvailable else { return false }
        return try await center.requestAuthorization(options: [.alert, .sound])
    }
    public func schedule(_ request: NativeTrialReminderRequest) async throws -> Bool {
        guard isAvailable, request.at.isFinite, !request.id.isEmpty, request.id.count <= 64,
              !request.title.isEmpty, !request.body.isEmpty else { return false }
        let when = Date(timeIntervalSince1970: request.at / 1_000)
        let ahead = when.timeIntervalSinceNow
        guard ahead > 60, ahead < 400 * 86_400 else { return false }
        let settings = await center.notificationSettings()
        guard settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional else { return false }
        let content = UNMutableNotificationContent()
        content.title = String(request.title.prefix(80)); content.body = String(request.body.prefix(200)); content.sound = .default
        var parts = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: when)
        parts.timeZone = .current
        try await center.add(UNNotificationRequest(identifier: request.id, content: content,
            trigger: UNCalendarNotificationTrigger(dateMatching: parts, repeats: false)))
        return true
    }
    public func cancel(id: String) async throws {
        guard isAvailable, !id.isEmpty else { return }
        center.removePendingNotificationRequests(withIdentifiers: [id])
    }
    public nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter,
        willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        notification.request.identifier.hasPrefix("sona-") ? [.banner, .list] : []
    }
    public nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse) async {
        guard response.actionIdentifier == UNNotificationDefaultActionIdentifier else { return }
        let event = NativeReminderOpen(id: response.notification.request.identifier, deliveredAt: response.notification.date)
        _ = await MainActor.run { NativeReminderTapRouter.shared.receive(event) }
    }
}
#endif

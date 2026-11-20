import Foundation
import Security
import SonaFamilyAccess
import SwiftUI

struct FamilyLibraryAccess {
    private static let policy = (try? FamilyAccessConfiguration.bundled()).map(FamilyAccessPolicy.init)
    private let state: FamilyEntitlementState
    private let now = Date()

    init(link: FamilyLink?) {
        var state = FamilyEntitlementState()
        if let link {
            state.verifiedClinician = true
            if let checkedAt = link.coverageCheckedAt {
                state.apply(.confirmed(active: link.covered), source: .clinician, at: checkedAt)
            }
        }
        self.state = state
    }

    var allowsStory: Bool {
        Self.policy?.story(state, at: now) ?? false
    }

    func allows(_ game: NativeGame) -> Bool {
        let shippingID = game == .sprint ? "run" : game.rawValue
        return Self.policy?.game(shippingID, state: state, canSellHere: false, at: now).allowed ?? false
    }

    func allowsBook(named title: String) -> Bool {
        Self.policy?.book(title, state: state, canSellHere: false, at: now) ?? false
    }
}

@MainActor
final class FamilyConnectionStore: ObservableObject {
    private struct SavedConnection: Codable {
        var link: FamilyLink
        var needsSharingChoice: Bool
        var homework: FamilyHomework?
    }

    @Published private var saved: SavedConnection?
    private let client: FamilyLoginClient
    private let childID: String
    private var checkingCoverage = false
    private var homeworkSync: Date?

    var link: FamilyLink? { saved?.link }
    var needsSharingChoice: Bool { saved?.needsSharingChoice ?? false }

    func assignedHomework(on date: Date) -> FamilyHomework? {
        guard let saved, saved.link.consentAt != nil, !saved.needsSharingChoice,
              let assignment = saved.homework, assignment.isCurrent(on: date) else { return nil }
        return assignment
    }

    var libraryAccess: FamilyLibraryAccess {
        FamilyLibraryAccess(link: link)
    }

    init(client: FamilyLoginClient = FamilyLoginClient(), defaults: UserDefaults = .standard) {
        self.client = client
        let connection = (try? FamilyKeychain.read())
            .flatMap { try? JSONDecoder().decode(SavedConnection.self, from: $0) }

        let idKey = "sona.preview.family.childID"
        let id = connection?.link.childID ?? defaults.string(forKey: idKey) ?? UUID().uuidString.lowercased()
        defaults.set(id, forKey: idKey)
        childID = id
        saved = connection
    }

    func signIn(username: String, password: String) async throws {
        var fresh = try await client.login(username: username, password: password, childID: childID)
        if let previous = saved?.link, previous.code == fresh.code, previous.childID == fresh.childID {
            fresh.covered = previous.covered
            fresh.coverageCheckedAt = previous.coverageCheckedAt
            fresh.consentAt = previous.consentAt
        }
        // Only an authoritative coverage answer changes this grant. A temporary
        // outage must not erase an already verified grant for the same child.
        if let checked = try? await client.checkCoverage(fresh) { fresh = checked }
        let previousHomework = saved?.link.code == fresh.code && saved?.link.childID == fresh.childID
            ? saved?.homework : nil
        try save(SavedConnection(link: fresh, needsSharingChoice: true, homework: previousHomework))
    }

    func chooseSharing(_ share: Bool) async throws {
        guard let current = saved, current.needsSharingChoice else { return }
        let result = try await client.setSharing(
            current.link,
            consent: share ? .yes : .no,
            snapshot: share ? FamilyEnrollmentSnapshot() : nil
        )
        var updated = result.link
        if let newer = saved?.link, newer.code == updated.code {
            updated.covered = newer.covered
            updated.coverageCheckedAt = newer.coverageCheckedAt
            if newer.ticket != current.link.ticket { updated.ticket = newer.ticket }
        }
        try save(SavedConnection(link: updated, needsSharingChoice: false, homework: share ? current.homework : nil))
        if share { Task { await refreshHomework(force: true) } }
    }

    func changePassword(current: String, replacement: String) async throws {
        guard let link else { throw FamilyConnectionError.notSignedIn }
        try await client.changePassword(link, currentPassword: current, newPassword: replacement)
    }

    func stopSharing() async throws {
        guard let current = saved, current.link.consentAt != nil, !current.needsSharingChoice else { return }
        _ = try await client.setSharing(current.link, consent: .no)
        guard var latest = saved, latest.link.childID == current.link.childID,
              latest.link.code == current.link.code else { return }
        latest.link.consentAt = nil
        latest.homework = nil
        try save(latest)
    }

    func refreshHomework(force: Bool = false) async {
        guard let current = saved, !current.needsSharingChoice, let consent = current.link.consentAt else { return }
        let now = Date()
        guard force || homeworkSync.map({ now.timeIntervalSince($0) >= 3600 }) ?? true else { return }
        homeworkSync = now
        do {
            let assignment = try await client.fetchHomework(for: current.link)
            guard var latest = saved, latest.link.childID == current.link.childID,
                  latest.link.code == current.link.code, latest.link.ticket == current.link.ticket,
                  latest.link.consentAt == consent, !latest.needsSharingChoice else { return }
            latest.homework = assignment
            try save(latest)
        } catch {
            // Keep the current private assignment through transport failure.
        }
    }

    func refreshCoverage() async {
        guard !checkingCoverage, let current = saved?.link,
              current.coverageCheckedAt.map({ Date().timeIntervalSince($0) >= 6 * 60 * 60 }) ?? true
        else { return }
        checkingCoverage = true
        defer { checkingCoverage = false }
        guard let checked = try? await client.checkCoverage(current),
              var latest = saved, latest.link.code == current.code,
              latest.link.childID == current.childID, latest.link.ticket == current.ticket
        else { return }
        latest.link.covered = checked.covered
        latest.link.coverageCheckedAt = checked.coverageCheckedAt
        latest.link.ticket = checked.ticket
        try? save(latest)
    }

    private func save(_ value: SavedConnection) throws {
        try FamilyKeychain.write(JSONEncoder().encode(value))
        saved = value
    }
}

private enum FamilyConnectionError: LocalizedError {
    case notSignedIn
    case storage

    var errorDescription: String? {
        switch self {
        case .notSignedIn: return "Sign in with your family login first."
        case .storage: return "Sona couldn’t save the connection on this phone. Please try again."
        }
    }
}

private enum FamilyKeychain {
    private static var identity: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "com.speaksona.family.native-preview",
            kSecAttrAccount as String: "therapist-connection-v1",
            kSecAttrSynchronizable as String: false
        ]
    }

    static func read() throws -> Data? {
        var request = identity
        request[kSecReturnData as String] = true
        request[kSecMatchLimit as String] = kSecMatchLimitOne
        var value: CFTypeRef?
        let status = SecItemCopyMatching(request as CFDictionary, &value)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = value as? Data else {
            throw FamilyConnectionError.storage
        }
        return data
    }

    static func write(_ data: Data) throws {
        let attributes = [kSecValueData as String: data]
        let status = SecItemUpdate(identity as CFDictionary, attributes as CFDictionary)
        if status == errSecSuccess { return }
        guard status == errSecItemNotFound else { throw FamilyConnectionError.storage }
        var added = identity
        added[kSecValueData as String] = data
        added[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        guard SecItemAdd(added as CFDictionary, nil) == errSecSuccess else {
            throw FamilyConnectionError.storage
        }
    }
}

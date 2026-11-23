import Foundation
import Combine
import SonaFamilyMigration

public enum FamilyEmailRestoreError: Error, Equatable { case invalidEmail, unavailable, invalidResponse }

/// Only a confirmed endpoint answer returns Bool; a request failure throws.
public protocol FamilyEmailRestoreClient: Sendable {
    func subscriptionActive(email: String) async throws -> Bool
}

/// The existing family subscription endpoint, never a checkout, SDK identity
/// call or clinician endpoint. No URL, error body or address is logged.
public struct FamilyWebsiteSubscriptionClient: FamilyEmailRestoreClient {
    private let session: URLSession
    public init(session: URLSession) { self.session = session }
    public init() {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.urlCache = nil; configuration.httpCookieStorage = nil; configuration.urlCredentialStorage = nil
        configuration.timeoutIntervalForRequest = 15; configuration.timeoutIntervalForResource = 20
        session = URLSession(configuration: configuration)
    }

    static func request(email: String) throws -> URLRequest {
        guard let address = NativeFamilyWebsiteAccess.normalizedEmail(email) else { throw FamilyEmailRestoreError.invalidEmail }
        // URLQueryItem permits a literal '+', which this server's URLSearchParams
        // reads as a space. Match encodeURIComponent, including plus addresses.
        let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~")
        guard let escaped = address.addingPercentEncoding(withAllowedCharacters: allowed),
              let url = URL(string: "https://app.speaksona.com/api/subscription?email=" + escaped) else {
            throw FamilyEmailRestoreError.invalidEmail
        }
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 15)
        request.httpMethod = "GET"; request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpShouldHandleCookies = false
        return request
    }

    public func subscriptionActive(email: String) async throws -> Bool {
        let request = try Self.request(email: email)
        do {
            let (data, response) = try await session.data(for: request, delegate: WebsiteRestoreRedirectGuard())
            guard let response = response as? HTTPURLResponse, (200..<300).contains(response.statusCode), data.count <= 64_000,
                  let reply = try? JSONDecoder().decode(Reply.self, from: data), reply.ok, let active = reply.active else {
                throw FamilyEmailRestoreError.invalidResponse
            }
            return active
        } catch let error as FamilyEmailRestoreError { throw error }
        catch is CancellationError { throw CancellationError() }
        catch { throw FamilyEmailRestoreError.unavailable }
    }
    private struct Reply: Decodable { let ok: Bool; let active: Bool? }
}

private final class WebsiteRestoreRedirectGuard: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}

public enum FamilyEmailRestoreNotice: Equatable, Sendable {
    case restored, noSubscription, invalidEmail, unavailable, savePending, changed
    public var text: String {
        switch self {
        case .restored: return "Your website subscription is restored."
        case .noSubscription: return "No active subscription for that email."
        case .invalidEmail: return "Enter a valid email."
        case .unavailable: return "Couldn’t check right now. Check your connection and try again."
        case .savePending: return "Sona couldn’t save this access check on your device yet. Try saving again."
        case .changed: return "Your plan changed while this check was running. Please check again."
        }
    }
}

/// Construct only inside the existing Grown-ups presentation. Initialization
/// makes no request; preview bundles cannot restore even with an injected client.
@MainActor public final class FamilyEmailRestoreStore: ObservableObject {
    @Published public private(set) var busy = false
    @Published public private(set) var needsSaveRetry = false
    @Published public private(set) var notice: FamilyEmailRestoreNotice?
    public let origin: LegacyOrigin
    public let isAvailable: Bool
    public var canRestore: Bool { isAvailable && !busy && !needsSaveRetry }
    private let repository: NativeFamilyRepository?
    private let client: any FamilyEmailRestoreClient
    private let onChanged: @MainActor () async -> Void
    private var pending: Pending?
    private struct Pending {
        let active: Bool; let email: String; let checkedAt: Date
        let token: NativeFamilyWebsiteRestoreToken; let operationID: UUID
    }

    public convenience init(repository: NativeFamilyRepository?, origin: LegacyOrigin,
                            client: (any FamilyEmailRestoreClient)? = nil,
                            onChanged: @escaping @MainActor () async -> Void = {}) {
        self.init(repository: repository, origin: origin, client: client ?? FamilyWebsiteSubscriptionClient(),
                  actualBundleIdentifier: Bundle.main.bundleIdentifier, onChanged: onChanged)
    }
    init(repository: NativeFamilyRepository?, origin: LegacyOrigin, client: any FamilyEmailRestoreClient,
         actualBundleIdentifier: String?, onChanged: @escaping @MainActor () async -> Void = {}) {
        self.repository = repository; self.origin = origin; self.client = client; self.onChanged = onChanged
        isAvailable = actualBundleIdentifier == "com.speaksona.app" && repository != nil
    }

    public func restore(email: String) async {
        guard canRestore, let repository else { return }
        guard let address = NativeFamilyWebsiteAccess.normalizedEmail(email) else { notice = .invalidEmail; return }
        busy = true; notice = nil
        defer { busy = false }
        do {
            let token = try await repository.websiteRestoreToken(for: origin)
            try Task.checkCancellation()
            let active = try await client.subscriptionActive(email: address)
            try Task.checkCancellation()
            let answer = Pending(active: active, email: address, checkedAt: Date(), token: token, operationID: UUID())
            pending = answer
            await save(answer)
        } catch { notice = .unavailable }
    }

    public func retrySave() async {
        guard isAvailable, !busy, let pending else { return }
        busy = true; defer { busy = false }
        await save(pending)
    }
    private func save(_ answer: Pending) async {
        guard let repository else { return }
        do {
            let result = try await repository.recordWebsiteRestore(active: answer.active, email: answer.email,
                checkedAt: answer.checkedAt, origin: origin, expected: answer.token, operationID: answer.operationID)
            pending = nil; needsSaveRetry = false
            switch result {
            case .recorded(let saved): notice = saved.active ? .restored : .noSubscription
            case .noMatchingSubscription: notice = .noSubscription
            case .superseded: notice = .changed
            }
            await onChanged()
        } catch { needsSaveRetry = true; notice = .savePending }
    }
}

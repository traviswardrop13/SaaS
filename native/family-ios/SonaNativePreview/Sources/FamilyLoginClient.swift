import Foundation

/// Store this verified link in Keychain. Passwords never belong in this value.
/// covered is only this clinician's grant; it must not replace purchased or
/// grandfathered access. A nil coverageCheckedAt means no authoritative answer yet.
struct FamilyLink: Codable, Equatable, Sendable {
    var user: String
    var clinician: String
    var code: String
    var ticket: String
    var invite: String
    var childID: String
    var covered: Bool
    var coverageCheckedAt: Date?
    var consentAt: Date?
}

enum FamilySharingConsent: Sendable { case yes, no }

enum FamilyInviteStatus: String, Codable, Sendable {
    case notApplicable, claimed, expired, used, retryNeeded
}

struct FamilySharingResult: Equatable, Sendable {
    var link: FamilyLink
    var shared: Bool
    var inviteStatus: FamilyInviteStatus
}

/// The existing server stores complete per-sound outcome objects. Keeping their
/// JSON shape prevents a native migration from throwing older fields away.
enum FamilyJSONValue: Codable, Equatable, Sendable {
    case string(String), number(Double), bool(Bool)
    case object([String: FamilyJSONValue]), array([FamilyJSONValue]), null

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let v = try? c.decode(Bool.self) { self = .bool(v) }
        else if let v = try? c.decode(String.self) { self = .string(v) }
        else if let v = try? c.decode(Double.self) { self = .number(v) }
        else if let v = try? c.decode([String: FamilyJSONValue].self) { self = .object(v) }
        else { self = .array(try c.decode([FamilyJSONValue].self)) }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .string(let v): try c.encode(v)
        case .number(let v): try c.encode(v)
        case .bool(let v): try c.encode(v)
        case .object(let v): try c.encode(v)
        case .array(let v): try c.encode(v)
        case .null: try c.encodeNil()
        }
    }
}

/// Only pass real local state. An empty snapshot is appropriate for a freshly
/// generated child ID, never for overwriting an existing child's practice row.
/// Finished free-play games are not speech sessions, attempts or outcomes.
struct FamilyEnrollmentSnapshot: Equatable, Sendable {
    var childName: String
    var age: String
    var focusSounds: [String]
    var dailyGoal: Int?
    var outcomes: [String: FamilyJSONValue]
    var sessions: Int
    var streak: Int

    init(childName: String = "", age: String = "", focusSounds: [String] = [],
         dailyGoal: Int? = nil, outcomes: [String: FamilyJSONValue] = [:],
         sessions: Int = 0, streak: Int = 0) {
        self.childName = childName
        self.age = age
        self.focusSounds = focusSounds
        self.dailyGoal = dailyGoal
        self.outcomes = outcomes
        self.sessions = sessions
        self.streak = streak
    }
}

enum FamilyClientError: Error, Codable, Equatable, LocalizedError {
    case invalidCredentials
    case invalidInput(String)
    case server(status: Int, message: String)
    case malformedResponse
    case connection
    case snapshotRequired

    var errorDescription: String? {
        switch self {
        case .invalidCredentials: return "That username and password don’t match. Check them with your speech therapist."
        case .invalidInput(let message): return message
        case .server(_, let message): return message
        case .malformedResponse: return "Sona couldn’t confirm that response. Please try again."
        case .connection: return "Couldn’t reach Sona. Check your connection and try again."
        case .snapshotRequired: return "Your local progress is needed before sharing can start."
        }
    }
}

/// The production origin is fixed. No endpoint accepts a URL from a link,
/// credentials are never logged, and redirects are refused before forwarding.
struct FamilyLoginClient {
    private let session: URLSession
    private static let origin = URL(string: "https://app.speaksona.com")!

    init(session: URLSession = .shared) { self.session = session }

    /// Login and coverage are separate so a temporary coverage failure does
    /// not discard the successfully verified ticket. Persist first, then refresh.
    func login(username: String, password: String, childID: String) async throws -> FamilyLink {
        try validateChildID(childID)
        guard !username.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, !password.isEmpty else {
            throw FamilyClientError.invalidInput("Type your username and password.")
        }
        let reply = try await post("/api/family/login", body: LoginRequest(username: username, password: password, childId: childID))
        guard reply.valid == true else { throw FamilyClientError.invalidCredentials }
        guard let user = reply.user, !user.isEmpty,
              let code = reply.code, !code.isEmpty,
              let ticket = reply.ticket, !ticket.isEmpty, ticket.count < 4096 else {
            throw FamilyClientError.malformedResponse
        }
        return FamilyLink(user: user, clinician: reply.name ?? "", code: code.uppercased(),
                          ticket: ticket, invite: reply.inv ?? "", childID: childID,
                          covered: false, coverageCheckedAt: nil, consentAt: nil)
    }

    /// Errors leave the caller's previously verified coverage untouched.
    /// covered:false revokes only the clinician's grant, not other entitlements.
    func checkCoverage(_ link: FamilyLink) async throws -> FamilyLink {
        let reply = try await post("/api/slp/covered", body: CoverageRequest(code: link.code, ticket: link.ticket))
        guard let covered = reply.covered else { throw FamilyClientError.malformedResponse }
        var updated = link
        updated.covered = covered
        updated.coverageCheckedAt = Date()
        if let ticket = reply.ticket, !ticket.isEmpty, ticket.count < 4096 { updated.ticket = ticket }
        return updated
    }

    func changePassword(_ link: FamilyLink, currentPassword: String, newPassword: String) async throws {
        guard !currentPassword.isEmpty else { throw FamilyClientError.invalidInput("Enter your current password.") }
        // JavaScript's length is UTF-16 code units, not Swift grapheme count.
        guard newPassword.utf16.count >= 8 else { throw FamilyClientError.invalidInput("Use at least 8 characters.") }
        guard newPassword.utf16.count <= 64 else { throw FamilyClientError.invalidInput("Use at most 64 characters.") }
        _ = try await post("/api/family/password", body: PasswordRequest(username: link.user, password: currentPassword, newPassword: newPassword))
    }

    /// Call only after the parent explicitly answers the existing consent
    /// question. Declining neither enrolls nor claims an invite. Withdrawing
    /// existing sharing waits for deletion, then clears consent; access remains.
    func setSharing(_ link: FamilyLink, consent: FamilySharingConsent,
                    snapshot: FamilyEnrollmentSnapshot? = nil) async throws -> FamilySharingResult {
        try validateChildID(link.childID)
        switch consent {
        case .no:
            if link.consentAt != nil {
                _ = try await post("/api/pilot/forget", body: ChildRequest(code: link.code, ticket: link.ticket, childId: link.childID))
            }
            var updated = link
            updated.consentAt = nil
            return FamilySharingResult(link: updated, shared: false, inviteStatus: .notApplicable)

        case .yes:
            guard let snapshot else { throw FamilyClientError.snapshotRequired }
            var updated = link
            let consentDate = link.consentAt ?? Date()
            // Claim first: a fresh invite lifts an older "gone" mark. The
            // following roster write must not disappear behind that mark.
            let claimStatus: FamilyInviteStatus
            if link.invite.isEmpty {
                claimStatus = .notApplicable
            } else {
                do {
                    let claim = try await post("/api/slp/claim", body: ClaimRequest(code: link.code, ticket: link.ticket, childId: link.childID, inv: link.invite))
                    if claim.claimed == true { claimStatus = .claimed; updated.invite = "" }
                    else if claim.reason == "expired" { claimStatus = .expired; updated.invite = "" }
                    else if claim.reason == "used" { claimStatus = .used; updated.invite = "" }
                    else { claimStatus = .retryNeeded }
                } catch is CancellationError {
                    throw CancellationError()
                } catch {
                    claimStatus = .retryNeeded
                }
            }
            let now = Date()
            let payload = EnrollmentRequest(
                source: "pilot-enroll", code: link.code, ticket: link.ticket, childId: link.childID,
                child: String(snapshot.childName.prefix(60)), age: snapshot.age,
                focus: snapshot.focusSounds.joined(separator: ", "),
                goal: snapshot.dailyGoal.map { FamilyJSONValue.number(Double($0)) } ?? .string(""),
                outcomes: snapshot.outcomes, sessions: snapshot.sessions, streak: snapshot.streak,
                consentAt: isoString(consentDate), at: isoString(now))
            _ = try await post("/api/pilot", body: payload)
            updated.consentAt = consentDate
            return FamilySharingResult(link: updated, shared: true, inviteStatus: claimStatus)
        }
    }

    private func validateChildID(_ id: String) throws {
        // /api/pilot truncates at 48, so never mint a longer ticket binding.
        let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-")
        guard !id.isEmpty, id.count <= 48, id.unicodeScalars.allSatisfy({ allowed.contains($0) }) else {
            throw FamilyClientError.invalidInput("This device needs its own Sona child ID before connecting.")
        }
    }

    private func isoString(_ date: Date) -> String {
        let format = ISO8601DateFormatter()
        format.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return format.string(from: date)
    }

    private func post<Body: Encodable>(_ path: String, body: Body) async throws -> Reply {
        var request = URLRequest(url: Self.origin.appendingPathComponent(path))
        request.httpMethod = "POST"
        request.timeoutInterval = 20
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.httpShouldHandleCookies = false
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue(Self.origin.absoluteString, forHTTPHeaderField: "Origin")
        do { request.httpBody = try JSONEncoder().encode(body) }
        catch { throw FamilyClientError.invalidInput("Sona couldn’t prepare that request.") }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request, delegate: FamilyRedirectGuard())
        } catch is CancellationError {
            throw CancellationError()
        } catch let error as URLError where error.code == .cancelled {
            throw CancellationError()
        } catch { throw FamilyClientError.connection }
        guard let http = response as? HTTPURLResponse,
              http.url?.scheme == "https", http.url?.host == Self.origin.host else {
            throw FamilyClientError.malformedResponse
        }
        guard (200..<300).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode(Reply.self, from: data))?.error
            throw FamilyClientError.server(status: http.statusCode,
                message: message?.isEmpty == false ? message! : "Sona couldn’t finish that request. Please try again.")
        }
        guard let reply = try? JSONDecoder().decode(Reply.self, from: data), reply.ok == true else {
            if let error = (try? JSONDecoder().decode(Reply.self, from: data))?.error, !error.isEmpty {
                throw FamilyClientError.server(status: http.statusCode, message: error)
            }
            throw FamilyClientError.malformedResponse
        }
        return reply
    }

    private struct LoginRequest: Encodable { let username, password, childId: String }
    private struct CoverageRequest: Encodable { let code, ticket: String }
    private struct PasswordRequest: Encodable { let username, password, newPassword: String }
    private struct ChildRequest: Encodable { let code, ticket, childId: String }
    private struct ClaimRequest: Encodable { let code, ticket, childId, inv: String }
    private struct EnrollmentRequest: Encodable {
        let source, code, ticket, childId, child, age, focus: String
        let goal: FamilyJSONValue
        let outcomes: [String: FamilyJSONValue]
        let sessions, streak: Int
        let consentAt, at: String
    }
    private struct Reply: Decodable {
        let ok: Bool?
        let valid: Bool?
        let user, code, name, ticket, inv: String?
        let covered, claimed: Bool?
        let reason, error: String?
    }
}

private final class FamilyRedirectGuard: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask,
                    willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest,
                    completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}

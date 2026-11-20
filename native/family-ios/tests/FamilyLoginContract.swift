import Foundation

final class StubProtocol: URLProtocol {
    static var handler: ((URLRequest) throws -> (Int, String))!
    static var requests: [URLRequest] = []
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        Self.requests.append(request)
        do {
            let (status, body) = try Self.handler(request)
            let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil,
                                           headerFields: ["Content-Type": "application/json"])!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: Data(body.utf8))
            client?.urlProtocolDidFinishLoading(self)
        } catch { client?.urlProtocol(self, didFailWithError: error) }
    }
    override func stopLoading() {}
}

@main struct ClientContractProof {
    static var assertions = 0
    static func check(_ yes: Bool, _ label: String) {
        assertions += 1
        guard yes else { fatalError("FAIL: \(label)") }
    }
    static func json(_ request: URLRequest) throws -> [String: Any] {
        if let body = request.httpBody { return try JSONSerialization.jsonObject(with: body) as! [String: Any] }
        guard let stream = request.httpBodyStream else { return [:] }
        stream.open(); defer { stream.close() }
        var body = Data(); let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: 4096)
        defer { buffer.deallocate() }
        while stream.hasBytesAvailable { let n = stream.read(buffer, maxLength: 4096); if n <= 0 { break }; body.append(buffer, count: n) }
        return try JSONSerialization.jsonObject(with: body) as! [String: Any]
    }
    static func main() async throws {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubProtocol.self]
        let session = URLSession(configuration: configuration)
        let client = FamilyLoginClient(session: session)
        defer { session.invalidateAndCancel() }
        StubProtocol.handler = { request in
            check(request.url?.absoluteString == "https://app.speaksona.com/api/family/login", "fixed production login URL")
            check(request.httpMethod == "POST", "POST contract")
            let body = try json(request)
            check(body["childId"] as? String == "native-child-123", "device child ID is sent")
            check(body["password"] as? String == "Loose-Pass", "password sent without changing it")
            return (200, #"{"ok":true,"valid":true,"user":"otter1234","code":"CLINIC-1","name":"Test Clinic","ticket":"signed-ticket","inv":"ABCDEFGHIJKL"}"#)
        }
        let link = try await client.login(username: "otter1234", password: "Loose-Pass", childID: "native-child-123")
        check(link.user == "otter1234" && link.clinician == "Test Clinic", "verified link decoded")
        check(!link.covered && link.coverageCheckedAt == nil && link.consentAt == nil, "login implies neither Premium nor sharing")
        let stored = String(data: try JSONEncoder().encode(link), encoding: .utf8)!
        check(!stored.contains("Loose-Pass") && !stored.contains("password"), "Keychain record has no password")
        StubProtocol.handler = { request in
            check(request.url?.path == "/api/slp/covered", "coverage separate endpoint")
            let body = try json(request)
            check(body["ticket"] as? String == "signed-ticket", "coverage shows verified ticket")
            return (200, #"{"ok":true,"covered":true,"ticket":"renewed-ticket"}"#)
        }
        let covered = try await client.checkCoverage(link)
        check(covered.covered && covered.ticket == "renewed-ticket" && covered.coverageCheckedAt != nil, "authoritative grant and ticket renewal")
        StubProtocol.handler = { _ in (503, #"{"ok":false,"error":"Couldn't check right now."}"#) }
        do { _ = try await client.checkCoverage(covered); fatalError("coverage failure accepted") }
        catch let error as FamilyClientError { check(error == .server(status: 503, message: "Couldn't check right now."), "503 is explicit without mutating prior link") }
        check(covered.covered && covered.ticket == "renewed-ticket", "failed refresh retains caller's verified access")
        StubProtocol.handler = { _ in (200, #"{"ok":true,"covered":"yes"}"#) }
        do { _ = try await client.checkCoverage(link); fatalError("malformed coverage accepted") }
        catch { check(error as? FamilyClientError == .malformedResponse, "truthy strings never grant access") }
        StubProtocol.handler = { _ in (200, #"{"ok":true,"valid":false}"#) }
        do { _ = try await client.login(username: "unknown", password: "wrongpass", childID: "native-child-123"); fatalError("wrong login accepted") }
        catch { check(error as? FamilyClientError == .invalidCredentials, "wrong credentials rejected") }
        StubProtocol.handler = { _ in (429, #"{"ok":false,"error":"Wait an hour."}"#) }
        do { _ = try await client.login(username: "unknown", password: "wrongpass", childID: "native-child-123"); fatalError("rate limit accepted") }
        catch { check(error as? FamilyClientError == .server(status: 429, message: "Wait an hour."), "rate limit error preserved") }
        StubProtocol.requests = []
        let declined = try await client.setSharing(covered, consent: .no)
        check(StubProtocol.requests.isEmpty && !declined.shared && declined.link.covered && declined.link.invite == covered.invite, "No has no enrollment, claim, or access loss")
        do { _ = try await client.setSharing(covered, consent: .yes); fatalError("missing snapshot accepted") }
        catch { check(error as? FamilyClientError == .snapshotRequired && StubProtocol.requests.isEmpty, "Yes cannot invent missing local progress") }
        var sequence: [String] = []
        StubProtocol.handler = { request in
            sequence.append(request.url!.path)
            let body = try json(request)
            if request.url!.path == "/api/slp/claim" {
                check(body["inv"] as? String == link.invite && body["childId"] as? String == link.childID, "claim uses this device and invite")
                check(body["child"] == nil && body["age"] == nil && body["password"] == nil, "claim sends no personal fields")
                return (200, #"{"ok":true,"claimed":true}"#)
            }
            check(body["source"] as? String == "pilot-enroll", "enrollment source")
            check(body["consentAt"] is String && body["ticket"] as? String == covered.ticket, "enrollment carries recorded consent and proof")
            check(body["child"] as? String == "" && body["age"] as? String == "", "fresh child sends no invented name or age")
            check((body["outcomes"] as? [String:Any])?.isEmpty == true && body["sessions"] as? Int == 0, "free play adds no speech outcomes or sessions")
            return (200, #"{"ok":true,"captured":false}"#)
        }
        let shared = try await client.setSharing(covered, consent: .yes, snapshot: FamilyEnrollmentSnapshot())
        check(sequence == ["/api/slp/claim", "/api/pilot"], "explicit Yes claims before enrolling to lift old gone mark")
        check(shared.shared && shared.link.consentAt != nil && shared.link.invite.isEmpty && shared.inviteStatus == .claimed, "confirmed consent and claimed invite returned")
        StubProtocol.requests = []
        let unsharedHomework = try await client.fetchHomework(for: covered)
        check(unsharedHomework == nil && StubProtocol.requests.isEmpty, "no homework call before consent")
        StubProtocol.handler = { request in
            check(request.url?.path == "/api/homework", "homework uses the family endpoint")
            let body = try json(request)
            check(Set(body.keys) == ["code", "ticket", "childId"], "preview sends only the connection proof")
            check(body["childId"] as? String == covered.childID && body["ticket"] as? String == covered.ticket,
                  "homework preserves the verified child and ticket")
            return (200, #"{"ok":true,"hw":{"id":"fixture-homework","title":"S practice","note":"","sounds":["S"],"pos":"f","repsPerDay":20,"words":["mouse"],"start":"2026-11-19","due":"2026-11-19","by":"Test Clinic"}}"#)
        }
        let assignment = try await client.fetchHomework(for: shared.link)
        check(assignment?.sounds == ["S"] && assignment?.pos == "f" && assignment?.repsPerDay == 20
              && assignment?.words == ["mouse"], "homework preserves sound, position, goal, and authored words")
        let day = ISO8601DateFormatter().date(from: "2026-11-19T00:30:00Z")!
        var timezone = Calendar(identifier: .gregorian)
        timezone.timeZone = TimeZone(secondsFromGMT: 0)!
        check(assignment?.isCurrent(on: day, calendar: timezone) == true, "assignment due date is inclusive")
        timezone.timeZone = TimeZone(secondsFromGMT: -7 * 3600)!
        check(assignment?.isCurrent(on: day, calendar: timezone) == false, "assignment uses the phone's local date")
        StubProtocol.handler = { request in
            check(request.url?.path == "/api/pilot/forget", "withdrawal deletes through existing route")
            return (200, #"{"ok":true,"forgotten":true}"#)
        }
        let stopped = try await client.setSharing(shared.link, consent: .no)
        check(stopped.link.consentAt == nil && stopped.link.covered && !stopped.shared, "withdrawal clears sharing and keeps access")
        StubProtocol.handler = { request in
            if request.url?.path == "/api/slp/claim" { return (503, #"{"ok":false,"error":"try later"}"#) }
            return (200, #"{"ok":true}"#)
        }
        let pending = try await client.setSharing(covered, consent: .yes, snapshot: FamilyEnrollmentSnapshot())
        check(pending.inviteStatus == .retryNeeded && pending.link.invite == covered.invite && pending.shared, "failed optional claim retains retry token")
        StubProtocol.handler = { request in
            check(request.url?.path == "/api/family/password", "password change endpoint")
            let body = try json(request)
            check(body["username"] as? String == link.user && body["password"] as? String == "old pass" && body["newPassword"] as? String == "New Exact Password", "password change exact body and no trimming")
            return (200, #"{"ok":true}"#)
        }
        try await client.changePassword(link, currentPassword: "old pass", newPassword: "New Exact Password")
        let calls = StubProtocol.requests.count
        do { try await client.changePassword(link, currentPassword: "old pass", newPassword: "short"); fatalError("short password accepted") }
        catch { check(StubProtocol.requests.count == calls, "invalid password stopped locally") }
        do { _ = try await client.login(username: "u", password: "p", childID: ""); fatalError("unbound child ID accepted") }
        catch { check(StubProtocol.requests.count == calls, "empty child ID never mints an unbound ticket") }
        StubProtocol.handler = { request in
            check(request.url?.path == "/api/family/feedback", "support uses the family feedback route")
            let body = try json(request)
            check(Set(body.keys) == ["kind", "app", "from", "website", "chips", "text", "email"],
                  "support sends no child details, reports, account identifiers or audio")
            check(body["from"] as? String == "family" && body["app"] as? String == "ios", "support identifies the app")
            check(body["text"] as? String == "A fictional note" && body["email"] as? String == "",
                  "support sends the parent’s note and optional reply")
            return (200, #"{"ok":true}"#)
        }
        try await client.sendFamilyFeedback(chips: ["More games"], text: " A fictional note ", email: "")
        let feedbackCalls = StubProtocol.requests.count
        do { try await client.sendFamilyFeedback(chips: [], text: " ", email: ""); fatalError("blank feedback accepted") }
        catch { check(StubProtocol.requests.count == feedbackCalls, "empty feedback makes no request") }
        print("PASS: \(assertions) mock-only native family client assertions; zero live requests")
    }
}

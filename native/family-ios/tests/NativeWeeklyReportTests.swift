import Foundation
import XCTest
@testable import ReportHost
@testable import SonaFamilyMigration
import SonaFamilyRules

private enum FixtureFailure: Error { case offline, commit }
private final class ReportMemory: NativeFamilyDocumentStore, @unchecked Sendable {
    var value: NativeFamilyDocument?
    var commits = 0
    var reject = false
    func read() throws -> NativeFamilyDocument? { value }
    func commit(_ next: NativeFamilyDocument) throws {
        if reject { throw FixtureFailure.commit }
        commits += 1; value = next
    }
}
@MainActor private final class ReportMock: NativeFamilyReportTransport {
    var requests: [NativeFamilyReportRequest] = []
    var signups: [NativeFamilyReportRequest] = []
    var offline = false, hold = false
    var signupOffline = false, holdSignup = false
    var waiting: CheckedContinuation<Data, Error>?
    var signupWaiting: CheckedContinuation<Data, Error>?
    var response = Data(#"{"ok":true}"#.utf8)
    func send(_ request: NativeFamilyReportRequest) async throws -> Data {
        if request.url.path == "/api/lead" {
            signups.append(request)
            if signupOffline { throw FixtureFailure.offline }
            if holdSignup { return try await withCheckedThrowingContinuation { signupWaiting = $0 } }
            return Data(#"{"ok":true,"captured":true}"#.utf8)
        }
        requests.append(request)
        if offline { throw FixtureFailure.offline }
        if hold { return try await withCheckedThrowingContinuation { waiting = $0 } }
        return response
    }
}

/// Intercept every request so these tests cannot reach the live endpoint.
private final class ReportURLFixture: URLProtocol {
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        XCTAssertEqual(request.url?.absoluteString, "https://app.speaksona.com/api/report")
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Origin"), "https://app.speaksona.com")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Content-Type"), "application/json")
        XCTAssertNil(request.value(forHTTPHeaderField: "Cookie"))
        XCTAssertNil(request.value(forHTTPHeaderField: "Authorization"))
        XCTAssertFalse(request.httpShouldHandleCookies)
        guard let url = request.url,
              let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1",
                  headerFields: ["Content-Type":"application/json", "Set-Cookie":"fictional=fixture; Secure"])
        else { client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse)); return }
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(#"{"ok":true,"pending":true}"#.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}

@MainActor final class NativeWeeklyReportTests: XCTestCase {
    private let date = ISO8601DateFormatter().date(from: "2026-11-19T12:00:00Z")!
    private let dev = "0123456789abcdef0123456789abcdef"
    private func archive(consent: String = "true", changes: [String: String] = [:]) throws -> MigrationArchive {
        var storage = ["sona.freeera.v1":"post","sona.freeera2.v1":"done","sona.freeera3.v1":"done","sona.freeera4.v1":"done","sona.freeera5.v1":"done",
            "sona.profile.v1": "{\"childName\":\"Private name\",\"childAge\":\"6\",\"onboarded\":true,\"focusSounds\":[\"R\"],\"weeklyReport\":\(consent),\"email\":\"synthetic@example.invalid\",\"reportId\":\"0123456789abcdef\"}",
            "sona.profile.v1@k2": #"{"childName":"Private sibling","onboarded":true,"focusSounds":["S"],"reportId":"fedcba9876543210","weeklyGoal":5}"#,
            "sona.kids.v1": #"{"list":[{"slot":""},{"slot":"k2"}],"active":"k2","hi":2}"#,
            "sona.report.v1": "{\"dev\":\"\(dev)\",\"onFor\":\"synthetic@example.invalid\"}",
            "sona.outcomes.v1": #"{"R":{"days":{"2026-11-17":{"tries":3}}}}"#,
            "sona.gamereps.v1": #"{"2026-11-18":{"S":2}}"#,
            "sona.outcomes.v1@k2": #"{"S":{"days":{"2026-11-17":{"tries":4}}}}"#]
        storage.merge(changes) { _, next in next }
        var archive = MigrationArchive()
        for origin in LegacyOrigin.allCases {
            archive.origins[origin.rawValue] = try SnapshotImporter.prepare(LegacySnapshot(origin: origin, storage: origin == .app ? storage : [:]))
        }
        return archive
    }
    private func setup(consent: String = "true", changes: [String: String] = [:]) async throws -> (ReportMemory, NativeFamilyRepository) {
        let memory = ReportMemory()
        let repository = NativeFamilyRepository(store: memory)
        _ = try await repository.seed(from: archive(consent: consent, changes: changes), primaryOrigin: .app)
        return (memory, repository)
    }
    private func store(_ repo: NativeFamilyRepository, _ mock: ReportMock?, at date: Date? = nil) async -> NativeFamilyReportStore {
        let date = date ?? self.date
        let store = NativeFamilyReportStore(repository: repo, transport: mock, now: { date })
        await store.bind(origin: .app)
        return store
    }
    private func body(_ request: NativeFamilyReportRequest) throws -> [String: Any] {
        XCTAssertEqual(request.url.absoluteString, "https://app.speaksona.com/api/report")
        XCTAssertEqual(request.origin, "https://app.speaksona.com")
        return try XCTUnwrap(JSONSerialization.jsonObject(with: request.body) as? [String: Any])
    }
    private func waitFor(_ condition: @escaping () -> Bool) async throws {
        for _ in 0..<1_000 { if condition() { return }; try await Task.sleep(nanoseconds: 1_000_000) }
        XCTFail("synthetic report boundary was not reached")
    }

    func testDisconnectedDefaultAndHomeReadsMakeNoChanges() async throws {
        let (memory, repo) = try await setup(), before = memory.value, commits = memory.commits
        let store = await store(repo, nil)
        await store.refresh()
        let sent = await store.sync(trigger: .settings)
        XCTAssertFalse(sent); XCTAssertEqual(memory.value, before); XCTAssertEqual(memory.commits, commits)
        XCTAssertTrue(store.status?.on == true)
        let mock = ReportMock(), connectedFixture = await self.store(repo, mock)
        let background = await connectedFixture.sync(trigger: .background)
        XCTAssertFalse(background); XCTAssertTrue(mock.requests.isEmpty)
    }
    func testCanonicalCompleteHouseholdAndThrottleArePersisted() async throws {
        let (_, repo) = try await setup(), mock = ReportMock(), store = await store(repo, mock)
        let sent = await store.sync(trigger: .countedRep)
        XCTAssertTrue(sent); XCTAssertEqual(mock.requests.count, 1)
        let data = try body(mock.requests[0])
        XCTAssertEqual(data["dev"] as? String, dev); XCTAssertNil(data["on"])
        let weeks = try XCTUnwrap(data["weeks"] as? [[String: Any]])
        let current = try XCTUnwrap(weeks.last?["kids"] as? [[String: Any]])
        XCTAssertEqual(current.map { $0["r"] as? Int }, [5, 4])
        XCTAssertEqual(current.map { $0["p"] as? Int }, [3, 4])
        XCTAssertEqual(current[0]["i"] as? String, "0123456789abcdef")
        XCTAssertNil(current[0]["gw"]); XCTAssertEqual(current[1]["gw"] as? Int, 5)
        XCTAssertFalse(String(decoding: mock.requests[0].body, as: UTF8.self).contains("Private"))
        let again = await store.sync(trigger: .countedRep)
        XCTAssertFalse(again); XCTAssertEqual(mock.requests.count, 1)
        let background = await store.sync(trigger: .background)
        XCTAssertTrue(background); XCTAssertEqual(mock.requests.count, 2)
        let restarted = await self.store(repo, mock), restart = await restarted.sync(trigger: .countedRep)
        XCTAssertFalse(restart); XCTAssertEqual(mock.requests.count, 2)
    }
    func testTruthyAndAbsentConsentCannotSend() async throws {
        for consent in ["false", "1", "null"] {
            let (memory, repo) = try await setup(consent: consent), mock = ReportMock(), store = await store(repo, mock)
            let commits = memory.commits
            let result = await store.sync(trigger: .settings)
            XCTAssertFalse(result); XCTAssertTrue(mock.requests.isEmpty)
            XCTAssertEqual(memory.commits, commits)
        }
    }
    func testAuthorizedTransportReachesOnlyTheExactEndpointWithoutCookies() async throws {
        let (_, repo) = try await setup()
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [ReportURLFixture.self]
        let transport = NativeFamilyReportHTTPTransport(configuration: config), date = date
        let store = NativeFamilyReportStore(repository: repo, transport: transport, now: { date })
        await store.bind(origin: .app)
        let sent = await store.sync(trigger: .countedRep, for: .app)
        XCTAssertTrue(sent)
        XCTAssertTrue(store.status?.pending == true)
        let second = try await transport.send(.init(body: Data("{}".utf8)))
        XCTAssertEqual(second, Data(#"{"ok":true,"pending":true}"#.utf8))

        let source = NativeFamilyReportRequest(body: Data()).url
        let destination = try XCTUnwrap(URL(string: "https://fictional.example.invalid/redirect"))
        let response = try XCTUnwrap(HTTPURLResponse(url: source, statusCode: 307, httpVersion: nil,
                                                     headerFields: ["Location": destination.absoluteString]))
        let task = URLSession.shared.dataTask(with: source)
        let redirect = expectation(description: "Packet cannot be sent to a redirect")
        NativeFamilyReportRedirectGuard().urlSession(.shared, task: task, willPerformHTTPRedirection: response,
                                                       newRequest: URLRequest(url: destination)) { next in
            XCTAssertNil(next)
            redirect.fulfill()
        }
        await fulfillment(of: [redirect])
    }

    func testPageExitWaitsForAndFlushesRepsAfterAnInFlightSnapshot() async throws {
        let (memory, repo) = try await setup(), mock = ReportMock(), store = await store(repo, mock)
        let wrongOrigin = await store.sync(trigger: .countedRep, for: .www)
        XCTAssertFalse(wrongOrigin); XCTAssertTrue(mock.requests.isEmpty)
        mock.hold = true
        let first = Task { await store.sync(trigger: .countedRep, for: .app) }
        try await waitFor { mock.waiting != nil }
        var updated = try XCTUnwrap(memory.value)
        updated.origins[LegacyOrigin.app.rawValue]?.storage["sona.gamereps.v1"] = #"{"2026-11-18":{"S":3}}"#
        memory.value = updated
        let later = Task { await store.sync(trigger: .countedRep, for: .app) }
        await Task.yield()
        let leaving = Task { await store.sync(trigger: .background) }
        await Task.yield()
        mock.hold = false; mock.waiting?.resume(returning: Data(#"{"ok":true}"#.utf8)); mock.waiting = nil
        _ = await first.value; _ = await later.value
        let flushed = await leaving.value
        XCTAssertTrue(flushed)
        XCTAssertEqual(mock.requests.count, 2)
        let last = try body(XCTUnwrap(mock.requests.last))
        let weeks = try XCTUnwrap(last["weeks"] as? [[String: Any]])
        let kids = try XCTUnwrap(weeks.last?["kids"] as? [[String: Any]])
        XCTAssertEqual(kids.first?["r"] as? Int, 6)
    }
    func testFailedOffSurvivesRestartAndNeverIncludesChildren() async throws {
        let (_, repo) = try await setup(), mock = ReportMock(), store = await store(repo, mock)
        mock.offline = true
        let result = await store.turnOff()
        XCTAssertFalse(result); XCTAssertFalse(store.status?.on == true); XCTAssertTrue(store.status?.owed == true)
        XCTAssertEqual(mock.requests.count, 1)
        let body = try body(mock.requests[0]); XCTAssertEqual(body["off"] as? Bool, true)
        XCTAssertTrue((body["weeks"] as! [[String: Any]]).allSatisfy { ($0["kids"] as? [Any])?.isEmpty == true })
        mock.offline = false
        let restarted = await self.store(repo, mock)
        let throttled = await restarted.sync(trigger: .countedRep)
        XCTAssertFalse(throttled); XCTAssertEqual(mock.requests.count, 1)
        let retried = await restarted.sync(trigger: .settings)
        XCTAssertTrue(retried); XCTAssertFalse(restarted.status?.owed == true); XCTAssertEqual(mock.requests.count, 2)
    }
    func testWithdrawalWaitsForOldUpdateAndLandsLast() async throws {
        let (_, repo) = try await setup(), mock = ReportMock(), store = await store(repo, mock)
        mock.hold = true
        let update = Task { await store.sync(trigger: .countedRep) }
        try await waitFor { mock.waiting != nil }
        let off = Task { await store.turnOff() }
        try await waitFor { store.status?.on == false }
        XCTAssertEqual(mock.requests.count, 1)
        mock.hold = false; mock.waiting?.resume(returning: Data(#"{"ok":true}"#.utf8)); mock.waiting = nil
        _ = await update.value; let finished = await off.value
        XCTAssertTrue(finished); XCTAssertEqual(mock.requests.count, 2)
        guard mock.requests.count == 2 else { return }
        XCTAssertNil(try body(mock.requests[0])["off"]); XCTAssertEqual(try body(mock.requests[1])["off"] as? Bool, true)
        XCTAssertFalse(store.status?.on == true); XCTAssertFalse(store.status?.owed == true)
    }
    func testCommitFailureCannotSendOrPartiallyCreateIds() async throws {
        let (memory, repo) = try await setup(changes: ["sona.report.v1":"{}"]), mock = ReportMock(), store = await store(repo, mock)
        let before = memory.value; memory.reject = true
        let result = await store.sync(trigger: .settings)
        XCTAssertFalse(result); XCTAssertTrue(mock.requests.isEmpty); XCTAssertEqual(memory.value, before)
    }
    func testOtherOriginCannotBorrowConsentOrIdentity() async throws {
        let (_, repo) = try await setup(), mock = ReportMock(), store = await store(repo, mock)
        await store.bind(origin: .www)
        let result = await store.sync(trigger: .settings)
        XCTAssertFalse(result); XCTAssertTrue(mock.requests.isEmpty)
    }
    func testExplicitSignupKeepsHouseholdOwnerAndSeparatesAdultLeadFromAnonymousReport() async throws {
        let changes = [
            "sona.kids.v1": #"{"list":[{"slot":""},{"slot":"k2"},{"slot":"k3"},{"slot":"k4"}],"active":"k2","hi":4}"#,
            "sona.profile.v1@k3": #"{"onboarded":true,"role":"slp"}"#,
            "sona.profile.v1@k4": #"{"onboarded":false,"childName":"Not set up"}"#
        ]
        let (_, repo) = try await setup(consent: "false", changes: changes)
        let mock = ReportMock(), store = await store(repo, mock)
        await store.settingsAppeared()
        XCTAssertTrue(mock.requests.isEmpty && mock.signups.isEmpty)
        XCTAssertEqual(store.status?.suggestedEmail, "synthetic@example.invalid")
        mock.response = Data(#"{"ok":true,"pending":true}"#.utf8)
        let enabled = await store.turnOn(email: " PreView.Parent+one@EXAMPLE.INVALID ", premium: true)
        XCTAssertTrue(enabled)
        try await waitFor { mock.signups.count == 1 }
        XCTAssertEqual(store.status?.email, "preview.parent+one@example.invalid")
        XCTAssertEqual(store.status?.pending, true)
        let report = try body(XCTUnwrap(mock.requests.first))
        XCTAssertEqual(report["on"] as? Bool, true)
        XCTAssertEqual(report["dev"] as? String, dev)
        let weeks = try XCTUnwrap(report["weeks"] as? [[String: Any]])
        XCTAssertTrue(weeks.allSatisfy { ($0["kids"] as? [[String: Any]])?.count == 2 })
        let lead = try XCTUnwrap(mock.signups.first), leadData = try XCTUnwrap(JSONSerialization.jsonObject(with: lead.body) as? [String: Any])
        XCTAssertEqual(lead.url.absoluteString, "https://app.speaksona.com/api/lead")
        XCTAssertEqual(lead.origin, "https://app.speaksona.com")
        XCTAssertEqual(Set(leadData.keys), ["email", "role", "source", "summary", "premium"])
        XCTAssertEqual(leadData["email"] as? String, store.status?.email)
        XCTAssertEqual(leadData["role"] as? String, "parent")
        XCTAssertEqual(leadData["source"] as? String, "app-settings")
        XCTAssertEqual(leadData["summary"] as? String, "Turned on the weekly progress report in Settings")
        XCTAssertEqual(leadData["premium"] as? Bool, true)
        let document = try await repo.snapshot(), family = try XCTUnwrap(document?.primaryFamily)
        let primary = NativeFamilyOrigin.object(family.children[0].profileJSON)
        XCTAssertEqual(primary?["weeklyReport"] as? Bool, true)
        XCTAssertEqual(primary?["weeklyEmail"] as? Bool, true)
        XCTAssertEqual(primary?["childName"] as? String, "Private name")
        XCTAssertNil(NativeFamilyOrigin.object(family.activeChild?.profileJSON)?["weeklyReport"])
        mock.response = Data(#"{"ok":true}"#.utf8)
        await store.settingsAppeared()
        XCTAssertEqual(store.status?.pending, false)
        XCTAssertEqual(mock.requests.count, 2)
        XCTAssertEqual(mock.signups.count, 1)
    }

    func testIneligibleInvalidAndUnsavedSignupCannotSend() async throws {
        let (memory, repo) = try await setup(consent: "false"), mock = ReportMock(), store = await store(repo, mock)
        let before = memory.value
        for bad in ["", "not an address", "démo@example.invalid", String(repeating: "a", count: 119) + "@b.invalid"] {
            let enabled = await store.turnOn(email: bad, premium: false)
            XCTAssertFalse(enabled); XCTAssertNotNil(store.error)
        }
        memory.reject = true
        let unsaved = await store.turnOn(email: "valid@example.invalid", premium: false)
        XCTAssertFalse(unsaved)
        XCTAssertEqual(before, memory.value)
        XCTAssertTrue(mock.requests.isEmpty && mock.signups.isEmpty)

        let (_, ineligible) = try await setup(consent: "false", changes: [
            "sona.profile.v1": #"{"onboarded":true,"role":"slp"}"#,
            "sona.profile.v1@k2": #"{"onboarded":false}"#
        ])
        let ineligibleStore = await self.store(ineligible, mock)
        let allowed = await ineligibleStore.turnOn(email: "valid@example.invalid", premium: false)
        XCTAssertFalse(allowed)
        XCTAssertEqual(ineligibleStore.status?.can, false)
        XCTAssertTrue(mock.requests.isEmpty && mock.signups.isEmpty)
    }

    func testSignupLeadRetriesAfterRestartWithoutBlockingOrResendingConfirmedReport() async throws {
        let (_, repo) = try await setup(consent: "false"), mock = ReportMock(), store = await store(repo, mock)
        mock.signupOffline = true
        let enabled = await store.turnOn(email: "another@example.invalid", premium: false)
        XCTAssertTrue(enabled)
        try await waitFor { mock.signups.count == 1 }
        XCTAssertEqual(store.status?.sent, true)
        XCTAssertNil(store.error)
        let beforeDue = await self.store(repo, mock, at: date.addingTimeInterval(299))
        await beforeDue.settingsAppeared()
        XCTAssertEqual(mock.signups.count, 1)
        mock.signupOffline = false
        let restarted = await self.store(repo, mock, at: date.addingTimeInterval(301))
        await restarted.settingsAppeared()
        try await waitFor { mock.signups.count == 2 }
        let leadData = try XCTUnwrap(JSONSerialization.jsonObject(with: XCTUnwrap(mock.signups.last).body) as? [String: Any])
        XCTAssertNil(leadData["premium"])
        XCTAssertEqual(mock.requests.count, 1)
        XCTAssertEqual(restarted.status?.sent, true)
    }

    func testHeldLeadCannotDelayConfirmationAndWithdrawalCancelsUnsentRetries() async throws {
        let (_, repo) = try await setup(consent: "false"), mock = ReportMock(), store = await store(repo, mock)
        mock.holdSignup = true
        mock.response = Data(#"{"ok":true,"pending":true}"#.utf8)
        let enabling = Task { await store.turnOn(email: "new@example.invalid", premium: false) }
        try await waitFor { mock.signupWaiting != nil && store.status?.pending == true }
        let pendingConfirmation = store.status?.pending
        mock.signupWaiting?.resume(throwing: FixtureFailure.offline)
        mock.signupWaiting = nil
        mock.holdSignup = false
        let enabled = await enabling.value
        XCTAssertTrue(enabled); XCTAssertEqual(pendingConfirmation, true)

        mock.response = Data(#"{"ok":true}"#.utf8)
        let withdrawn = await store.turnOff()
        XCTAssertTrue(withdrawn)
        let reopened = await self.store(repo, mock, at: date.addingTimeInterval(6 * 60))
        await reopened.settingsAppeared()
        let remaining = try await repo.prepareWeeklyReportSignup(origin: .app, now: date.addingTimeInterval(10 * 60))
        XCTAssertNil(remaining)
        XCTAssertEqual(mock.signups.count, 1)
        XCTAssertEqual(mock.requests.count, 2)
    }

    func testReenableWaitsForAnInFlightWithdrawalAndSendsOnlyFreshActivation() async throws {
        let (_, repo) = try await setup(), mock = ReportMock(), store = await store(repo, mock)
        mock.hold = true
        let withdrawing = Task { await store.turnOff() }
        try await waitFor { mock.waiting != nil }
        let enabling = Task { await store.turnOn(email: "synthetic@example.invalid", premium: false) }
        try await waitFor { store.status?.on == true }
        try await waitFor { mock.signups.count == 1 }
        XCTAssertEqual(mock.requests.count, 1)
        XCTAssertEqual(try body(mock.requests[0])["off"] as? Bool, true)
        mock.hold = false
        mock.waiting?.resume(returning: Data(#"{"ok":true}"#.utf8))
        mock.waiting = nil
        _ = await withdrawing.value
        let activated = await enabling.value
        XCTAssertTrue(activated)
        XCTAssertEqual(mock.requests.count, 2)
        XCTAssertEqual(try body(XCTUnwrap(mock.requests.last))["on"] as? Bool, true)
        XCTAssertEqual(store.status?.sent, true)
    }

    func testReenableDropsExactOfflineOffAndSendsAliasOffBeforeNewActivation() async throws {
        let state = "{\"dev\":\"\(dev)\",\"offs\":[{\"e\":\"d.ad+one@gmail.com\",\"d\":\"\(dev)\"},{\"e\":\"dad@gmail.com\",\"d\":\"\(dev)\"}]}"
        let (_, repo) = try await setup(consent: "false", changes: ["sona.report.v1": state])
        let mock = ReportMock(), store = await store(repo, mock)
        let activated = await store.turnOn(email: "d.ad+one@gmail.com", premium: false)
        XCTAssertTrue(activated)
        XCTAssertEqual(mock.requests.count, 2)
        let first = try body(XCTUnwrap(mock.requests.first)), last = try body(XCTUnwrap(mock.requests.last))
        XCTAssertEqual(first["off"] as? Bool, true)
        XCTAssertEqual(first["email"] as? String, "dad@gmail.com")
        XCTAssertEqual(last["on"] as? Bool, true)
        XCTAssertEqual(last["email"] as? String, "d.ad+one@gmail.com")
    }

    func testOffAliasesDrainBeforeCanonicalActivation() async throws {
        let state = "{\"dev\":\"\(dev)\",\"onFor\":\"synthetic@example.invalid\",\"offOwed\":{\"e\":\"old@example.invalid\",\"d\":\"\(dev)\"},\"offs\":[{\"e\":\"other@example.invalid\",\"d\":\"\(dev)\"}]}"
        let (_, repo) = try await setup(changes: ["sona.report.v1":state]), mock = ReportMock(), store = await store(repo, mock)
        let result = await store.sync(trigger: .settings)
        XCTAssertTrue(result); XCTAssertEqual(mock.requests.count, 3)
        XCTAssertEqual(try body(mock.requests[0])["off"] as? Bool, true)
        XCTAssertEqual(try body(mock.requests[1])["off"] as? Bool, true)
        XCTAssertNil(try body(mock.requests[2])["off"])
        XCTAssertFalse(store.status?.owed == true)
    }
    private nonisolated static func policy(_ family: NativeFamilyOrigin, _ action: NativeFamilyReportAction, at date: Date) throws -> NativeFamilyReportMutation {
        let keys = family.children.map { $0.id.slot.isEmpty ? "sona.profile.v1" : "sona.profile.v1@" + $0.id.slot }
        let result: NativeWeeklyReportPolicy.Projection
        switch action {
        case .flush: result = try NativeWeeklyReportPolicy.prepare(storage: family.storage, profileKeys: keys, action: .flush, force: true, now: date)
        case .sync: result = try NativeWeeklyReportPolicy.prepare(storage: family.storage, profileKeys: keys, action: .sync, force: true, now: date)
        case .queueOff(let email): result = try NativeWeeklyReportPolicy.prepare(storage: family.storage, profileKeys: keys, action: .queueOff, force: true, now: date, removedEmail: email)
        case .queueOn(let email): result = try NativeWeeklyReportPolicy.prepare(storage: family.storage, profileKeys: keys, action: .queueOn, force: true, now: date, signupEmail: email)
        }
        return .init(reportState: result.reportState, profilePatches: result.profilePatches, body: result.body, context: result.context)
    }
    func testCrashBeforeSendThenWithdrawalCannotResendOldNumbers() async throws {
        let (_, repo) = try await setup(), date = date
        let packet = try await repo.prepareWeeklyReport(origin: .app, now: date) { family, action in try Self.policy(family, action, at: date) }
        XCTAssertNotNil(packet)
        let disconnected = await store(repo, nil)
        let localOff = await disconnected.turnOff()
        XCTAssertFalse(localOff); XCTAssertTrue(disconnected.status?.owed == true)
        let mock = ReportMock(), restarted = await store(repo, mock)
        let sent = await restarted.sync(trigger: .settings)
        XCTAssertTrue(sent); XCTAssertEqual(mock.requests.count, 1)
        XCTAssertEqual(try body(XCTUnwrap(mock.requests.first))["off"] as? Bool, true)
        XCTAssertFalse(restarted.status?.on == true); XCTAssertFalse(restarted.status?.owed == true)
    }
    func testRemovingAddressOwnerQueuesItsOriginalDeviceOff() async throws {
        let (_, repo) = try await setup()
        try await repo.removeChild(.init(origin: .app, slot: ""), operationID: UUID())
        let mock = ReportMock(), store = await store(repo, mock)
        let sent = await store.sync(trigger: .settings)
        XCTAssertTrue(sent); XCTAssertEqual(mock.requests.count, 1)
        let request = try body(XCTUnwrap(mock.requests.first))
        XCTAssertEqual(request["off"] as? Bool, true); XCTAssertEqual(request["dev"] as? String, dev)
        // The report's processing cannot acknowledge the separate board errand.
        let document = try await repo.snapshot()
        XCTAssertEqual(document?.removalObligations.count, 1)
    }
    func testMalformedProjectionCannotCommitOrReachTransport() async throws {
        let (memory, repo) = try await setup(), before = memory.value
        let bad: [String: Any] = ["email":"synthetic@example.invalid", "dev":dev,
            "childName":"This must stay on the phone", "weeks":[["wk":"2026-11-09","kids":[]], ["wk":"2026-11-16","kids":[]]]]
        let bytes = try JSONSerialization.data(withJSONObject: bad), date = date
        do {
            _ = try await repo.prepareWeeklyReport(origin: .app, now: date) { family, _ in
                .init(reportState: family.storage["sona.report.v1"], profilePatches: [:], body: bytes, context: Data("{}".utf8))
            }
            XCTFail("unlisted report field was accepted")
        } catch {}
        XCTAssertEqual(memory.value, before)
    }
}

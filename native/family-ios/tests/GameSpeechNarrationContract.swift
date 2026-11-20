import Foundation
import SonaSpeechCore

private final class GateNarrationStub: URLProtocol {
    static let lock = NSLock()
    static var texts: [String] = []
    static var failGo = false
    static var failAll = false
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        precondition(request.url?.absoluteString == "https://app.speaksona.com/api/tts")
        precondition(request.httpMethod == "POST" && !request.httpShouldHandleCookies)
        var data = request.httpBody ?? Data()
        if data.isEmpty, let stream = request.httpBodyStream {
            stream.open(); defer { stream.close() }
            let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: 4096)
            defer { buffer.deallocate() }
            while stream.hasBytesAvailable { let count = stream.read(buffer, maxLength: 4096); if count <= 0 { break }; data.append(buffer, count: count) }
        }
        let body = try! JSONSerialization.jsonObject(with: data) as! [String: Any]
        precondition(Set(body.keys) == ["text", "voice", "stable"] && body["stable"] as? Bool == true)
        let text = body["text"] as! String
        Self.lock.lock(); Self.texts.append(text); let fail = Self.failAll || (Self.failGo && text == "Go!"); Self.lock.unlock()
        let response = HTTPURLResponse(url: request.url!, statusCode: fail ? 503 : 200,
            httpVersion: nil, headerFields: ["Content-Type": "audio/pcm"])!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data([0, 0, 20, 40, 0, 0]))
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
    static func snapshot() -> [String] { lock.lock(); defer { lock.unlock() }; return texts }
}
@main struct GameSpeechNarrationContract {
    @MainActor static func main() async throws {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [GateNarrationStub.self]
        let session = URLSession(configuration: configuration)
        defer { session.invalidateAndCancel() }
        let voice = GameSpeechNarration(session: session)
        let plan = GameSpeechGatePlan(gameID: "hoops", sound: "R", word: "rabbit", sayTimes: 2,
            intro: "Say each word two times to get a ball.", voiceID: "test")
        let first = try await voice.prepare(plan: plan, includeIntro: true)
        precondition(first.map(\.text) == [plan.intro!, "Say... rabbit.", "Go!"])
        let pcm = try GuidedPracticePCM.samples(fromWave: first[1].encodedAudio!)
        precondition(pcm == Data([0, 0, 20, 40, 0, 0]))
        let repeated = try await voice.prepare(plan: plan, includeIntro: false)
        precondition(repeated.map(\.text) == ["Say... rabbit.", "Go!"])
        precondition(GateNarrationStub.snapshot().count == 3, "One unchanged model, intro, Go use only RAM after first ask")
        let page = try await voice.authoredPrompt("A rabbit runs.", voice: "test", volume: 0.5)
        precondition(page.text == "A rabbit runs." && page.volume == 0.5)
        let muted = GameSpeechGatePlan(gameID: "hoops", sound: "R", word: "rabbit", sayTimes: 2, voiceOn: false)
        let count = GateNarrationStub.snapshot().count
        let silent = try await voice.prepare(plan: muted, includeIntro: true)
        precondition(silent.isEmpty && GateNarrationStub.snapshot().count == count)
        GateNarrationStub.failGo = true
        let noGo = GameSpeechNarration(session: session)
        let one = await noGo.goPrompt(voice: "test", volume: 0.8)
        let two = await noGo.goPrompt(voice: "test", volume: 0.8)
        precondition(one == nil && two == nil && GateNarrationStub.snapshot().filter { $0 == "Go!" }.count == 2,
            "A missing first Go must not retry the network on subsequent turns")
        GateNarrationStub.failAll = true
        let offlineVoice = GameSpeechNarration(session: session)
        let offline = try await offlineVoice.prepare(plan: plan, includeIntro: true)
        precondition(offline.map(\.text) == [plan.intro!, "Say... rabbit."])
        precondition(offline.allSatisfy { $0.systemSpeech?.text == $0.text }, "Only exact authored lines use installed fallback; Go stays absent")
        let offlinePage = try await offlineVoice.authoredPrompt("A rabbit runs.", voice: "test", volume: 0.5)
        precondition(offlinePage.systemSpeech?.text == "A rabbit runs." && offlinePage.systemSpeech?.relativeRate == 0.95)
        print("PASS: native game/reader authored narration, model separation, PCM identity, RAM reuse, mute, missing Go; zero live requests")
    }
}

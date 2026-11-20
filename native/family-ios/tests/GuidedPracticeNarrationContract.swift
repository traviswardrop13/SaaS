import Foundation
import SonaSpeechCore

private final class GuidedNarrationStub: URLProtocol {
    static let lock = NSLock()
    static var bodies: [[String: Any]] = []
    static var status = 200
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
            while stream.hasBytesAvailable { let n = stream.read(buffer, maxLength: 4096); if n <= 0 { break }; data.append(buffer, count: n) }
        }
        let body = try! JSONSerialization.jsonObject(with: data) as! [String: Any]
        precondition(Set(body.keys) == ["text", "voice", "stable"], "Only narration choices may leave")
        Self.lock.lock(); Self.bodies.append(body); let status = Self.status; Self.lock.unlock()
        let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: ["Content-Type": "audio/pcm"])!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(repeating: 0x05, count: 8000))
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
    static func snapshot() -> [[String: Any]] { lock.lock(); defer { lock.unlock() }; return bodies }
}

@main struct GuidedPracticeNarrationContract {
    @MainActor static func main() async throws {
        let root = URL(fileURLWithPath: CommandLine.arguments[1])
        let catalog = try PracticeDialogueCatalog.decode(Data(contentsOf: root.appendingPathComponent("native/family-ios/SonaNativePreview/Content/PracticeDialogue.json")))
        let directory = URL(fileURLWithPath: "/private/tmp/sona-guided-narration-test.bundle")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let info = ["CFBundleIdentifier": "com.speaksona.guided-model-test", "CFBundleName": "GuidedModelTest", "CFBundlePackageType": "BNDL"]
        try PropertyListSerialization.data(fromPropertyList: info, format: .xml, options: 0).write(to: directory.appendingPathComponent("Info.plist"))
        let original = try Data(contentsOf: root.appendingPathComponent("public/coach/say-echo/S-sound.wav"))
        try original.write(to: directory.appendingPathComponent("S-sound.wav"))
        let bundle = Bundle(url: directory)!
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [GuidedNarrationStub.self]
        let session = URLSession(configuration: configuration)
        defer { session.invalidateAndCancel() }
        let content = PracticeFlowContent(sound: "S", rung: .isolation, text: "ssss", cueTip: catalog.sound("S")!.cue)
        let plan = GuidedPracticePlan(content: content, masteredRung: 0, voiceID: "test-voice", gameTitle: "Fruit Slice")
        var flow = try PracticeFlowMachine(content: content, masteredRung: 0)
        _ = flow.send(.start)
        let turn = flow.currentTurn!
        let narrator = try GuidedPracticeNarration(bundle: bundle, session: session, catalog: catalog)
        let prompt = try await narrator.prepare(.turn(turn, .initial), plan: plan)
        precondition(prompt.text == content.initialPrompt() && prompt.parts.isEmpty && !prompt.isMuted)
        let rendered = try GuidedPracticePCM.samples(fromWave: prompt.encodedAudio!)
        let recorded = try GuidedPracticePCM.samples(fromWave: original)
        precondition(rendered.range(of: recorded) != nil, "Rachel's original waveform must be preserved unchanged")
        let sent = GuidedNarrationStub.snapshot()
        precondition(sent.count == 3, "before, after, optional existing Go only")
        precondition(sent.allSatisfy { $0["voice"] as? String == "test-voice" && $0["stable"] as? Bool == true })
        precondition(sent.contains { $0["text"] as? String == "Go!" })
        let slot = content.soundSlot(in: String(content.initialPrompt().dropLast(4)))!
        precondition(sent.contains { $0["text"] as? String == slot.before })
        precondition(sent.contains { $0["text"] as? String == slot.after })
        let slow = try await narrator.prepare(.turn(turn, .slow), plan: plan)
        precondition(slow.playbackRate == 0.7 && slow.text == content.initialPrompt(includeFirstCue: false))
        precondition(GuidedNarrationStub.snapshot().filter { $0["text"] as? String == "Go!" }.count == 1)
        let mutedPlan = GuidedPracticePlan(content: content, masteredRung: 0, voiceOn: false, gameTitle: "Fruit Slice")
        let calls = GuidedNarrationStub.snapshot().count
        let muted = try await narrator.prepare(.turn(turn, .initial), plan: mutedPlan)
        precondition(muted.isMuted && muted.encodedAudio == nil && GuidedNarrationStub.snapshot().count == calls)
        let fresh = try GuidedPracticeNarration(bundle: bundle, session: session, catalog: catalog)
        GuidedNarrationStub.status = 503
        let offline = try await fresh.prepare(.feedback(.successfulLaunch), plan: plan)
        precondition(offline.systemSpeech?.text == PracticeFlowContent.successfulLaunchPrompt && offline.systemSpeech?.relativeRate == 0.95)
        let offlineAsk = try await fresh.prepare(.turn(turn, .initial), plan: plan)
        precondition(offlineAsk.systemSpeech?.text == String(content.initialPrompt().dropLast(4)), "Optional Go must never be synthesized")
        let offlineSlow = try await fresh.prepare(.turn(turn, .slow), plan: plan)
        precondition(offlineSlow.systemSpeech?.relativeRate == 0.62)
        let recordedDirectory = URL(fileURLWithPath: "/private/tmp/sona-guided-fallback-test.bundle")
        try FileManager.default.createDirectory(at: recordedDirectory, withIntermediateDirectories: true)
        try PropertyListSerialization.data(fromPropertyList: info, format: .xml, options: 0).write(to: recordedDirectory.appendingPathComponent("Info.plist"))
        let recordedLine = try Data(contentsOf: root.appendingPathComponent("public/coach/say-echo/S.mp3"))
        try recordedLine.write(to: recordedDirectory.appendingPathComponent("S.mp3"))
        let recordedVoice = try GuidedPracticeNarration(bundle: Bundle(url: recordedDirectory)!, session: session, catalog: catalog)
        let fallback = try await recordedVoice.prepare(.turn(turn, .initial), plan: plan)
        precondition(fallback.systemSpeech == nil && fallback.parts.first?.fileURL.lastPathComponent == "S.mp3", "Approved whole-line recording has priority offline")
        let bytes = Data([0, 0, 0x10, 0x27, 0, 0])
        let roundTrip = try GuidedPracticePCM.samples(fromWave: GuidedPracticePCM.wave(bytes))
        precondition(roundTrip == bytes)
        do { _ = try GuidedPracticePCM.samples(fromWave: Data(repeating: 0, count: 44)); fatalError("Invalid model accepted") } catch {}
        print("PASS: exact approved text requests, unchanged Rachel samples, joined in-memory media, replay/slow/mute, recorded and installed offline fallbacks; zero live requests")
    }
}

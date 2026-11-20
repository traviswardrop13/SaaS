import Foundation
import SonaSpeechCore

/// Only the canonical authored intro, "Say... <source word>." and optional
/// "Go!" enter this service. No microphone data or transcripts reach it.
@MainActor final class GameSpeechNarration: GameSpeechPromptProviding {
    enum Failure: Error { case unavailable, invalidAudio, invalidPlan }
    private let session: URLSession
    private var cache: [String: Data] = [:]
    private var askedForGo = false
    private var go: Data?

    init(session: URLSession? = nil) {
        if let session { self.session = session }
        else {
            let configuration = URLSessionConfiguration.ephemeral
            configuration.urlCache = nil; configuration.httpCookieStorage = nil
            self.session = URLSession(configuration: configuration)
        }
    }

    func prepare(plan: GameSpeechGatePlan, includeIntro: Bool) async throws -> [PracticePrompt] {
        guard plan.isSupported else { throw Failure.invalidPlan }
        guard plan.voiceOn && plan.volume != 0 else { return [] }
        async let pendingGo = optionalGo(voice: plan.voiceID)
        var result: [PracticePrompt] = []
        if includeIntro, let intro = plan.intro, !intro.isEmpty {
            result.append(try await prompt(intro, plan: plan))
        }
        result.append(try await prompt("Say... " + plan.word + ".", plan: plan))
        if let bytes = await pendingGo {
            result.append(.init(text: "Go!", encodedAudio: try GuidedPracticePCM.wave(bytes), volume: plan.volume))
        }
        try Task.checkCancellation()
        return result
    }

    /// Fixed authored content only. The caller supplies a source page line,
    /// never a child's name, transcript, recording, or generated feedback.
    func authoredPrompt(_ text: String, voice: String, volume: Float) async throws -> PracticePrompt {
        guard !text.isEmpty, text.utf16.count <= 1_000 else { throw Failure.invalidPlan }
        do {
            let bytes = try await narration(text, voice: voice)
            return .init(text: text, encodedAudio: try GuidedPracticePCM.wave(bytes), volume: volume)
        } catch is CancellationError { throw CancellationError() }
        catch {
            try Task.checkCancellation()
            return .init(text: text, systemSpeech: .init(text: text), volume: volume)
        }
    }

    /// At most the first lookup waits for Go. A missing clip never falls back
    /// to a synthesized replacement or a new network wait every turn.
    func goPrompt(voice: String, volume: Float) async -> PracticePrompt? {
        guard let bytes = await optionalGo(voice: voice), let wave = try? GuidedPracticePCM.wave(bytes) else { return nil }
        return .init(text: "Go!", encodedAudio: wave, volume: volume)
    }

    private func prompt(_ text: String, plan: GameSpeechGatePlan) async throws -> PracticePrompt {
        try await authoredPrompt(text, voice: plan.voiceID, volume: plan.volume)
    }

    private func narration(_ text: String, voice: String, timeout: TimeInterval = 8) async throws -> Data {
        let key = voice + "|" + text
        if let cached = cache[key] { return cached }
        var request = URLRequest(url: URL(string: "https://app.speaksona.com/api/tts")!)
        request.httpMethod = "POST"; request.timeoutInterval = timeout
        request.httpShouldHandleCookies = false
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("https://app.speaksona.com", forHTTPHeaderField: "Origin")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["text": text, "voice": voice, "stable": true])
        let (bytes, response) = try await session.data(for: request, delegate: GameSpeechRedirectGuard())
        guard let response = response as? HTTPURLResponse, response.statusCode == 200,
              response.url?.scheme == "https", response.url?.host == "app.speaksona.com" else { throw Failure.unavailable }
        guard !bytes.isEmpty, bytes.count.isMultiple(of: 2), bytes.count <= 2_000_000 else { throw Failure.invalidAudio }
        if response.value(forHTTPHeaderField: "X-Sona-Voice-Keep") != "0" {
            if cache.count >= 64 { cache.removeAll(keepingCapacity: true) }
            cache[key] = bytes
        }
        return bytes
    }

    private func optionalGo(voice: String) async -> Data? {
        if let go { return go }
        guard !askedForGo else { return nil }
        askedForGo = true
        go = try? await narration("Go!", voice: voice, timeout: 1.5)
        return go
    }
}

private final class GameSpeechRedirectGuard: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask,
                    willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest,
                    completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}

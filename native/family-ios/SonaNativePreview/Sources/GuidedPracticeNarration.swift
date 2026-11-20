import Foundation
import CryptoKit
import SonaSpeechCore

/// Only authored narration text reaches the fixed TTS endpoint. This object
/// never receives a microphone frame, recording, transcript or child name.
/// Narration and Rachel's bundled sound are assembled and played in memory.
@MainActor final class GuidedPracticeNarration: GuidedPracticePromptProviding {
    enum Failure: Error { case missingModel, invalidAudio, unavailable, unapprovedFeedback }
    private let bundle: Bundle
    private let session: URLSession
    private let catalog: PracticeDialogueCatalog
    private var cache: [String: Data] = [:]
    private var askedForGo = false
    private var go: Data?

    init(bundle: Bundle = .main, session: URLSession? = nil, catalog: PracticeDialogueCatalog? = nil) throws {
        self.bundle = bundle
        self.catalog = try catalog ?? PracticeDialogueCatalog.load(bundle: bundle)
        if let session { self.session = session }
        else {
            let config = URLSessionConfiguration.ephemeral
            config.urlCache = nil
            config.httpCookieStorage = nil
            self.session = URLSession(configuration: config)
        }
    }

    func prepare(_ request: GuidedPracticeVoiceRequest, plan: GuidedPracticePlan) async throws -> PracticePrompt {
        let text: String
        let content: PracticeFlowContent?
        let slow: Bool
        switch request {
        case let .turn(turn, mode):
            content = turn.content
            slow = mode == .slow
            switch mode {
            case .initial: text = turn.prompt
            case .replay:
                text = turn.content.initialPrompt(requiredReps: plan.requiredReps, includeFirstCue: false)
            case .slow:
                text = turn.content.rung == .isolation
                    ? turn.content.initialPrompt(requiredReps: plan.requiredReps, includeFirstCue: false)
                    : [turn.content.say, turn.content.display, turn.content.text].compactMap { $0 }.first(where: { !$0.isEmpty }) ?? turn.content.text
            }
        case let .feedback(feedback):
            content = nil
            slow = false
            switch feedback {
            case .finalFailure: text = PracticeFlowContent.finalFailurePrompt
            case .successfulLaunch: text = PracticeFlowContent.successfulLaunchPrompt
            case .stepDownPraise:
                if let supplied = plan.praiseLine {
                    guard catalog.praise.contains(supplied) else { throw Failure.unapprovedFeedback }
                    text = supplied
                } else { text = PracticeFlowContent.stepDownSuccessFallbackPrompt }
            }
        case .quietNotice:
            text = PracticeFlowContent.quiet.spoken ?? ""
            content = nil
            slow = false
        }
        let rate: Float = slow ? Float(catalog.timing.slowPlaybackRate) : 1
        if !plan.voiceOn || plan.volume == 0 {
            return PracticePrompt(text: text, parts: [], isMuted: true, volume: plan.volume, playbackRate: rate)
        }
        let handsOver = text.hasSuffix(" Go!")
        let words = handsOver ? String(text.dropLast(4)) : text
        do {
            async let pendingGo = handsOver ? optionalGo(voice: plan.voiceID) : nil
            let pcm: Data
            if let content, let slot = content.soundSlot(in: words, humanClipsEnabled: plan.humanClipsEnabled),
               let clip = try? recordedSound(content.target.sound) {
                async let before = narration(slot.before, voice: plan.voiceID)
                async let after = narration(slot.after, voice: plan.voiceID)
                let values = try await (before, after)
                let goBytes = await pendingGo
                var result = GuidedPracticePCM.trim(values.0, atEnd: true)
                result.append(clip)
                let tail = GuidedPracticePCM.trim(values.1, atEnd: false)
                if let goBytes {
                    result.append(GuidedPracticePCM.trim(tail, atEnd: true))
                    result.append(Data(repeating: 0, count: catalog.timing.goGapSamples * 2))
                    result.append(GuidedPracticePCM.trim(goBytes, atEnd: false))
                } else { result.append(tail) }
                pcm = result
            } else {
                let body = try await narration(words, voice: plan.voiceID)
                let goBytes = await pendingGo
                if let goBytes {
                    var result = GuidedPracticePCM.trim(body, atEnd: true)
                    result.append(Data(repeating: 0, count: catalog.timing.goGapSamples * 2))
                    result.append(GuidedPracticePCM.trim(goBytes, atEnd: false))
                    pcm = result
                } else { pcm = body }
            }
            try Task.checkCancellation()
            return PracticePrompt(text: text, encodedAudio: try GuidedPracticePCM.wave(pcm),
                                  volume: plan.volume, playbackRate: rate)
        } catch is CancellationError { throw CancellationError() }
        catch {
            try Task.checkCancellation()
            // Shipping charge prefers the original bundled whole-line take
            // when the voice service is unavailable. It is model output only.
            if let content, content.rung == .isolation, plan.humanClipsEnabled,
               let file = approvedWholeLine(content.target.sound) {
                return .init(text: text, parts: [.init(fileURL: file)], volume: plan.volume, playbackRate: rate)
            }
            // Keep the exact authored words; optional Go is never replaced by
            // installed speech. Rate/pitch mirror speakFallback, not a new cue.
            let spoken = words.replacingOccurrences(of: "\\[[a-z ]{2,24}\\]\\s*", with: "", options: [.regularExpression, .caseInsensitive])
            return .init(text: text, systemSpeech: .init(text: spoken, slow: slow), volume: plan.volume)
        }
    }

    private func approvedWholeLine(_ sound: String) -> URL? {
        guard let expected = catalog.sound(sound)?.clips.fallbackLine,
              let file = bundle.url(forResource: sound, withExtension: "mp3"),
              let bytes = try? Data(contentsOf: file) else { return nil }
        let digest = SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined()
        return digest == expected.sha256 ? file : nil
    }

    private func recordedSound(_ sound: String) throws -> Data {
        guard let expected = catalog.sound(sound)?.clips.sound,
              let file = bundle.url(forResource: sound + "-sound", withExtension: "wav") else { throw Failure.missingModel }
        let bytes = try Data(contentsOf: file)
        let digest = SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined()
        guard digest == expected.sha256 else { throw Failure.invalidAudio }
        return try GuidedPracticePCM.samples(fromWave: bytes)
    }

    private func optionalGo(voice: String) async -> Data? {
        if let go { return go }
        guard !askedForGo else { return nil }
        askedForGo = true
        // The existing handoff clip is optional and never holds a child
        // indefinitely. A later model never makes a fresh Go network request.
        go = try? await narration("Go!", voice: voice, timeout: Double(catalog.timing.goWaitMS) / 1000)
        return go
    }

    private func narration(_ text: String, voice: String, timeout: TimeInterval = 7) async throws -> Data {
        guard !text.isEmpty, text.utf16.count <= 200 else { throw Failure.unavailable }
        let key = voice + "|" + text
        if let value = cache[key] { return value }
        var request = URLRequest(url: URL(string: "https://app.speaksona.com/api/tts")!)
        request.httpMethod = "POST"
        request.timeoutInterval = timeout
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.httpShouldHandleCookies = false
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("https://app.speaksona.com", forHTTPHeaderField: "Origin")
        request.httpBody = try JSONEncoder().encode(NarrationBody(text: text, voice: voice, stable: true))
        let (data, response) = try await session.data(for: request, delegate: GuidedNarrationRedirectGuard())
        guard let response = response as? HTTPURLResponse, response.statusCode == 200,
              response.url?.host == "app.speaksona.com", response.url?.scheme == "https",
              !data.isEmpty, data.count.isMultiple(of: 2), data.count <= 2_000_000 else { throw Failure.unavailable }
        try Task.checkCancellation()
        if response.value(forHTTPHeaderField: "X-Sona-Voice-Keep") != "0" {
            if cache.count >= 64 { cache.removeAll(keepingCapacity: true) }
            cache[key] = data
        }
        return data
    }

    private struct NarrationBody: Encodable { let text, voice: String; let stable: Bool }
}

/// Exact PCM representation used by the existing TTS route and cut models:
/// signed little-endian mono 16-bit, 24 kHz. These helpers accept playback
/// material only. No input samples are ever routed here or persisted.
enum GuidedPracticePCM {
    static func samples(fromWave bytes: Data) throws -> Data {
        guard bytes.count >= 44, String(data: bytes[0..<4], encoding: .ascii) == "RIFF",
              String(data: bytes[8..<12], encoding: .ascii) == "WAVE",
              word(bytes, 20) == 1, word(bytes, 22) == 1, long(bytes, 24) == 24_000,
              word(bytes, 34) == 16, String(data: bytes[36..<40], encoding: .ascii) == "data",
              Int(long(bytes, 40)) == bytes.count - 44 else { throw GuidedPracticeNarration.Failure.invalidAudio }
        return Data(bytes.dropFirst(44))
    }

    static func wave(_ pcm: Data) throws -> Data {
        guard !pcm.isEmpty, pcm.count.isMultiple(of: 2), pcm.count <= Int(UInt32.max) - 36 else {
            throw GuidedPracticeNarration.Failure.invalidAudio
        }
        var result = Data("RIFF".utf8)
        append(UInt32(36 + pcm.count), to: &result)
        result.append(Data("WAVEfmt ".utf8)); append(UInt32(16), to: &result)
        append(UInt16(1), to: &result); append(UInt16(1), to: &result)
        append(UInt32(24_000), to: &result); append(UInt32(48_000), to: &result)
        append(UInt16(2), to: &result); append(UInt16(16), to: &result)
        result.append(Data("data".utf8)); append(UInt32(pcm.count), to: &result); result.append(pcm)
        return result
    }

    static func trim(_ pcm: Data, atEnd: Bool) -> Data {
        let count = pcm.count / 2
        guard count > 0 else { return pcm }
        func sample(_ index: Int) -> Int { Int(Int16(bitPattern: word(pcm, index * 2))) }
        if atEnd {
            var index = count - 1
            while index > 0 && abs(sample(index)) < 184 { index -= 1 }
            return Data(pcm.prefix(min(count, index + 1 + 1200) * 2))
        }
        var index = 0
        while index < count && abs(sample(index)) < 184 { index += 1 }
        return Data(pcm.dropFirst(max(0, index - 1200) * 2))
    }

    private static func word(_ bytes: Data, _ index: Int) -> UInt16 { UInt16(bytes[index]) | UInt16(bytes[index + 1]) << 8 }
    private static func long(_ bytes: Data, _ index: Int) -> UInt32 { UInt32(word(bytes, index)) | UInt32(word(bytes, index + 2)) << 16 }
    private static func append<T: FixedWidthInteger>(_ number: T, to data: inout Data) {
        var number = number.littleEndian
        withUnsafeBytes(of: &number) { data.append(contentsOf: $0) }
    }
}

private final class GuidedNarrationRedirectGuard: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}

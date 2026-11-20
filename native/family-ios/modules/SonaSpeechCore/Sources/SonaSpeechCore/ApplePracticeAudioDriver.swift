import Foundation
#if os(iOS)
import AVFoundation
import Speech
import UIKit

/// The native replacement for SonaSpeech's mic/recognition transport. Buffers
/// live only in a small rolling analyser window; there is no recorder or upload.
/// The caller still owns prompts, turns and whether an attempt counts.
@MainActor
public final class ApplePracticeAudioDriver: NSObject, PracticeAudioDriver {
    public enum DriverError: Error {
        case microphoneNotAllowed, unavailable, invalidFormat, playbackFailed
    }

    private var engine: AVAudioEngine?
    private var tapInstalled = false
    private var micLive = false
    private var micGeneration = 0
    private var ring: PracticeInputRing?
    private var sampleRate: Double = 48_000
    private var meter: Timer?
    private var frameHandler: (@MainActor (PracticeAcousticFrame) -> Void)?
    private var interruptionHandler: (@MainActor () -> Void)?
    private var sessionInterruptionHandler: (@MainActor () -> Void)?
    private var observers: [NSObjectProtocol] = []
    private var shapeMagnitudes = [Double](repeating: 0, count: 256)

    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private var recognitionTask: SFSpeechRecognitionTask?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionGeneration = 0
    private var recognitionText = ""
    private var recognitionEnded = true
    private var recognitionHadStarted = false
    private var recognitionStopping = false
    private var recognitionDeadline: Timer?
    private var recognitionSettle: Timer?
    private var recognitionWaiters: [CheckedContinuation<String, Never>] = []

    private var player: AVAudioPlayer?
    private var playbackContinuation: CheckedContinuation<Void, Error>?
    private var playbackDeadline: Timer?
    private var playbackGeneration = 0

    public override init() {
        super.init()
        observe(UIApplication.didEnterBackgroundNotification) { $0.interrupt() }
        observe(UIScene.didEnterBackgroundNotification) { $0.interrupt() }
        observe(AVAudioSession.interruptionNotification) { driver, note in
            guard let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
                  AVAudioSession.InterruptionType(rawValue: raw) == .began else { return }
            driver.interrupt()
        }
        observe(AVAudioSession.routeChangeNotification) { driver, note in
            guard let raw = note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt,
                  let reason = AVAudioSession.RouteChangeReason(rawValue: raw),
                  reason != .categoryChange, reason != .override else { return }
            driver.interrupt()
        }
        observe(.AVAudioEngineConfigurationChange) { driver, note in
            guard let changed = note.object as? AVAudioEngine,
                  changed === driver.engine else { return }
            driver.interrupt()
        }
        observe(AVAudioSession.mediaServicesWereResetNotification) { driver in
            driver.interrupt(mediaReset: true)
        }
    }

    deinit {
        for observer in observers { NotificationCenter.default.removeObserver(observer) }
        meter?.invalidate()
        recognitionDeadline?.invalidate()
        recognitionSettle?.invalidate()
        playbackDeadline?.invalidate()
        // The session owner must await closeMicrophone before releasing this
        // object. The ring also refuses audio after its owner disappears.
        ring?.deactivate()
    }

    /// Called only from the grown-up's yes. An unanswered OS dialog can outlive
    /// the view: do not follow a late mic answer with another permission box.
    public func requestPermissions() async -> Bool {
        guard !Task.isCancelled,
              Bundle.main.object(forInfoDictionaryKey: "NSMicrophoneUsageDescription") is String else { return false }
        let microphoneGranted: Bool
        switch AVAudioSession.sharedInstance().recordPermission {
        case .granted: microphoneGranted = true
        case .denied: microphoneGranted = false
        default:
            microphoneGranted = await withCheckedContinuation { continuation in
                AVAudioSession.sharedInstance().requestRecordPermission { granted in
                    continuation.resume(returning: granted)
                }
            }
        }
        guard microphoneGranted, !Task.isCancelled else { return false }
        // Missing local models or a refused recognition permission leave the
        // acoustic check usable. They must never enable Apple's server path.
        if recognizer?.supportsOnDeviceRecognition == true,
           SFSpeechRecognizer.authorizationStatus() == .notDetermined,
           Bundle.main.object(forInfoDictionaryKey: "NSSpeechRecognitionUsageDescription") is String {
            _ = await withCheckedContinuation { continuation in
                SFSpeechRecognizer.requestAuthorization { status in
                    continuation.resume(returning: status == .authorized)
                }
            }
        }
        return !Task.isCancelled
    }

    public func openMicrophone(
        onFrame: @escaping @MainActor (PracticeAcousticFrame) -> Void,
        onInterruption: @escaping @MainActor () -> Void
    ) async throws {
        guard !Task.isCancelled, UIApplication.shared.applicationState != .background else {
            throw DriverError.unavailable
        }
        guard AVAudioSession.sharedInstance().recordPermission == .granted else {
            throw DriverError.microphoneNotAllowed
        }
        guard !micLive, engine == nil, player == nil else { throw DriverError.unavailable }
        recognitionText = ""
        recognitionHadStarted = false
        let audio = AVAudioSession.sharedInstance()
        do {
            // Unlike the plugin's two-process WebKit arrangement, the native
            // app needs no mixWithOthers. Other music must not enter its mic.
            // No HFP, measurement mode, automatic gain or voice processing.
            try audio.setCategory(.playAndRecord, mode: .default,
                                  options: [.defaultToSpeaker, .allowBluetoothA2DP])
            try audio.setActive(true)
            let fresh = AVAudioEngine()
            let input = fresh.inputNode
            let hardware = input.inputFormat(forBus: 0)
            let format = input.outputFormat(forBus: 0)
            guard hardware.sampleRate > 0, hardware.channelCount > 0,
                  format.channelCount > 0, format.commonFormat == .pcmFormatFloat32,
                  format.sampleRate == hardware.sampleRate else { throw DriverError.invalidFormat }
            sampleRate = format.sampleRate
            let inputRing = PracticeInputRing()
            ring = inputRing
            shapeMagnitudes = [Double](repeating: 0, count: 256)
            micGeneration += 1
            let generation = micGeneration
            engine = fresh
            frameHandler = onFrame
            interruptionHandler = onInterruption
            input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, time in
                inputRing.append(buffer, time: time)
            }
            tapInstalled = true
            fresh.prepare()
            try fresh.start()
            micLive = true
            meter = Timer.scheduledTimer(withTimeInterval: 1.0 / 60.0, repeats: true) { [weak self] _ in
                Task { @MainActor in self?.emitFrame(generation: generation) }
            }
        } catch {
            stopInput()
            sessionOff()
            throw error
        }
    }

    /// The recognizer shares the existing input tap; it cannot open another mic.
    /// Refusing on-device support is final—there is no server fallback.
    public func startRecognition(words: [String], maxMilliseconds: Double) async -> Bool {
        guard micLive, !Task.isCancelled, !recognitionStopping,
              let recognizer, recognizer.supportsOnDeviceRecognition,
              SFSpeechRecognizer.authorizationStatus() == .authorized,
              maxMilliseconds.isFinite, maxMilliseconds > 0 else { return false }
        settleRecognition()
        recognitionGeneration += 1
        let generation = recognitionGeneration
        recognitionText = ""
        recognitionEnded = false
        recognitionHadStarted = true
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.requiresOnDeviceRecognition = true
        request.shouldReportPartialResults = true
        if #available(iOS 16, *) { request.addsPunctuation = false }
        request.contextualStrings = Array(words.prefix(64))
        recognitionRequest = request
        ring?.attach(request)
        recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
            Task { @MainActor in
                guard let self, generation == self.recognitionGeneration else { return }
                if let result { self.recognitionText = result.bestTranscription.formattedString }
                if result?.isFinal == true || error != nil {
                    self.ring?.attach(nil)
                    self.recognitionEnded = true
                    self.recognitionTask = nil
                    self.recognitionRequest = nil
                    if self.recognitionStopping { self.settleRecognition() }
                }
            }
        }
        let duration = min(15_000, maxMilliseconds) / 1000
        recognitionDeadline = Timer.scheduledTimer(withTimeInterval: duration, repeats: false) { [weak self] _ in
            Task { @MainActor in self?.beginRecognitionStop() }
        }
        return true
    }

    /// Input is detached and stopped before waiting for Apple's final answer.
    /// Coalesced callers receive the same ephemeral transcript, at most 800 ms
    /// later. Neither a late final nor a stale audio chunk can change a new turn.
    public func closeMicrophone() async -> String {
        let hadRecognition = recognitionHadStarted
        stopInput()
        let text = await withCheckedContinuation { continuation in
            recognitionWaiters.append(continuation)
            beginRecognitionStop()
        }
        recognitionText = ""
        recognitionHadStarted = false
        sessionOff()
        return hadRecognition ? text : ""
    }

    public func setInterruptionHandler(_ handler: (@MainActor () -> Void)?) {
        sessionInterruptionHandler = handler
    }

    public func playPrompt(_ prompt: PracticePrompt) async throws {
        stopPlayback()
        let generation = playbackGeneration
        guard !micLive, engine == nil, !recognitionStopping, !Task.isCancelled else {
            throw DriverError.unavailable
        }
        guard !prompt.isMuted else { return }
        // Assets must be bundled/cached by the app before a turn starts. No
        // remote URL is accepted, including a URL accidentally passed as a part.
        guard prompt.parts.allSatisfy({ $0.fileURL.isFileURL }) else { throw DriverError.playbackFailed }
        let audio = AVAudioSession.sharedInstance()
        try audio.setCategory(.soloAmbient, mode: .default, options: [])
        try audio.setActive(true)
        for part in prompt.parts {
            guard generation == playbackGeneration, !Task.isCancelled else { throw CancellationError() }
            let sound = try AVAudioPlayer(contentsOf: part.fileURL)
            sound.delegate = self
            sound.enableRate = true
            sound.rate = part.rate
            sound.volume = 0.8
            sound.prepareToPlay()
            player = sound
            try await withTaskCancellationHandler(operation: {
                try await withCheckedThrowingContinuation { continuation in
                    playbackContinuation = continuation
                    guard sound.play() else { finishPlayback(error: DriverError.playbackFailed); return }
                    // AVAudioPlayer reports start failure synchronously. A
                    // missing completion still cannot strand the child's turn.
                    let cap = min(30, max(1, sound.duration / Double(max(part.rate, 0.01)) + 1))
                    playbackDeadline = Timer.scheduledTimer(withTimeInterval: cap, repeats: false) { [weak self] _ in
                        Task { @MainActor in
                            guard let self, generation == self.playbackGeneration else { return }
                            self.finishPlayback(error: DriverError.playbackFailed)
                        }
                    }
                }
            }, onCancel: { [weak self] in
                Task { @MainActor in
                    guard let self, generation == self.playbackGeneration else { return }
                    self.stopPlayback()
                }
            })
        }
        // Keep the solo session until capture starts, so another app's music
        // cannot restart in the 250 ms quiet tail and enter the new microphone.
    }

    public func stopPlayback() {
        playbackGeneration += 1
        finishPlayback(error: CancellationError())
    }

    private func finishPlayback(error: Error?, mediaReset: Bool = false) {
        playbackDeadline?.invalidate(); playbackDeadline = nil
        if !mediaReset { player?.stop(); player?.delegate = nil }
        player = nil
        let continuation = playbackContinuation
        playbackContinuation = nil
        if let error { continuation?.resume(throwing: error) }
        else { continuation?.resume() }
    }

    private func stopInput(mediaReset: Bool = false) {
        micGeneration += 1
        micLive = false
        meter?.invalidate(); meter = nil
        frameHandler = nil
        ring?.deactivate()
        if !mediaReset, let engine {
            if engine.isRunning { engine.stop() }
            if tapInstalled { engine.inputNode.removeTap(onBus: 0) }
        }
        tapInstalled = false
        engine = nil
        ring = nil
    }

    private func beginRecognitionStop() {
        recognitionDeadline?.invalidate(); recognitionDeadline = nil
        ring?.attach(nil)
        guard !recognitionEnded, recognitionTask != nil else { settleRecognition(); return }
        guard !recognitionStopping else { return }
        recognitionStopping = true
        recognitionRequest?.endAudio()
        recognitionTask?.finish()
        recognitionSettle = Timer.scheduledTimer(withTimeInterval: 0.8, repeats: false) { [weak self] _ in
            Task { @MainActor in self?.settleRecognition() }
        }
    }

    private func settleRecognition() {
        recognitionDeadline?.invalidate(); recognitionDeadline = nil
        recognitionSettle?.invalidate(); recognitionSettle = nil
        ring?.attach(nil)
        recognitionTask?.cancel(); recognitionTask = nil
        recognitionRequest = nil
        recognitionEnded = true
        recognitionStopping = false
        // Invalidate even an Apple callback already queued to main.
        recognitionGeneration += 1
        let waiting = recognitionWaiters
        recognitionWaiters = []
        for continuation in waiting { continuation.resume(returning: recognitionText) }
    }

    private func interrupt(mediaReset: Bool = false) {
        // The 250 ms tail and a pending permission are still part of the turn.
        // Siri in that gap must pause it before a new mic can open.
        guard sessionInterruptionHandler != nil || micLive || player != nil || recognitionTask != nil else { return }
        let callback = sessionInterruptionHandler ?? interruptionHandler
        playbackGeneration += 1
        finishPlayback(error: CancellationError(), mediaReset: mediaReset)
        stopInput(mediaReset: mediaReset)
        if mediaReset { settleRecognition() }
        else { beginRecognitionStop() }
        sessionOff()
        // No observer opens the mic. Returning to foreground is a state only;
        // the session must wait for the child's explicit Resume tap.
        callback?()
    }

    private func sessionOff() {
        let audio = AVAudioSession.sharedInstance()
        try? audio.setActive(false, options: .notifyOthersOnDeactivation)
        try? audio.setCategory(.ambient, mode: .default, options: [])
    }

    private func observe(_ name: Notification.Name, handler: @escaping @MainActor (ApplePracticeAudioDriver, Notification) -> Void) {
        observers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak self] note in
            Task { @MainActor in if let self { handler(self, note) } }
        })
    }

    private func observe(_ name: Notification.Name, handler: @escaping @MainActor (ApplePracticeAudioDriver) -> Void) {
        observe(name) { driver, _ in handler(driver) }
    }

    private func emitFrame(generation: Int) {
        guard micLive, generation == micGeneration, let ring else { return }
        let now = ProcessInfo.processInfo.systemUptime * 1000
        let evidenceSize = sampleRate >= 88_200 ? 2048 : sampleRate >= 32_000 ? 1024 : 512
        let snapshot = ring.drain(windowSize: evidenceSize)
        if now - snapshot.lastMilliseconds > 2_000 {
            interrupt()
            return
        }
        // A callback can contain 100 ms or more of input. Process each PCM
        // position once; polling the same last buffer would manufacture both
        // four loud frames and 45 ms of evidence from one stale snapshot.
        for slice in snapshot.frames {
            guard micLive, generation == micGeneration else { return }
            analyse(slice)
        }
    }

    private func analyse(_ slice: PracticePCMWindowStream.Slice) {
        if !slice.isAvailable { shapeMagnitudes = [Double](repeating: 0, count: 256) }
        let evidenceSamples = slice.samples
        let energySamples = Array(evidenceSamples.suffix(512))
        let evidenceSpectrum = PracticeWebAnalyser.magnitudes(evidenceSamples)
        let shapeSpectrum = PracticeWebAnalyser.magnitudes(energySamples)
        var bytes = [UInt8](repeating: 0, count: 256)
        for i in bytes.indices {
            shapeMagnitudes[i] = 0.8 * shapeMagnitudes[i] + 0.2 * shapeSpectrum[i]
            let db = 20 * log10(max(shapeMagnitudes[i], 1e-20))
            bytes[i] = UInt8(min(255, max(0, floor((db + 100) * 255 / 70))))
        }
        // charge.html's energy analyser uses byte time-domain samples, while
        // speechEvidence reads Float32 samples from its larger unsmoothed FFT.
        frameHandler?(PracticeAcousticFrame(
            timestampMilliseconds: slice.timestampMilliseconds, sampleRate: sampleRate,
            samples: evidenceSamples,
            spectrumDecibels: evidenceSpectrum.map { Float(20 * log10(max($0, 1e-20))) },
            energyRMS: PracticeWebAnalyser.byteEnergyRMS(energySamples),
            shapeSpectrumBytes: bytes, isAvailable: slice.isAvailable
        ))
    }
}

extension ApplePracticeAudioDriver: AVAudioPlayerDelegate {
    nonisolated public func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor [weak self] in
            guard let self, self.player === player else { return }
            self.finishPlayback(error: flag ? nil : DriverError.playbackFailed)
        }
    }

    nonisolated public func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: Error?) {
        Task { @MainActor [weak self] in
            guard let self, self.player === player else { return }
            self.finishPlayback(error: DriverError.playbackFailed)
        }
    }
}

/// The input tap and the main-thread analyser share only this short-lived ring.
/// Appending and detaching a recognition request share a lock: no buffer can
/// reach that request after endAudio(), including a tap already in flight.
private final class PracticeInputRing: @unchecked Sendable {
    private let lock = NSLock()
    private var stream = PracticePCMWindowStream()
    private var active = true
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var lastMilliseconds = ProcessInfo.processInfo.systemUptime * 1000

    func append(_ buffer: AVAudioPCMBuffer, time: AVAudioTime) {
        lock.lock(); defer { lock.unlock() }
        guard active, buffer.frameLength > 0, let channels = buffer.floatChannelData else { return }
        request?.append(buffer)
        let stride = buffer.stride
        let count = Int(buffer.frameLength)
        let samples = (0..<count).map { channels[0][$0 * stride] }
        let began = time.isHostTimeValid ? AVAudioTime.seconds(forHostTime: time.hostTime) * 1000
            : ProcessInfo.processInfo.systemUptime * 1000 - Double(count) * 1000 / buffer.format.sampleRate
        stream.append(samples, sampleRate: buffer.format.sampleRate, startedAtMilliseconds: began)
        lastMilliseconds = ProcessInfo.processInfo.systemUptime * 1000
    }

    func attach(_ request: SFSpeechAudioBufferRecognitionRequest?) {
        lock.lock(); defer { lock.unlock() }
        self.request = active ? request : nil
    }

    func deactivate() {
        lock.lock(); defer { lock.unlock() }
        active = false
        request = nil
        stream = PracticePCMWindowStream()
    }

    func drain(windowSize: Int) -> (frames: [PracticePCMWindowStream.Slice], lastMilliseconds: Double) {
        lock.lock(); defer { lock.unlock() }
        return (stream.drain(windowSize: windowSize), lastMilliseconds)
    }
}
#endif

/// WebAudio AnalyserNode's Blackman window (alpha .16), forward DFT, 1/N
/// magnitude normalization. The byte analyser adds its .8 smoothing above;
/// the independent speech-evidence analyser deliberately adds none.
enum PracticeWebAnalyser {
    static func byteEnergyRMS(_ samples: [Float]) -> Double {
        guard !samples.isEmpty else { return 0 }
        let power = samples.reduce(0.0) { sum, value in
            let byte = min(255, max(0, floor(128 * (1 + Double(value)))))
            let quantized = (byte - 128) / 128
            return sum + quantized * quantized
        }
        return sqrt(power / Double(samples.count))
    }

    static func magnitudes(_ samples: [Float]) -> [Double] {
        let count = samples.count
        guard count > 0, count & (count - 1) == 0 else { return [] }
        var real = [Double](repeating: 0, count: count)
        var imaginary = real
        for i in 0..<count {
            let angle = 2 * Double.pi * Double(i) / Double(count)
            real[i] = Double(samples[i]) * (0.42 - 0.5 * cos(angle) + 0.08 * cos(2 * angle))
        }
        var j = 0
        for i in 1..<count {
            var bit = count >> 1
            while j & bit != 0 { j ^= bit; bit >>= 1 }
            j ^= bit
            if i < j { real.swapAt(i, j); imaginary.swapAt(i, j) }
        }
        var width = 2
        while width <= count {
            let angle = -2 * Double.pi / Double(width)
            let baseReal = cos(angle), baseImaginary = sin(angle)
            for start in stride(from: 0, to: count, by: width) {
                var rootReal = 1.0, rootImaginary = 0.0
                for offset in 0..<(width / 2) {
                    let a = start + offset, b = a + width / 2
                    let productReal = rootReal * real[b] - rootImaginary * imaginary[b]
                    let productImaginary = rootReal * imaginary[b] + rootImaginary * real[b]
                    real[b] = real[a] - productReal; imaginary[b] = imaginary[a] - productImaginary
                    real[a] += productReal; imaginary[a] += productImaginary
                    let next = rootReal * baseReal - rootImaginary * baseImaginary
                    rootImaginary = rootReal * baseImaginary + rootImaginary * baseReal; rootReal = next
                }
            }
            width <<= 1
        }
        return (0..<(count / 2)).map { hypot(real[$0], imaginary[$0]) / Double(count) }
    }
}

/// Distinct, 60-Hz analysis positions in a bounded in-memory PCM ring. Timing
/// comes from captured samples, not how often the UI polls a tap buffer. A
/// discontinuous input or an overrun emits unavailable input before fresh PCM.
struct PracticePCMWindowStream {
    struct Slice {
        let samples: [Float]
        let timestampMilliseconds: Double
        let isAvailable: Bool
    }

    private let capacity = 32_768
    private var storage = [Float](repeating: 0, count: 32_768)
    private var written = 0
    private var frameIndex = 1
    private var sampleRate: Double = 0
    private var originMilliseconds: Double?
    private var discontinuity = false

    mutating func append(_ samples: [Float], sampleRate rate: Double, startedAtMilliseconds began: Double) {
        guard rate.isFinite, rate > 0, began.isFinite, !samples.isEmpty else { return }
        if let originMilliseconds {
            let expected = originMilliseconds + Double(written) * 1000 / sampleRate
            if sampleRate != rate || abs(expected - began) > 30 {
                storage = [Float](repeating: 0, count: capacity)
                written = 0; frameIndex = 1
                self.originMilliseconds = began
                discontinuity = true
            }
        } else { originMilliseconds = began }
        sampleRate = rate
        for sample in samples {
            storage[written % capacity] = sample.isFinite ? sample : 0
            written += 1
        }
    }

    mutating func drain(windowSize: Int) -> [Slice] {
        guard let originMilliseconds, sampleRate > 0, windowSize > 0, windowSize <= capacity else { return [] }
        var result: [Slice] = []
        func unavailable(_ at: Double) -> Slice {
            Slice(samples: [Float](repeating: 0, count: windowSize), timestampMilliseconds: at, isAvailable: false)
        }
        if discontinuity {
            result.append(unavailable(originMilliseconds))
            discontinuity = false
        }
        let oldest = max(0, written - capacity)
        var end = Int(floor(Double(frameIndex) * sampleRate / 60))
        if oldest > 0, end - windowSize < oldest {
            result.append(unavailable(originMilliseconds + Double(oldest) * 1000 / sampleRate))
            frameIndex = Int(ceil(Double(oldest + windowSize) * 60 / sampleRate))
            end = Int(floor(Double(frameIndex) * sampleRate / 60))
        }
        while end <= written {
            let samples = ((end - windowSize)..<end).map { index -> Float in
                index < 0 ? 0 : storage[index % capacity]
            }
            result.append(Slice(samples: samples,
                                timestampMilliseconds: originMilliseconds + Double(end) * 1000 / sampleRate,
                                isAvailable: true))
            frameIndex += 1
            end = Int(floor(Double(frameIndex) * sampleRate / 60))
        }
        return result
    }
}

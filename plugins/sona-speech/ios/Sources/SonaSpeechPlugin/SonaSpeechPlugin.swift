import Foundation
import Capacitor
import Speech
import AVFoundation

/**
 * SonaSpeech — on-device speech recognition for the practice gate.
 *
 * THE ONE RULE THIS PLUGIN EXISTS TO KEEP: no audio ever leaves the device.
 * Every recognition request sets requiresOnDeviceRecognition = true, and if
 * the device or language cannot do on-device recognition, the plugin reports
 * UNAVAILABLE and refuses to start — it never falls back to Apple's servers.
 * The web layer then uses its own spectral check instead. Fail closed.
 *
 * The plugin returns raw transcripts only. The pass/fail decision — what
 * counts as an attempt at the target sound — lives in sona.js, deliberately:
 * that is clinical logic, it is Rachel's to tune, and keeping it in the web
 * layer means tuning it never needs an App Store review.
 *
 * Xcode side (see SPEECH_PLUGIN.md at the repo root):
 *   - Info.plist needs NSSpeechRecognitionUsageDescription (the copy must say
 *     recognition happens on the device).
 *   - NSMicrophoneUsageDescription is already present for the practice mic.
 */
@objc(SonaSpeechPlugin)
public class SonaSpeechPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SonaSpeechPlugin"
    public let jsName = "SonaSpeech"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "available", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
    ]

    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private let audioEngine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var latestText: String = ""
    private var stopTimer: Timer?
    // Each start() opens a new session. A callback from an older one (Apple
    // can answer late) is ignored, so it can never end or overwrite the next.
    private var session = 0
    // stop() calls waiting for Apple's final transcript, and the short wait for it
    private var waiting: [CAPPluginCall] = []
    private var settleTimer: Timer?

    /**
     * available(): can this device do ON-DEVICE recognition right now?
     * Reports { available, onDevice, authorized }. `available` is only true
     * when all three hold — the caller never has to remember to check
     * onDevice separately, which is how a server fallback would sneak in.
     */
    @objc func available(_ call: CAPPluginCall) {
        let rec = recognizer
        let onDevice = rec?.supportsOnDeviceRecognition ?? false
        let auth = SFSpeechRecognizer.authorizationStatus()
        call.resolve([
            "available": (rec != nil) && onDevice && auth == .authorized,
            "onDevice": onDevice,
            "authorized": auth == .authorized,
            "denied": auth == .denied || auth == .restricted,
        ])
    }

    /** One OS dialog. The web layer asks right after the mic grant, so a
     *  family meets both prompts at setup rather than mid-round. */
    @objc func requestPermission(_ call: CAPPluginCall) {
        SFSpeechRecognizer.requestAuthorization { status in
            DispatchQueue.main.async {
                call.resolve(["granted": status == .authorized])
            }
        }
    }

    /**
     * start({ words?: string[], maxMs?: number })
     * Begins a bounded on-device recognition session. Emits "partial"
     * events ({ text }) as the transcript firms up; auto-stops at maxMs
     * (default 8000, capped at 15000) so an abandoned round cannot hold the
     * audio session. `words` biases the recognizer toward the practice
     * vocabulary (contextualStrings) — a big accuracy win for single words.
     */
    @objc func start(_ call: CAPPluginCall) {
        // Everything runs on the main thread, so a stop, a late answer from
        // Apple and the next start can never interleave.
        DispatchQueue.main.async { self.begin(call) }
    }

    private func begin(_ call: CAPPluginCall) {
        // One session at a time: close the last one first, and forget what it
        // heard, so a start that fails below can never hand back an old word.
        settle()
        session += 1
        let mine = session
        latestText = ""
        guard let rec = recognizer, rec.supportsOnDeviceRecognition else {
            call.reject("on-device recognition unavailable")   // FAIL CLOSED
            return
        }
        guard SFSpeechRecognizer.authorizationStatus() == .authorized else {
            call.reject("not authorized")
            return
        }

        let req = SFSpeechAudioBufferRecognitionRequest()
        req.requiresOnDeviceRecognition = true                  // THE RULE
        req.shouldReportPartialResults = true
        if #available(iOS 16, *) { req.addsPunctuation = false }
        if let words = call.getArray("words", String.self), !words.isEmpty {
            req.contextualStrings = Array(words.prefix(64))
        }
        request = req

        let audio = AVAudioSession.sharedInstance()
        do {
            // mixWithOthers: the WKWebView holds its own getUserMedia stream for
            // the rep counter, and TTS plays through the same session. Options
            // chosen to coexist rather than steal. THE THING TO TEST ON A REAL
            // PHONE FIRST: that starting this tap does not silence the page's
            // VAD stream (see SPEECH_PLUGIN.md, "Device test checklist").
            try audio.setCategory(.playAndRecord, mode: .measurement,
                                  options: [.mixWithOthers, .defaultToSpeaker, .allowBluetooth])
            try audio.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            call.reject("audio session: \(error.localizedDescription)")
            return
        }

        let input = audioEngine.inputNode
        let format = input.outputFormat(forBus: 0)
        guard format.sampleRate > 0 else {
            call.reject("no input")
            return
        }
        input.removeTap(onBus: 0)
        // The tap feeds this session's own request, never whatever `request`
        // holds by then: it runs on the audio thread, and the tap is always
        // removed before the request is ended.
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            req.append(buffer)
        }

        task = rec.recognitionTask(with: req) { [weak self] result, error in
            DispatchQueue.main.async {
                guard let self = self, self.session == mine else { return }
                if let r = result {
                    self.latestText = r.bestTranscription.formattedString
                    self.notifyListeners("partial", data: ["text": self.latestText])
                    if r.isFinal { self.recognitionEnded() }
                }
                if error != nil { self.recognitionEnded() }
            }
        }

        do {
            audioEngine.prepare()
            try audioEngine.start()
        } catch {
            settle()
            call.reject("audio engine: \(error.localizedDescription)")
            return
        }

        let maxMs = min(max(call.getInt("maxMs") ?? 8000, 1000), 15000)
        stopTimer?.invalidate()
        stopTimer = Timer.scheduledTimer(withTimeInterval: Double(maxMs) / 1000.0, repeats: false) { [weak self] _ in
            self?.beginStop(nil)
        }
        call.resolve(["started": true])
    }

    /** stop(): ends the session and resolves { text, onDevice: true } with
     *  Apple's final transcript. Safe to call when nothing is running. */
    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async { self.beginStop(call) }
    }

    private func haltAudio() {
        stopTimer?.invalidate(); stopTimer = nil
        if audioEngine.isRunning {
            audioEngine.stop()
            audioEngine.inputNode.removeTap(onBus: 0)
        }
    }

    /**
     * Stop listening, then give Apple a moment to finish. The transcript it has
     * while audio is still arriving is only a partial guess; its final one
     * comes after endAudio(). Answering at once (as the first version did) lost
     * a word said at the end of a listen, which the page then had to judge by
     * the looser sound-shape check.
     */
    private func beginStop(_ call: CAPPluginCall?) {
        if let c = call { waiting.append(c) }
        haltAudio()
        guard task != nil else { settle(); return }             // nothing left to finish
        if settleTimer != nil { return }                        // already waiting
        request?.endAudio()
        task?.finish()
        settleTimer = Timer.scheduledTimer(withTimeInterval: 0.8, repeats: false) { [weak self] _ in
            self?.settle()
        }
    }

    /** Apple delivered its final transcript, or gave up with an error. */
    private func recognitionEnded() {
        task = nil
        request = nil
        if settleTimer != nil { settle() }                      // a stop() was waiting for this
    }

    /** Answer every waiting stop() with the best transcript heard, and let the
     *  page's own audio (Echo's voice, sounds) have the session back. */
    private func settle() {
        settleTimer?.invalidate(); settleTimer = nil
        haltAudio()
        task?.cancel()                                          // no final in time: stop working on it
        task = nil
        request = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        let calls = waiting
        waiting = []
        for c in calls { c.resolve(["text": latestText, "onDevice": true]) }
    }
}

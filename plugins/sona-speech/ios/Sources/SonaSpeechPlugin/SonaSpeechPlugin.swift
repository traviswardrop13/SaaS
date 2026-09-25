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
    private var stopCall: CAPPluginCall?

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
        guard let rec = recognizer, rec.supportsOnDeviceRecognition else {
            call.reject("on-device recognition unavailable")   // FAIL CLOSED
            return
        }
        guard SFSpeechRecognizer.authorizationStatus() == .authorized else {
            call.reject("not authorized")
            return
        }
        stopInternal(resolveWith: nil)                          // one session at a time

        let req = SFSpeechAudioBufferRecognitionRequest()
        req.requiresOnDeviceRecognition = true                  // THE RULE
        req.shouldReportPartialResults = true
        if #available(iOS 16, *) { req.addsPunctuation = false }
        if let words = call.getArray("words", String.self), !words.isEmpty {
            req.contextualStrings = Array(words.prefix(64))
        }
        request = req
        latestText = ""

        let session = AVAudioSession.sharedInstance()
        do {
            // mixWithOthers: the WKWebView holds its own getUserMedia stream for
            // the rep counter, and TTS plays through the same session. Options
            // chosen to coexist rather than steal. THE THING TO TEST ON A REAL
            // PHONE FIRST: that starting this tap does not silence the page's
            // VAD stream (see SPEECH_PLUGIN.md, "Device test checklist").
            try session.setCategory(.playAndRecord, mode: .measurement,
                                    options: [.mixWithOthers, .defaultToSpeaker, .allowBluetooth])
            try session.setActive(true, options: .notifyOthersOnDeactivation)
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
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            self?.request?.append(buffer)
        }

        task = rec.recognitionTask(with: req) { [weak self] result, error in
            guard let self = self else { return }
            if let r = result {
                self.latestText = r.bestTranscription.formattedString
                self.notifyListeners("partial", data: ["text": self.latestText])
                if r.isFinal { self.finishTask() }
            }
            if error != nil { self.finishTask() }
        }

        do {
            audioEngine.prepare()
            try audioEngine.start()
        } catch {
            stopInternal(resolveWith: nil)
            call.reject("audio engine: \(error.localizedDescription)")
            return
        }

        let maxMs = min(max(call.getInt("maxMs") ?? 8000, 1000), 15000)
        DispatchQueue.main.async { [weak self] in
            self?.stopTimer?.invalidate()
            self?.stopTimer = Timer.scheduledTimer(withTimeInterval: Double(maxMs) / 1000.0, repeats: false) { _ in
                self?.stopInternal(resolveWith: nil)
            }
        }
        call.resolve(["started": true])
    }

    /** stop(): ends the session and resolves { text, onDevice: true } with the
     *  best transcript heard. Safe to call when nothing is running. */
    @objc func stop(_ call: CAPPluginCall) {
        stopInternal(resolveWith: call)
    }

    private func finishTask() {
        task = nil
        request = nil
    }

    private func stopInternal(resolveWith call: CAPPluginCall?) {
        stopTimer?.invalidate(); stopTimer = nil
        if audioEngine.isRunning {
            audioEngine.stop()
            audioEngine.inputNode.removeTap(onBus: 0)
        }
        request?.endAudio()
        task?.finish()
        finishTask()
        // deactivating lets the page's own audio (TTS, sfx) resume cleanly
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        call?.resolve(["text": latestText, "onDevice": true])
    }
}

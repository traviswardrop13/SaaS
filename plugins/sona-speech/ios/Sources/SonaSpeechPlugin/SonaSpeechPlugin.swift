import Foundation
import UIKit
import Capacitor
import Speech
import AVFoundation

/**
 * SonaSpeech — on-device speech recognition for the practice gate, and
 * (since Oct 2026) the app's own microphone.
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
 * SONA'S OWN MICROPHONE (micPermission, micOpen, micClose). While a web page
 * in the app captures with getUserMedia, WebKit puts its own audio session
 * into a phone call (PlayAndRecord, VideoChat, voice processing, hands-free
 * Bluetooth): the volume buttons move call volume, AirPods drop to call
 * quality. The app cannot change WebKit's session, so the page asks this
 * plugin for the mic instead. One AVAudioEngine, one tap on its input, in
 * .playAndRecord with mode .default, mixable, no hands-free Bluetooth, no
 * voice processing, active only while a listen is open. Each tap buffer goes
 * to the page as a "micpcm" event (mono Float32, base64) through Capacitor's
 * own bridge into this phone's web view, and to Apple's check when one is
 * attached. Nothing is written, kept or sent: there is no network or file
 * code in this file (heartest pins that). Native never reopens the mic by
 * itself; every open is the page's, after its own "Go!".
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
        CAPPluginMethod(name: "micPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "micOpen", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "micClose", returnType: CAPPluginReturnPromise),
    ]

    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    // A var: every stream gets a fresh engine (an old one can still report the
    // last route's format, and a tap at a stale format is a crash Swift cannot
    // catch), and so does a restart after a hardware change or a media reset.
    private var audioEngine = AVAudioEngine()
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

    // ── Sona's own microphone: main thread only ──
    private static let micVersion = 1
    private var micLive = false
    private var micGen = 0                     // which open the live stream is (the page's "g")
    private var micCap: Timer?
    private var micStall: Timer?
    private var micFrames: AVAudioFrameCount = 1024
    private var micRestarts = 0
    private var tapInstalled = false
    private var engineFromStream = false
    // ── read on the engine's tap thread too: only behind tapLock ──
    private let tapLock = NSLock()
    private var tapGen = -1                    // the open the tap streams for; -1 = not streaming
    private var tapSeq = 0
    private var tapLast: TimeInterval = 0
    private var tapRequest: SFSpeechAudioBufferRecognitionRequest?

    override public func load() {
        let nc = NotificationCenter.default
        nc.addObserver(self, selector: #selector(audioInterrupted(_:)), name: AVAudioSession.interruptionNotification, object: nil)
        nc.addObserver(self, selector: #selector(engineChanged(_:)), name: .AVAudioEngineConfigurationChange, object: nil)
        nc.addObserver(self, selector: #selector(mediaReset(_:)), name: AVAudioSession.mediaServicesWereResetNotification, object: nil)
        nc.addObserver(self, selector: #selector(wentBackground(_:)), name: UIApplication.didEnterBackgroundNotification, object: nil)
        nc.addObserver(self, selector: #selector(wentBackground(_:)), name: UIScene.didEnterBackgroundNotification, object: nil)
    }

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
     * start({ words?: string[], maxMs?: number, g?: number })
     * Begins a bounded on-device recognition session. Emits "partial"
     * events ({ text }) as the transcript firms up; auto-stops at maxMs
     * (default 8000, capped at 15000) so an abandoned round cannot hold the
     * audio session. `words` biases the recognizer toward the practice
     * vocabulary (contextualStrings) — a big accuracy win for single words.
     * `g`: the page listens through Sona's own mic, open number g. Apple then
     * hears that stream, or nothing: it never opens the mic the old way.
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
        // A page on Sona's own mic names its stream. If that stream has
        // closed, Apple does not listen at all: the old path below would open
        // the mic behind the page's back, in measurement mode with hands-free
        // Bluetooth (call-quality AirPods), for up to 15 s.
        let onStream = call.getInt("g")
        if let g = onStream, !(micLive && g == micGen) {
            call.reject("that microphone has closed", "nostream")
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

        if onStream == nil {
            // No stream named: a page on the web mic, an older sona.js, or the
            // NATIVE_MIC_ON = false switch. Exactly the path every build had.
            if micLive { closeMic("replaced") }                 // a stream nobody named is nobody's
            let audio = AVAudioSession.sharedInstance()
            do {
                // mixWithOthers: here the web view holds its own getUserMedia
                // stream for the rep counter; chosen to coexist, not steal
                // (SPEECH_PLUGIN.md, "Device test checklist": the web-mic item).
                try audio.setCategory(.playAndRecord, mode: .measurement,
                                      options: [.mixWithOthers, .defaultToSpeaker, .allowBluetooth])
                try audio.setActive(true, options: .notifyOthersOnDeactivation)
            } catch {
                call.reject("audio session: \(error.localizedDescription)")
                return
            }
            // A fresh engine every listen, its format read after the session
            // is set: sessionOff() now flips the category after each listen,
            // and a reused engine can still report the old route's rate
            // (AirPods in between), a tap at a stale format being a crash
            // Swift cannot catch. Refused instead, the page judges by sound.
            replaceEngine(); engineFromStream = false
            guard let format = checkedInputFormat() else {
                call.reject("no input")
                return
            }
            installTap(format: format, frames: 1024)
        }
        // The one tap feeds this request until haltAudio() detaches it, which
        // always happens before the request is ended.
        attachTap(req)

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

        if onStream == nil {
            do {
                audioEngine.prepare()
                try audioEngine.start()
            } catch {
                settle()
                call.reject("audio engine: \(error.localizedDescription)")
                return
            }
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
        detachTap()                                             // Apple's check hears nothing more
        if micLive { return }                                   // the stream keeps its engine, tap and session
        if audioEngine.isRunning { audioEngine.stop() }
        removeTap()                                             // also when iOS stopped the engine itself
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
        detachTap()                                             // a finished request is fed nothing more
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
        if !micLive { sessionOff() }                            // a live stream keeps the session
        let calls = waiting
        waiting = []
        for c in calls { c.resolve(["text": latestText, "onDevice": true]) }
    }

    // ── the one tap ──

    private func attachTap(_ req: SFSpeechAudioBufferRecognitionRequest?) {
        tapLock.lock(); tapRequest = req; tapLock.unlock()
    }

    private func detachTap() { attachTap(nil) }

    private func installTap(format: AVAudioFormat, frames: AVAudioFrameCount) {
        let input = audioEngine.inputNode
        input.removeTap(onBus: 0)                               // a second tap on bus 0 is a fatal assertion
        input.installTap(onBus: 0, bufferSize: frames, format: format) { [weak self] buffer, _ in
            self?.tapped(buffer)
        }
        tapInstalled = true
    }

    private func removeTap() {
        if tapInstalled { audioEngine.inputNode.removeTap(onBus: 0); tapInstalled = false }
    }

    /** A fresh engine; the old one is stopped and let go of. Never after a
     *  media reset: mediaReset() touches none of the old objects. */
    private func replaceEngine() {
        if audioEngine.isRunning { audioEngine.stop() }
        removeTap()
        audioEngine = AVAudioEngine()
    }

    /** The input's format, read after the session is set, and only if the
     *  tap can take it: a 0 Hz or channel-less format, or one that disagrees
     *  with the hardware's, is an assertion inside installTap or start(). */
    private func checkedInputFormat() -> AVAudioFormat? {
        let input = audioEngine.inputNode
        let hw = input.inputFormat(forBus: 0)
        let format = input.outputFormat(forBus: 0)
        guard hw.sampleRate > 0, hw.channelCount > 0, format.channelCount > 0, format.sampleRate == hw.sampleRate else { return nil }
        return format
    }

    /** The engine's tap thread. Copies the buffer at once (the engine reuses
     *  it), and hands the copy to the main thread. */
    private func tapped(_ buffer: AVAudioPCMBuffer) {
        tapLock.lock()
        tapRequest?.append(buffer)                              // under the lock: nothing reaches Apple after endAudio()
        let gen = tapGen
        let seq: Int
        if gen >= 0 { tapSeq += 1; seq = tapSeq; tapLast = ProcessInfo.processInfo.systemUptime } else { seq = 0 }
        tapLock.unlock()
        guard gen >= 0, buffer.frameLength > 0, buffer.format.commonFormat == .pcmFormatFloat32,
              let channels = buffer.floatChannelData else { return }
        let n = Int(buffer.frameLength)
        let hop = buffer.stride                                 // 1 for the engine's usual non-interleaved format
        let data: Data
        if hop == 1 {
            data = Data(bytes: channels[0], count: n * MemoryLayout<Float>.size)
        } else {
            var mono = [Float](repeating: 0, count: n)
            for i in 0..<n { mono[i] = channels[0][i * hop] }
            data = mono.withUnsafeBufferPointer { Data(buffer: $0) }
        }
        let b64 = data.base64EncodedString()
        let rate = buffer.format.sampleRate
        DispatchQueue.main.async { [weak self] in self?.deliver(gen, seq, rate, n, b64) }
    }

    /** Main thread: one chunk to the page, if the page is still there. */
    private func deliver(_ gen: Int, _ seq: Int, _ rate: Double, _ frames: Int, _ b64: String) {
        guard micLive, gen == micGen else { return }            // a chunk from an open already closed
        // Capacitor drops every listener when the page navigates or its web
        // process dies: the mic closes within one chunk of the page going.
        guard hasListeners("micpcm") else { closeMic("nolistener"); return }
        notifyListeners("micpcm", data: ["g": gen, "q": seq, "r": rate, "n": frames, "d": b64])
    }

    // ── permission: the same app-wide grant the web view's mic always used ──

    private func recordPermission() -> String {
        if #available(iOS 17.0, *) {
            switch AVAudioApplication.shared.recordPermission {
            case .granted:
                return "granted"
            case .denied:
                return "denied"
            default:
                return "prompt"
            }
        }
        switch AVAudioSession.sharedInstance().recordPermission {
        case .granted:
            return "granted"
        case .denied:
            return "denied"
        default:
            return "prompt"
        }
    }

    /** iOS answers on a thread of its own; done always runs on main. Each
     *  handler is written in place rather than shared as one stored closure:
     *  newer SDKs mark it @Sendable, and a literal is what converts cleanly. */
    private func askRecordPermission(_ done: @escaping (Bool) -> Void) {
        if #available(iOS 17.0, *) {
            AVAudioApplication.requestRecordPermission(completionHandler: { ok in
                DispatchQueue.main.async { done(ok) }
            })
        } else {
            AVAudioSession.sharedInstance().requestRecordPermission({ ok in
                DispatchQueue.main.async { done(ok) }
            })
        }
    }

    /** micPermission({ request? }) -> { state: granted | denied | prompt, v }.
     *  request: true shows iOS's dialog if it has never been answered. It
     *  never opens the mic. */
    @objc func micPermission(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let state = self.recordPermission()
            if state == "prompt" && call.getBool("request", false) {
                self.askRecordPermission { ok in
                    call.resolve(["state": ok ? "granted" : "denied", "v": SonaSpeechPlugin.micVersion])
                }
            } else {
                call.resolve(["state": state, "v": SonaSpeechPlugin.micVersion])
            }
        }
    }

    // ── the stream ──

    /**
     * micOpen({ maxMs, duck, speaker, ioMs, frames }) -> { g, sampleRate,
     * channels, mode, route, v }. Every knob comes from the website, so
     * tuning one is a web deploy. Rejection codes: "denied" (refused),
     * "busy" (iOS said not now: a call, Siri, the background), "nomic",
     * "engine" (a fault: the page uses the web mic), "nolistener" (no page
     * is subscribed to hear it).
     */
    @objc func micOpen(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.hasListeners("micpcm") else { call.reject("nobody is listening", "nolistener"); return }
            switch self.recordPermission() {
            case "granted":
                self.openMic(call)
            case "denied":
                call.reject("microphone not allowed", "denied")
            default:
                self.askRecordPermission { ok in
                    guard ok else { call.reject("microphone not allowed", "denied"); return }
                    // the dialog can be answered after the page has gone
                    guard self.hasListeners("micpcm") else { call.reject("nobody is listening", "nolistener"); return }
                    self.openMic(call)
                }
            }
        }
    }

    private func openMic(_ call: CAPPluginCall) {
        if UIApplication.shared.applicationState == .background {
            call.reject("Sona is in the background", "busy")
            return
        }
        if micLive { closeMic("replaced") }
        if task != nil || tapInstalled { settle() }             // an old-style check had the engine: it ends with what it heard
        let audio = AVAudioSession.sharedInstance()
        // Not the hands-free Bluetooth option (AirPods at call quality), not
        // a voice-chat, video-chat or measurement mode, no voice processing.
        // Mixable, because Echo's voice and the chimes play in WebKit's own
        // process, whose session does not mix.
        var options: AVAudioSession.CategoryOptions = [.mixWithOthers, .allowBluetoothA2DP]
        if call.getBool("speaker", true) { options.insert(.defaultToSpeaker) }
        if call.getBool("duck", false) { options.insert(.duckOthers) }
        do {
            try audio.setCategory(.playAndRecord, mode: .default, options: options)
        } catch {
            call.reject("audio session: \(error.localizedDescription)", "engine")
            return
        }
        let io = call.getInt("ioMs") ?? 0
        if io > 0 { try? audio.setPreferredIOBufferDuration(Double(min(max(io, 5), 100)) / 1000.0) }
        // A refused activation still leaves the category set above: put it back.
        do {
            try audio.setActive(true)
        } catch {
            sessionOff()
            call.reject("audio session: \(error.localizedDescription)", "busy")
            return
        }
        replaceEngine()
        engineFromStream = true
        guard let format = checkedInputFormat() else {
            sessionOff()
            call.reject("no microphone", "nomic")
            return
        }
        micGen += 1
        let gen = micGen
        micFrames = AVAudioFrameCount(min(max(call.getInt("frames") ?? 1024, 256), 8192))
        micRestarts = 0
        tapLock.lock(); tapGen = gen; tapSeq = 0; tapLast = ProcessInfo.processInfo.systemUptime; tapLock.unlock()
        installTap(format: format, frames: micFrames)
        do {
            audioEngine.prepare()
            try audioEngine.start()
        } catch {
            tapLock.lock(); tapGen = -1; tapLock.unlock()
            removeTap()
            sessionOff()
            call.reject("audio engine: \(error.localizedDescription)", busyError(error) ? "busy" : "engine")
            return
        }
        micLive = true
        let maxMs = min(max(call.getInt("maxMs") ?? 300000, 1000), 600000)
        micCap?.invalidate()
        micCap = Timer.scheduledTimer(withTimeInterval: Double(maxMs) / 1000.0, repeats: false) { [weak self] _ in
            _ = self?.closeMic("timeout")
        }
        micStall?.invalidate()
        micStall = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            self?.checkStall()
        }
        call.resolve(["g": gen, "sampleRate": format.sampleRate, "channels": Int(format.channelCount),
                      "mode": "default", "route": routeInfo(), "v": SonaSpeechPlugin.micVersion])
    }

    /** iOS's own "not now" codes, as the four-character codes NSError
     *  carries: '!pri' insufficientPriority, '!int' cannotInterruptOthers,
     *  '!act' isBusy, '!rec' cannotStartRecording, 'siri' siriIsRecording. */
    private func busyError(_ error: Error) -> Bool {
        let busy: Set<Int> = [561017449, 560557684, 560030580, 561145187, 1936290409]
        return busy.contains((error as NSError).code)
    }

    /** No buffer for 2 s while live: the engine has stopped without saying so. */
    private func checkStall() {
        guard micLive else { return }
        tapLock.lock(); let last = tapLast; tapLock.unlock()
        if ProcessInfo.processInfo.systemUptime - last > 2.0 { closeMic("stalled") }
    }

    /** Main thread; safe to call twice. Returns how long the close took, ms. */
    @discardableResult
    private func closeMic(_ reason: String) -> Double {
        guard micLive else { return 0 }
        let t0 = ProcessInfo.processInfo.systemUptime
        micLive = false
        let gen = micGen
        micGen += 1                                             // anything still on its way belongs to a closed open
        micCap?.invalidate(); micCap = nil
        micStall?.invalidate(); micStall = nil
        tapLock.lock(); tapGen = -1; tapLock.unlock()
        if task != nil { beginStop(nil) }                       // Apple's check finishes with what it heard
        if audioEngine.isRunning { audioEngine.stop() }
        removeTap()
        sessionOff()
        notifyListeners("micend", data: ["g": gen, "reason": reason, "v": SonaSpeechPlugin.micVersion])
        return (ProcessInfo.processInfo.systemUptime - t0) * 1000.0
    }

    /** micClose({ g?, all? }) -> { closed, ms, v }. Resolves once the engine
     *  is stopped, the tap removed and the session let go of. all: true (a
     *  page subscribing) also ends any Apple check a previous page left. */
    @objc func micClose(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let g = call.getInt("g")
            var ms = 0.0
            if self.micLive && (g == nil || g == self.micGen) { ms = self.closeMic("closed") }
            if call.getBool("all", false) && (self.task != nil || self.tapInstalled) { self.settle() }
            call.resolve(["closed": true, "ms": ms, "v": SonaSpeechPlugin.micVersion])
        }
    }

    /** Let go of the session. The app's own speech fallback (speechSynthesis,
     *  offline) plays on it, so it is left as plain media rather than a
     *  recording mode it would inherit (quiet, call-quality AirPods).
     *  .ambient, not .playback (15 Oct 2026, Travis: "Everything off" on
     *  silent): .ambient follows the ring/silent switch, so the robot voice is
     *  silent on a silenced phone like everything else; the page sets
     *  navigator.audioSession to "transient-solo" for WebKit's own sounds.
     *  Mixable by nature, so it can never interrupt WebKit's own session; not
     *  .soloAmbient, which does not mix and could. */
    private func sessionOff() {
        let audio = AVAudioSession.sharedInstance()
        try? audio.setActive(false, options: .notifyOthersOnDeactivation)
        try? audio.setCategory(.ambient, mode: .default, options: [])
    }

    private func routeInfo() -> [String: String] {
        let r = AVAudioSession.sharedInstance().currentRoute
        return [
            "input": r.inputs.first?.portName ?? "",
            "inputType": r.inputs.first?.portType.rawValue ?? "",
            "output": r.outputs.first?.portName ?? "",
            "outputType": r.outputs.first?.portType.rawValue ?? "",
        ]
    }

    // ── what iOS does to us ──

    @objc private func audioInterrupted(_ note: Notification) {
        guard let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
              let kind = AVAudioSession.InterruptionType(rawValue: raw) else { return }
        // A stale "began" delivered as the app comes back is not a call. The
        // reason key is iOS 14.5+, and the plugin's own package still says 14.
        if #available(iOS 14.5, *),
           let why = note.userInfo?[AVAudioSessionInterruptionReasonKey] as? UInt,
           AVAudioSession.InterruptionReason(rawValue: why) == .appWasSuspended { return }
        DispatchQueue.main.async {
            if kind == .began {
                self.closeMic("interrupted")
            } else if self.hasListeners("micready") {
                // the page may open again; it decides (it already holds this listen)
                self.notifyListeners("micready", data: ["reason": "interruption", "v": SonaSpeechPlugin.micVersion])
            }
        }
    }

    @objc private func engineChanged(_ note: Notification) {
        // Every engine in the app posts this one (object: nil): only ours counts.
        let changed = note.object as? AVAudioEngine
        DispatchQueue.main.async {                              // never inside the notification itself
            guard self.micLive, let e = changed, e === self.audioEngine else { return }
            self.restartMic()
        }
    }

    /** The hardware changed under a live stream (AirPods in or out): the
     *  same listen carries on, on a fresh engine at the new format, up to
     *  three times; then the page is told the mic is gone. */
    private func restartMic() {
        if task != nil { beginStop(nil) }                       // Apple is not handed a new format mid-request
        micRestarts += 1
        guard micRestarts <= 3 else { closeMic("route"); return }
        tapLock.lock(); tapGen = -1; tapLock.unlock()
        replaceEngine()
        guard let format = checkedInputFormat() else { closeMic("route"); return }
        tapLock.lock(); tapGen = micGen; tapLast = ProcessInfo.processInfo.systemUptime; tapLock.unlock()
        installTap(format: format, frames: micFrames)
        do {
            audioEngine.prepare()
            try audioEngine.start()
        } catch {
            closeMic("route")
            return
        }
        notifyListeners("microute", data: ["g": micGen, "sampleRate": format.sampleRate, "restarts": micRestarts,
                                           "route": routeInfo(), "v": SonaSpeechPlugin.micVersion])
    }

    @objc private func mediaReset(_ note: Notification) {
        DispatchQueue.main.async {
            // iOS rebuilt its media services: every audio object made before
            // is dead. Touch none of them; forget them.
            let wasLive = self.micLive
            let gen = self.micGen
            self.micLive = false
            if wasLive { self.micGen += 1 }
            self.micCap?.invalidate(); self.micCap = nil
            self.micStall?.invalidate(); self.micStall = nil
            self.tapLock.lock(); self.tapGen = -1; self.tapRequest = nil; self.tapLock.unlock()
            self.stopTimer?.invalidate(); self.stopTimer = nil
            self.settleTimer?.invalidate(); self.settleTimer = nil
            self.task?.cancel(); self.task = nil; self.request = nil
            self.tapInstalled = false
            self.engineFromStream = false
            self.audioEngine = AVAudioEngine()
            let calls = self.waiting
            self.waiting = []
            for c in calls { c.resolve(["text": self.latestText, "onDevice": true]) }
            if wasLive { self.notifyListeners("micend", data: ["g": gen, "reason": "reset", "v": SonaSpeechPlugin.micVersion]) }
        }
    }

    @objc private func wentBackground(_ note: Notification) {
        DispatchQueue.main.async { _ = self.closeMic("background") }
    }
}

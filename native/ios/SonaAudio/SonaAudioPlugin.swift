import Foundation
import AVFoundation
import Capacitor

/**
 * SonaAudio — native iOS microphone capture for Sona.
 *
 * Why this exists: the WebView microphone (getUserMedia) runs iOS's voice-call
 * DSP — automatic gain control, noise suppression, and a high-pass filter — which
 * strips the high-frequency energy that /s, z, sh, ch, th/ depend on, and encodes
 * lossy AAC. This plugin captures with AVAudioSession `.measurement` mode, which
 * DISABLES that processing, so SpeechAce (via /api/score) sees the real fricative
 * detail. It also avoids Safari's getUserMedia / autoplay flakiness.
 *
 * JS contract (matches public/sona.js -> Sona.captureClip):
 *   SonaAudio.record({ maxMs }) -> { wav: <base64 16-bit PCM WAV>, sampleRate, spoke }
 *   SonaAudio.stop()            -> resolves the in-flight record() immediately
 *
 * Registration: conforms to `CAPBridgedPlugin` (Capacitor 6+/Swift Package Manager
 * native). No Objective-C `.m` file or `CAP_PLUGIN` macro is needed — Capacitor
 * discovers the plugin at runtime from `jsName` + `pluginMethods` below.
 *
 * Note: written to be correct but it has NOT been compiled on a Mac yet — build
 * it in Xcode and test on a device. Multi-channel inputs use channel 0 (mono).
 */
@objc(SonaAudioPlugin)
public class SonaAudioPlugin: CAPPlugin, CAPBridgedPlugin {

    // MARK: - Capacitor bridge registration (replaces the old CAP_PLUGIN .m macro)
    public let identifier = "SonaAudioPlugin"
    public let jsName = "SonaAudio"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "record", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]

    private let engine = AVAudioEngine()
    private var pcm = Data()
    private var sampleRate: Double = 48000
    private var pending: CAPPluginCall?
    private var maxTimer: Timer?
    private var spoke = false
    private var lastVoice = Date()
    // pcm/spoke/lastVoice are written on the realtime audio thread (append) and
    // read on main (finish); serialize all access to avoid a data race.
    private let ioQueue = DispatchQueue(label: "com.speaksona.audio.io")
    // Recording generation: a stale queued finish() from a previous take must not
    // kill the next recording. Each record() bumps this; callbacks check it.
    private var gen = 0

    // MARK: - JS API

    @objc func record(_ call: CAPPluginCall) {
        // Don't overlap recordings.
        if pending != nil { call.reject("already-recording"); return }
        AVAudioSession.sharedInstance().requestRecordPermission { [weak self] granted in
            guard let self = self else { return }
            if !granted { call.reject("mic-permission-denied"); return }
            DispatchQueue.main.async { self.start(call) }
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async { self.finish() }
        call.resolve()
    }

    // MARK: - Capture

    private func start(_ call: CAPPluginCall) {
        pending = call
        gen += 1
        let myGen = gen
        ioQueue.sync { pcm.removeAll(keepingCapacity: true); spoke = false; lastVoice = Date() }
        let maxMs = call.getInt("maxMs") ?? 6000

        let session = AVAudioSession.sharedInstance()
        do {
            // .measurement = no AGC / noise-suppression / high-pass — raw mic.
            try session.setCategory(.record, mode: .measurement, options: [])
            try session.setActive(true, options: [])
        } catch {
            pending = nil
            call.reject("audio-session: \(error.localizedDescription)")
            return
        }

        let input = engine.inputNode
        let format = input.inputFormat(forBus: 0)   // typically float32, 44.1/48k
        sampleRate = format.sampleRate

        input.installTap(onBus: 0, bufferSize: 2048, format: format) { [weak self] buffer, _ in
            self?.append(buffer, gen: myGen)
        }

        do { try engine.start() } catch {
            input.removeTap(onBus: 0)
            try? session.setActive(false)
            pending = nil
            call.reject("engine: \(error.localizedDescription)")
            return
        }

        maxTimer = Timer.scheduledTimer(withTimeInterval: Double(maxMs) / 1000.0, repeats: false) { [weak self] _ in
            self?.finish(gen: myGen)
        }
    }

    private func append(_ buffer: AVAudioPCMBuffer, gen bufGen: Int) {
        guard let chans = buffer.floatChannelData else { return }
        let n = Int(buffer.frameLength)
        if n == 0 { return }
        var ints = [Int16](repeating: 0, count: n)
        var sum = 0.0
        let ch0 = chans[0]
        for i in 0..<n {
            var s = ch0[i]
            if s > 1 { s = 1 }; if s < -1 { s = -1 }
            ints[i] = Int16(s * 32767)
            sum += Double(s) * Double(s)
        }
        let rms = (sum / Double(n)).squareRoot()
        var ended = false
        ioQueue.sync {
            guard bufGen == gen else { return }   // stale buffer from a finished take
            if rms > 0.02 { spoke = true; lastVoice = Date() }
            ints.withUnsafeBytes { pcm.append(contentsOf: $0) }
            // Auto-stop ~0.9s after speech ends.
            if spoke && Date().timeIntervalSince(lastVoice) > 0.9 { ended = true }
        }
        if ended {
            DispatchQueue.main.async { [weak self] in self?.finish(gen: bufGen) }
        }
    }

    private func finish(gen finishGen: Int? = nil) {
        if let fg = finishGen, fg != gen { return }  // stale finish from a previous take
        guard let call = pending else { return }     // already finished
        pending = nil
        maxTimer?.invalidate(); maxTimer = nil
        engine.inputNode.removeTap(onBus: 0)
        if engine.isRunning { engine.stop() }
        try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])

        // Snapshot the shared buffer under the io queue (append writes it on the
        // audio thread) before reading it here on main.
        var pcmSnapshot = Data()
        var didSpeak = false
        ioQueue.sync { pcmSnapshot = pcm; didSpeak = spoke }
        let wav = SonaAudioPlugin.makeWav(pcm: pcmSnapshot, sampleRate: Int(sampleRate))
        call.resolve([
            "wav": wav.base64EncodedString(),
            "sampleRate": Int(sampleRate),
            "spoke": didSpeak
        ])
    }

    // MARK: - WAV (16-bit PCM, mono)

    private static func makeWav(pcm: Data, sampleRate: Int) -> Data {
        let channels = 1, bitsPerSample = 16
        let byteRate = sampleRate * channels * bitsPerSample / 8
        let blockAlign = channels * bitsPerSample / 8
        let dataLen = pcm.count
        var h = Data()
        func str(_ s: String) { h.append(s.data(using: .ascii)!) }
        func u32(_ v: UInt32) { var x = v.littleEndian; h.append(Data(bytes: &x, count: 4)) }
        func u16(_ v: UInt16) { var x = v.littleEndian; h.append(Data(bytes: &x, count: 2)) }
        str("RIFF"); u32(UInt32(36 + dataLen)); str("WAVE")
        str("fmt "); u32(16); u16(1); u16(UInt16(channels))
        u32(UInt32(sampleRate)); u32(UInt32(byteRate)); u16(UInt16(blockAlign)); u16(UInt16(bitsPerSample))
        str("data"); u32(UInt32(dataLen))
        var out = h; out.append(pcm); return out
    }
}

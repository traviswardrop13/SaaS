import Foundation

@MainActor final class FakeClock {
    var pending: [CheckedContinuation<Void, Never>] = []
    func wait(_ ms: Double) async { await withCheckedContinuation { pending.append($0) } }
    func advance() { let held = pending; pending = []; held.forEach { $0.resume() } }
}

@main struct MicrophoneChecks {
    @MainActor static func main() async {
        var count = 0
        func check(_ value: @autoclosure () -> Bool, _ label: String) {
            count += 1
            if !value() { fatalError("Setup microphone contract: " + label) }
        }
        func tick() async { for _ in 0..<20 { await Task.yield() } }

        let clock = FakeClock()
        var calls = 0, launches = 0
        let skipped = NativeSetupContinuationController(isCurrent: { true }, requestPermission: {
            calls += 1; return .granted
        }, wait: clock.wait) { launches += 1 }
        skipped.begin(); await tick()
        check(calls == 0 && skipped.phase == .microphone, "opening asks no permission")
        skipped.notNow()
        check(skipped.phase == .microphone, "entry tap settle prevents click-through")
        clock.advance(); await tick(); skipped.notNow(); await tick()
        check(calls == 0 && skipped.phase == .handoff, "Not now reaches the explicit handoff without requesting")
        skipped.play()
        check(launches == 0, "Not now double-tap cannot start the game")
        clock.advance(); await tick(); skipped.play(); skipped.play()
        check(launches == 1 && skipped.phase == .finished, "only explicit settled handoff starts once")

        let allowedClock = FakeClock()
        let allowed = NativeSetupContinuationController(isCurrent: { true }, requestPermission: {
            calls += 1; return .granted
        }, wait: allowedClock.wait) { launches += 1 }
        allowed.begin(); await tick(); allowedClock.advance(); await tick()
        allowed.allowMicrophone(); allowed.allowMicrophone(); await tick()
        check(calls == 1 && allowed.phase == .handoff, "one explicit Yes asks once and reaches handoff")
        check(launches == 1, "permission success never launches automatically")
        allowedClock.advance(); await tick(); allowed.play()
        check(launches == 2, "accepted permission still needs explicit Let's play")

        for outcome in [NativeSetupMicrophoneResult.denied, .unavailable] {
            let clock = FakeClock()
            let blocked = NativeSetupContinuationController(isCurrent: { true }, requestPermission: { outcome }, wait: clock.wait) {}
            blocked.begin(); await tick(); clock.advance(); await tick()
            blocked.allowMicrophone(); await tick()
            check(blocked.phase == (outcome == .denied ? .denied : .unavailable), "failed permission retains its distinct retry state")
            clock.advance(); await tick(); blocked.notNow()
            check(blocked.phase == .handoff, "failed permission can choose Not now")
            clock.advance(); await tick(); blocked.cancel()
        }

        var held: CheckedContinuation<NativeSetupMicrophoneResult, Never>?
        let heldClock = FakeClock()
        let pending = NativeSetupContinuationController(isCurrent: { true }, requestPermission: {
            await withCheckedContinuation { held = $0 }
        }, wait: heldClock.wait) { launches += 1 }
        pending.begin(); await tick(); heldClock.advance(); await tick()
        pending.allowMicrophone(); await tick()
        check(pending.phase == .requesting, "held OS answer remains requesting")
        pending.notNow(); await tick()
        check(pending.phase == .handoff, "Not now cancels an outstanding request")
        held?.resume(returning: .granted); held = nil; await tick()
        check(pending.phase == .handoff && launches == 2, "late permission cannot navigate or launch twice")
        heldClock.advance(); await tick(); pending.cancel()

        var live = true
        let switchedClock = FakeClock()
        let switched = NativeSetupContinuationController(isCurrent: { live }, requestPermission: {
            await withCheckedContinuation { held = $0 }
        }, wait: switchedClock.wait) { launches += 1 }
        switched.begin(); await tick(); switchedClock.advance(); await tick()
        switched.allowMicrophone(); await tick(); live = false
        held?.resume(returning: .granted); held = nil; await tick()
        check(switched.phase == .requesting && launches == 2, "an answer for another child cannot move this screen")
        switched.play(); switched.notNow()
        check(launches == 2, "all stale owner actions are inert")
        switched.cancel(); switchedClock.advance(); await tick()

        live = true
        let backgroundClock = FakeClock()
        let background = NativeSetupContinuationController(isCurrent: { live }, requestPermission: {
            await withCheckedContinuation { held = $0 }
        }, wait: backgroundClock.wait) { launches += 1 }
        background.begin(); await tick(); backgroundClock.advance(); await tick()
        background.allowMicrophone(); await tick(); background.background()
        check(background.phase == .microphone, "background cancels the pending setup ask")
        held?.resume(returning: .granted); held = nil; await tick()
        check(background.phase == .microphone && launches == 2, "backgrounded permission never opens a later step")
        backgroundClock.advance(); await tick(); background.cancel()
        print("Passed \(count) setup microphone/handoff checks; no microphone, OS prompt or network used.")
    }
}

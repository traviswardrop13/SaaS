import Foundation

/// Presentation time only. This has no connection to a practice ledger,
/// microphone, audio service, purchase, persistent store or network client.
enum NativeSetupDemoKind: String, CaseIterable { case fruit, piano }
enum NativeSetupDemoPhase: String { case normal, afterPractice }

struct NativeSetupDemoClock: Equatable {
    private(set) var phase: NativeSetupDemoPhase = .normal
    private(set) var mounted = false
    private(set) var foreground = false
    private(set) var reducedMotion = false
    private(set) var nextSwap: TimeInterval?
    var isAnimating: Bool { mounted && foreground && !reducedMotion }

    mutating func appear(now: TimeInterval, foreground: Bool, reducedMotion: Bool) {
        mounted = true
        self.foreground = foreground
        self.reducedMotion = reducedMotion
        phase = .normal
        arm(now)
    }
    mutating func disappear() {
        mounted = false
        foreground = false
        nextSwap = nil
    }
    mutating func setForeground(_ value: Bool, now: TimeInterval) {
        guard mounted else { return }
        // The browser destroys the mounted scene when hidden, then mounts a
        // fresh normal-speed scene when it returns. No background catch-up.
        foreground = value
        if value { phase = .normal }
        arm(now)
    }
    mutating func setReducedMotion(_ value: Bool, now: TimeInterval) {
        reducedMotion = value
        arm(now)
    }
    mutating func select(_ value: NativeSetupDemoPhase, now: TimeInterval) {
        guard mounted && foreground else { return }
        phase = value
        // A tap on either side, including the already-selected side, restarts
        // its full two seconds, like paintDemo -> demoCycle in onboarding.
        arm(now)
    }
    mutating func advance(now: TimeInterval) {
        guard isAnimating, now.isFinite, let due = nextSwap, now >= due else { return }
        phase = phase == .normal ? .afterPractice : .normal
        // A late frame changes once and starts a new interval. It cannot play
        // a burst of comparisons that would have occurred while not drawn.
        arm(now)
    }
    private mutating func arm(_ now: TimeInterval) {
        nextSwap = isAnimating && now.isFinite ? now + 2 : nil
    }
}

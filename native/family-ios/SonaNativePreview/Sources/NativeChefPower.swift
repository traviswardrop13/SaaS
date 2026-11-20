import Foundation

/// Finger-only assistance from public/pizza.js (rollingGain/brush/heatRate/
/// cutTolerance). These values cannot award speech, finish a cooking step,
/// or alter the original eight-step order.
enum NativeChefPower {
    static func rollingGain(powered: Bool) -> CGFloat { powered ? 1.8 : 1 }
    static func brushRadiusSquared(powered: Bool) -> CGFloat {
        let gain: CGFloat = powered ? 0.34 / 0.21 : 1
        return 0.015 * gain * gain
    }
    static func minimumCutAlignment(base: Double, powered: Bool) -> Double {
        powered ? min(base, cos(0.27)) : base
    }
    static func ovenTickNanoseconds(powered: Bool) -> UInt64 {
        powered ? 720_000_000 : 360_000_000 // source heatRate .14 vs .28
    }
}

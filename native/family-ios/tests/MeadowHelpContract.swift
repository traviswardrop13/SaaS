import Foundation
import Combine

@main struct MeadowHelpContract {
    static func main() {
        var checks = 0
        func check(_ value: Bool, _ message: String) { checks += 1; precondition(value, message) }
        check(MeadowHelpPhysics.pumpIncrement(powered: false) == 1 && MeadowHelpPhysics.pumpIncrement(powered: true) == 2, "A real pump doubles work only under source power")
        check(86 > 70 && CGFloat(86) < 70 * MeadowHelpPhysics.balloonRingScale(powered: true), "Big ring catches a near finger drop")
        check(MeadowHelpPhysics.rocketRadius(base: 72, powered: false) < 99 && MeadowHelpPhysics.rocketRadius(base: 72, powered: true) > 99, "Rocket power widens landing without automatically moving it")
        check(60 * MeadowHelpPhysics.snowGrowth(powered: true) == 120, "Snow help doubles actual rolling distance")
        check(0 * MeadowHelpPhysics.snowGrowth(powered: true) == 0, "Idle snow never grows")
        check(MeadowHelpPhysics.snowMagnet(base: 70, accessory: true, powered: false) < 88 && MeadowHelpPhysics.snowMagnet(base: 70, accessory: true, powered: true) > 88, "Snow clothing still needs a drop, with source larger magnet")
        check(MeadowHelpPhysics.starReach(base: 32, powered: false) < 45 && MeadowHelpPhysics.starReach(base: 32, powered: true) > 45, "Wide star path accepts a near trace without auto-lighting")
        check(abs(0.5 * MeadowHelpPhysics.stirGain(powered: true) - 0.85) < 0.0001, "Cake power boosts only actual stirring")
        check(MeadowHelpPhysics.cakeCatch(base: 65, width: 400, candles: false, powered: true) > 80, "Fruit catch uses source extra width")
        check(MeadowHelpPhysics.cakeCatch(base: 65, width: 400, candles: true, powered: true) > 78, "Candle catch uses source extra width")
        let power = MeadowOptionalPower()
        power.grant(); check(power.remaining == 10, "Source power duration starts at ten")
        power.tick(0.05, canAdvance: false); check(power.remaining == 10, "Word gate/background freezes power")
        power.tick(2, canAdvance: true); check(abs(power.remaining - 9.95) < 0.0001, "Late callback keeps source frame cap instead of burning paused time")
        power.grant(); power.tick(2, canAdvance: true, maximumDelta: 0.045)
        check(abs(power.remaining - 9.955) < 0.0001, "Rocket and Cake retain their source frame cap")
        power.grant(waitForTouch: true); power.tick(0.05, canAdvance: true)
        check(power.remaining == 10, "Snow power waits for a real first touch")
        power.touch(); power.tick(0.05, canAdvance: true)
        check(abs(power.remaining - 9.95) < 0.0001, "Actual touch starts Snow power clock")
        let remaining = power.remaining
        power.tick(-1, canAdvance: true); power.tick(.infinity, canAdvance: true)
        check(power.remaining == remaining, "Invalid time cannot alter power")
        for _ in 0..<210 { power.tick(0.05, canAdvance: true) }
        check(!power.active && power.remaining == 0, "Power expires without any progress callback")
        print("PASS: \(checks) Meadow optional-help interaction and clock checks")
    }
}

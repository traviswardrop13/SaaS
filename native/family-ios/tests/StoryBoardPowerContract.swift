import Foundation

@main struct StoryBoardPowerContract {
    static func main() {
        var checks = 0
        func check(_ value: Bool, _ message: String) { checks += 1; precondition(value, message) }
        func approximately(_ lhs: Double, _ rhs: Double) -> Bool { abs(lhs - rhs) < 0.000001 }

        var power = StoryMovePowerClock(duration: 12)
        power.observe(word: 0, playing: false, now: 0)
        power.grant(word: 0, earned: false)
        check(power.remaining == 0, "No power starts under a speaking gate")
        power.observe(word: 0, playing: true, now: 1)
        check(power.remaining == 12, "The accepted word starts the story power")
        power.observe(word: 0, playing: true, now: 1.50)
        check(approximately(power.remaining, 11.95), "A late frame spends at most one source-sized interval")
        power.observe(word: 0, playing: false, now: 5)
        power.observe(word: 0, playing: false, now: 80)
        power.grant(word: 0, earned: false)
        power.observe(word: 0, playing: true, now: 82)
        check(approximately(power.remaining, 11.95), "Pause, silence, decline, and resume neither spend nor refill the clock")
        power.grant(word: 0, earned: true)
        check(power.remaining == 12, "Accepted same-word help restores the full clock")
        power.observe(word: 1, playing: false, now: 84)
        power.grant(word: 0, earned: true)
        check(power.remaining == 0, "A late callback cannot give help to a different word")
        power.observe(word: 1, playing: true, now: 85)
        check(power.remaining == 12, "A new accepted word gets its own power")
        for frame in 1...300 {
            power.observe(word: 1, playing: true, now: 85 + Double(frame) * 0.05)
        }
        check(power.remaining == 0, "Twelve seconds of active play expire help")
        power.observe(word: nil, playing: false, now: 102)
        power.grant(word: 1, earned: true)
        check(power.remaining == 0, "Removing the word owner discards the clock")

        check(VillagePowerGeometry.troughCatch(powered: false) < 55 && VillagePowerGeometry.troughCatch(powered: true) > 55, "Wider leaves catch a near drop")
        check(approximately(Double(VillagePowerGeometry.currentScale(powered: true)), 0.18), "Calm water reduces actual steering drift")
        check(VillagePowerGeometry.pourCatch(powered: true) > 90 && VillagePowerGeometry.stirInner(powered: true) < 20, "Steady hands widen the jug and stirring paths")
        check(VillagePowerGeometry.bunCatch(powered: false) < 50 && VillagePowerGeometry.bunCatch(powered: true) > 50, "Steady hands widen bun shaping")
        for young in [false, true] {
            let ordinary = VillagePowerGeometry.heatBand(young: young, powered: false)
            let assisted = VillagePowerGeometry.heatBand(young: young, powered: true)
            check(approximately(ordinary.lowerBound - assisted.lowerBound, 0.08), "Both age branches widen actual oven heat by the shipping margin")
            check(approximately(assisted.upperBound - ordinary.upperBound, 0.08), "Both ends of the heat band widen")
            check(WorkshopPowerGeometry.trainBerth(young: young, powered: true) >
                  WorkshopPowerGeometry.trainBerth(young: young, powered: false), "Easy stops widen the berth")
            check(approximately(WorkshopPowerGeometry.liftDamping(young: young, powered: true) -
                                WorkshopPowerGeometry.liftDamping(young: young, powered: false), 7), "Steady lift damps the moving basket")
            check(approximately(WorkshopPowerGeometry.concertPeriod(young: young, powered: true) /
                                WorkshopPowerGeometry.concertPeriod(young: young, powered: false), 1.45), "Gentle beat slows the active timing period")
            check(WorkshopPowerGeometry.concertWindow(young: young, powered: true) >
                  WorkshopPowerGeometry.concertWindow(young: young, powered: false), "Gentle beat widens the actual note window")
            check(WorkshopPowerGeometry.gearCatch(young: young, powered: true) >
                  WorkshopPowerGeometry.gearCatch(young: young, powered: false), "Bright edges widen the catch on a matching gear")
        }
        check(VillagePowerGeometry.craneCatch(powered: false) < 50 && VillagePowerGeometry.craneCatch(powered: true) > 50, "Steady crane gives the hanging load a real wider landing")
        check(abs(VillagePowerGeometry.sway(previous: 10, travel: 15, powered: true)) <
              abs(VillagePowerGeometry.sway(previous: 10, travel: 15, powered: false)), "Steady crane damps actual hand-driven swing")
        check(VillagePowerGeometry.craneAngle(young: false, powered: true) == 21, "Steady crane adds the source's ten degrees of landing tolerance")
        check(VillagePowerGeometry.cartClearance(powered: true) > 50, "Steady cart widens the traversable strip")
        check(VillagePowerGeometry.socketCatch(powered: false) < 42 && VillagePowerGeometry.socketCatch(powered: true) > 42, "Light pulse widens the matching socket")
        check(approximately(WorkshopPowerGeometry.trainSpeed(powered: true), 0.58), "Easy stops slow manual movement")
        check(WorkshopPowerGeometry.railJoin(young: true, powered: true) > 23, "Easy stops widen a near rail join")
        check(WorkshopPowerGeometry.stitchCatch(powered: false) < 35 && WorkshopPowerGeometry.stitchCatch(powered: true) > 35, "Steady cloth catches a manual near trace")
        check(approximately(WorkshopPowerGeometry.clothFlutter(powered: true) /
                            WorkshopPowerGeometry.clothFlutter(powered: false), 0.08), "Steady cloth damps target flutter")
        check(approximately(WorkshopPowerGeometry.windScale(powered: true), 0.22), "Calm breeze affects flight and its preview")

        var flower = MeadowFlowerWater(count: 3)
        check(flower.capacity(powered: true) == 1.8 && flower.capacity(powered: false) == 1, "Gentle shower changes usable refill capacity")
        check(approximately(Double(flower.catchRadius(width: 375, powered: true) /
                                   flower.catchRadius(width: 375, powered: false)), 2), "Gentle shower doubles the catch width")
        check(!flower.pour(duration: 0, overSoil: true) && flower.reservoir == 1.8, "Idle water does nothing")
        check(flower.beginPour(powered: false), "Only picking up a full can starts a pour")
        check(!flower.pour(duration: 2, overSoil: false) && flower.reservoir < 1 && flower.grown == 0, "A real miss spills without growing a flower")
        check(flower.assistance == 2, "Repeated real misses activate the source's final guide")
        flower.refill(powered: false)
        check(flower.reservoir == 1 && !flower.pour(duration: 4, overSoil: true) && flower.grown == 0, "An unpowered can can empty before a flower is finished")
        check(flower.beginPour(powered: false) && flower.reservoir == 1, "A new pickup under the final guide refills an empty can")
        flower.refill(powered: true)
        check(flower.reservoir == 1.8, "Powered refill gives extra usable water without growing a flower")
        check(flower.pour(duration: 0.5, overSoil: true) && flower.grown == 1, "Only a real aimed pour may finish the flower")
        check(flower.amounts[1] == 0 && flower.reservoir == 1.8 && flower.assistance == 0,
              "Finishing a flower leaves the next seed untouched and resets assistance")
        var newFlower = MeadowFlowerWater(count: 1)
        _ = newFlower.pour(duration: 0.5, overSoil: false)
        check(newFlower.misses == 9 && newFlower.assistance == 1, "The ninth missed drop activates the widened guide")
        let radius = newFlower.catchRadius(width: 375, powered: false)
        check(newFlower.isAligned(canX: 37, spoutX: 58, soilX: 0, radius: radius),
              "The guide widens the actual alignment test")
        print("PASS: \(checks) story and Flower sound-power checks")
    }
}

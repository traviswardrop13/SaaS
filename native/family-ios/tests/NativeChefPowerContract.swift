import Foundation

@main struct NativeChefPowerContract {
    static func main() {
        let distance: CGFloat = 20
        precondition(distance * NativeChefPower.rollingGain(powered: false) == 20)
        precondition(distance * NativeChefPower.rollingGain(powered: true) == 36)
        precondition(CGFloat(0.02) > NativeChefPower.brushRadiusSquared(powered: false))
        precondition(CGFloat(0.02) < NativeChefPower.brushRadiusSquared(powered: true))
        let nearCut = cos(0.25)
        precondition(nearCut < NativeChefPower.minimumCutAlignment(base: 0.98, powered: false))
        precondition(nearCut > NativeChefPower.minimumCutAlignment(base: 0.98, powered: true))
        precondition(NativeChefPower.minimumCutAlignment(base: 0.84, powered: true) == 0.84, "Power cannot take away existing miss assistance")
        precondition(NativeChefPower.ovenTickNanoseconds(powered: true) == 2 * NativeChefPower.ovenTickNanoseconds(powered: false))
        precondition(CGFloat.zero * NativeChefPower.rollingGain(powered: true) == 0, "Power without a finger stroke adds no rolling work")
        print("PASS: 9 native chef-power interaction checks")
    }
}

import XCTest
import CryptoKit
@testable import SonaFamilyRules

final class NativeTreasureMotionTests: XCTestCase {
    private typealias Point = NativeTreasureMotion.Point
    private struct Reference: Decodable {
        struct Order: Decodable { let seed: Int; let order: [Int] }
        struct State: Decodable {
            let active, paused, moving, celebrating, finished: Bool
            let leg, legs, misses, ladder, bumps, arrivals, completions: Int
            let calm, current, zone, doneWait, heading: Double
            let boat, goal: Point
            let hintShown: String
            let order, trail: [Int]
            let route, draft, channel: [Point]
            let trailPoints: [[Point]]?
        }
        struct Event: Decodable {
            let action: String
            let leg, count: Int?
            let point: Point?
            let seconds: Double?
            let expected: State
        }
        struct Scenario: Decodable { let name: String; let seed: Int; let unit: Double; let initial: State; let events: [Event] }
        let sourceSHA256: String
        let orders: [Order]
        let scenarios: [Scenario]
    }
    private var module: URL {
        URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
    }
    private func references() throws -> Reference {
        try JSONDecoder().decode(Reference.self, from: Data(contentsOf: module.appendingPathComponent("Tools/treasure-motion/reference.json")))
    }
    private func points(_ actual: [Point], _ expected: [Point], _ label: String, file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertEqual(actual.count, expected.count, label, file:file,line:line)
        for (a,b) in zip(actual,expected) {
            XCTAssertEqual(a.x,b.x,accuracy:1e-11,label,file:file,line:line)
            XCTAssertEqual(a.y,b.y,accuracy:1e-11,label,file:file,line:line)
        }
    }
    private func compare(_ a: NativeTreasureMotion.Snapshot, _ b: Reference.State, _ label: String) {
        XCTAssertEqual(a.active,b.active,label);XCTAssertEqual(a.paused,b.paused,label)
        XCTAssertEqual(a.moving,b.moving,label);XCTAssertEqual(a.celebrating,b.celebrating,label);XCTAssertEqual(a.finished,b.finished,label)
        XCTAssertEqual(a.leg,b.leg,label);XCTAssertEqual(a.legs,b.legs,label);XCTAssertEqual(a.misses,b.misses,label)
        XCTAssertEqual(a.ladder,b.ladder,label);XCTAssertEqual(a.bumps,b.bumps,label)
        XCTAssertEqual(a.arrivals,b.arrivals,label);XCTAssertEqual(a.completions,b.completions,label)
        XCTAssertEqual(a.calm,b.calm,accuracy:1e-11,label);XCTAssertEqual(a.current,b.current,accuracy:1e-11,label)
        XCTAssertEqual(a.zone,b.zone,accuracy:1e-11,label);XCTAssertEqual(a.doneWait,b.doneWait,accuracy:1e-11,label)
        XCTAssertEqual(a.heading,b.heading,accuracy:1e-11,label);XCTAssertEqual(a.hintShown,b.hintShown,label)
        XCTAssertEqual(a.order,b.order,label);XCTAssertEqual(a.trail,b.trail,label)
        points([a.boat,a.goal],[b.boat,b.goal],label);points(a.route,b.route,label);points(a.draft,b.draft,label);points(a.channel,b.channel,label)
        if let trail = b.trailPoints {
            XCTAssertEqual(a.trailPoints.count,trail.count,label)
            for (actual,expected) in zip(a.trailPoints,trail) { points(actual,expected,label) }
        }
    }
    @MainActor
    func testExactCanonicalMotorSnapshotsAcrossIdleCollisionsMissLadderHelpPauseAndEightHarbours() async throws {
        let reference = try references()
        let source = try Data(contentsOf: module.appendingPathComponent("Sources/SonaFamilyRules/Rules/treasure.js"))
        XCTAssertEqual(SHA256.hash(data: source).map { String(format:"%02x",$0) }.joined(), reference.sourceSHA256)
        let checkout = module.deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("public/treasure.js")
        let captured = module.deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("Baseline/public/treasure.js")
        let original = FileManager.default.fileExists(atPath: checkout.path) ? checkout : captured
        XCTAssertEqual(source, try Data(contentsOf: original), "Keep the motor source byte-identical to its canonical page engine")
        for scenario in reference.scenarios {
            let engine = try NativeTreasureMotion(seed:scenario.seed,unit:scenario.unit)
            compare(try XCTUnwrap(engine.snapshot),scenario.initial,scenario.name+" initial")
            for (index,event) in scenario.events.enumerated() {
                switch event.action {
                case "word":try engine.beginLeg(try XCTUnwrap(event.leg))
                case "step":for _ in 0..<(event.count ?? 1) { try engine.step(seconds:try XCTUnwrap(event.seconds)) }
                case "down":try engine.pointerDown(try XCTUnwrap(event.point))
                case "move":try engine.pointerMove(try XCTUnwrap(event.point))
                case "up":try engine.pointerUp(try XCTUnwrap(event.point))
                case "cancel":try engine.cancelDrawing()
                case "help":try engine.grantHelp()
                case "pause":try engine.pause()
                case "resume":try engine.resume()
                case "resetHarbour":try engine.resetHarbour()
                default:XCTFail("Unexpected fixture action")
                }
                compare(try XCTUnwrap(engine.snapshot),event.expected,"\(scenario.name) event \(index) \(event.action)")
            }
        }
    }
    @MainActor
    func testNewVoyageUsesCanonicalSeededThreeNearestHarbourOrders() async throws {
        let reference = try references();var seen=Set<[Int]>()
        for item in reference.orders {
            let engine=try NativeTreasureMotion(seed:item.seed)
            XCTAssertEqual(engine.snapshot?.order,item.order)
            XCTAssertEqual(Set(item.order),Set(0..<8))
            seen.insert(item.order)
        }
        XCTAssertGreaterThan(seen.count,1)
    }
    @MainActor
    func testNoWordAndNoElapsedSailingCannotCompleteMotorMove() async throws {
        let engine=try NativeTreasureMotion(seed:49866)
        let start=try XCTUnwrap(engine.snapshot)
        try engine.pointerDown(start.boat);try engine.pointerMove(start.goal);try engine.pointerUp(start.goal)
        for _ in 0..<100 { try engine.step(seconds:0.02) }
        XCTAssertEqual(engine.snapshot?.boat,start.boat);XCTAssertEqual(engine.snapshot?.completions,0)
        try engine.beginLeg(0)
        try engine.pointerDown(start.boat);try engine.pointerMove(start.goal);try engine.pointerUp(start.goal)
        XCTAssertTrue(try XCTUnwrap(engine.snapshot).moving)
        XCTAssertEqual(engine.snapshot?.boat,start.boat);XCTAssertEqual(engine.snapshot?.completions,0)
        XCTAssertEqual(engine.snapshot?.calm,0);XCTAssertEqual(engine.snapshot?.current,0.018)
    }
    @MainActor
    func testMalformedPointerAndFrameFailClosedWithoutInterpolationOrCredit() async throws {
        let engine=try NativeTreasureMotion(seed:5)
        XCTAssertThrowsError(try engine.pointerDown(.init(x:Double.nan,y:0.4)))
        XCTAssertEqual(engine.snapshot?.completions,0)
        XCTAssertThrowsError(try NativeTreasureMotion(seed:0))
        let second=try NativeTreasureMotion(seed:5)
        XCTAssertThrowsError(try second.step(seconds:1))
        XCTAssertEqual(second.snapshot?.completions,0)
    }
}

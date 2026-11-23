import Foundation
import JavaScriptCore

/// The exact bundled Treasure Map motor engine, hosted without a page, WebView,
/// transport, microphone, timer, image loader or audio output. Swift supplies
/// accepted-move lifecycle and bounded frame times; SwiftUI draws local assets.
@MainActor
public final class NativeTreasureMotion {
    public struct Point: Codable, Equatable, Sendable {
        public let x, y: Double
        public init(x: Double, y: Double) { self.x = x; self.y = y }
    }
    public struct Island: Codable, Equatable, Sendable { public let x, y, rx, ry: Double }
    public struct Map: Codable, Equatable, Sendable {
        public let x, y, w, h: Double
        public let rotated: Bool
    }
    public struct Snapshot: Decodable, Equatable, Sendable {
        public let active, paused, moving, finished, celebrating: Bool
        public let leg, legs, misses, ladder, bumps, arrivals, completions: Int
        public let boat, goal: Point
        public let order, trail: [Int]
        public let calm, current, zone, heading, doneWait: Double
        public let hintShown, banner: String
        public let islands: [Island]
        public let hintPoints: [Point]
        public let route, draft, channel, wake: [Point]
        public let trailPoints: [[Point]]
        public let map: Map
    }
    public enum MotionError: Error { case missingSource, invalidSource, invalidInput, engineFailed, invalidSnapshot }
    private struct Start: Encodable { let seed: Int; let unit: Double }
    private struct Command: Encodable {
        let action: String
        var point: Point? = nil
        var seconds: Double? = nil
        var leg: Int? = nil
        var unit: Double? = nil
    }
    private let context: JSContext
    private var failed = false
    public private(set) var snapshot: Snapshot?

    public init(seed: Int = Int.random(in: 1...2_147_483_646), unit: Double = 360) throws {
        guard (1...2_147_483_646).contains(seed), unit.isFinite, (1...4096).contains(unit) else { throw MotionError.invalidInput }
        guard let context = JSContext() else { throw MotionError.engineFailed }
        self.context = context
        context.exceptionHandler = { [weak self] _, _ in self?.failed = true }
        func source(_ name: String) throws -> String {
            guard let url = Bundle.module.url(forResource: name, withExtension: "js", subdirectory: "Rules"),
                  let text = try? String(contentsOf: url) else { throw MotionError.missingSource }
            return text
        }
        context.evaluateScript(try source("treasure-native-host"))
        let original = try source("treasure")
        let marker = "  window.Treasure={"
        guard original.components(separatedBy: marker).count == 2 else { throw MotionError.invalidSource }
        // Only expose existing motor state/functions. The source asset remains
        // byte-identical to public/treasure.js, including navigation and physics.
        let expose = """
          window.nativeTreasureAttach({
            step:function(dt){tick(dt);draw();hud();},
            size:function(w){box={x:0,y:0,w:w,h:w*1.5,rotated:false};draw();hud();},
            snapshot:function(){draw();hud();var s=window.__treasure;s.trailPoints=trail.map(function(p){return p.slice();});s.wake=wake.slice();s.heading=heading;s.doneWait=doneWait;s.hintPoints=hint.slice();s.islands=ISLANDS.slice();s.banner=document.getElementById("seaBanner").textContent;return s;}
          });
        """
        context.evaluateScript(original.replacingOccurrences(of: marker, with: expose + "\n" + marker))
        snapshot = try invoke("nativeTreasureStart", Start(seed: seed, unit: unit))
    }

    @discardableResult public func beginLeg(_ leg: Int) throws -> Snapshot { try perform(.init(action: "word", leg: leg)) }
    @discardableResult public func step(seconds: Double) throws -> Snapshot { try perform(.init(action: "step", seconds: seconds)) }
    @discardableResult public func resize(unit: Double) throws -> Snapshot { try perform(.init(action: "size", unit: unit)) }
    @discardableResult public func pointerDown(_ point: Point) throws -> Snapshot { try perform(.init(action: "down", point: point)) }
    @discardableResult public func pointerMove(_ point: Point) throws -> Snapshot { try perform(.init(action: "move", point: point)) }
    @discardableResult public func pointerUp(_ point: Point) throws -> Snapshot { try perform(.init(action: "up", point: point)) }
    @discardableResult public func cancelDrawing() throws -> Snapshot { try perform(.init(action: "cancel")) }
    @discardableResult public func grantHelp() throws -> Snapshot { try perform(.init(action: "help")) }
    @discardableResult public func resetHarbour() throws -> Snapshot { try perform(.init(action: "resetHarbour")) }
    @discardableResult public func pause() throws -> Snapshot { try perform(.init(action: "pause")) }
    @discardableResult public func resume() throws -> Snapshot { try perform(.init(action: "resume")) }
    @discardableResult public func finale() throws -> Snapshot { try perform(.init(action: "finale")) }

    private func perform(_ command: Command) throws -> Snapshot {
        let state: Snapshot = try invoke("nativeTreasureCommand", command)
        snapshot = state
        return state
    }
    private func invoke<Input: Encodable>(_ function: String, _ input: Input) throws -> Snapshot {
        guard !failed, let text = String(data: try JSONEncoder().encode(input), encoding: .utf8),
              let result = context.objectForKeyedSubscript(function)?.call(withArguments: [text]),
              !failed, result.isString, let raw = result.toString(), let bytes = raw.data(using: .utf8) else { throw MotionError.engineFailed }
        guard let state = try? JSONDecoder().decode(Snapshot.self, from: bytes) else { throw MotionError.invalidSnapshot }
        return state
    }
}

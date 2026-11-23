import Foundation

struct NativeDinoPart: Decodable {
    enum Geometry { case ellipse([Double]), outline([[Double]]), curve([[Double]]) }
    let geometry: Geometry
    init(from decoder: Decoder) throws {
        var values = try decoder.unkeyedContainer(); let kind = try values.decode(String.self)
        switch kind {
        case "e": var numbers: [Double] = []; while !values.isAtEnd { numbers.append(try values.decode(Double.self)) }; geometry = .ellipse(numbers)
        case "o": geometry = .outline(try values.decode([[Double]].self))
        case "l": var points: [[Double]] = []; while !values.isAtEnd { points.append(try values.decode([Double].self)) }; geometry = .curve(points)
        default: throw DecodingError.dataCorruptedError(in: values, debugDescription: "Unknown original Dino drawing part")
        }
    }
}
struct NativeDinoDefinition: Decodable, Identifiable {
    struct Look: Decodable { let `as`: String; let pts: [[Double]]; let hush: Int? }
    struct Box: Decodable { let x, y, w, h: Double }
    struct Bone: Decodable, Identifiable {
        let id: String; let at: [Double]; let parts: [NativeDinoPart]; let marks: [NativeDinoPart]?
        let size, rot: Double?; let shout: String?; let box: Box
    }
    let id, name, a, fill, paint, edge, far: String
    let accent, accentEdge, light: String?
    let look: [Look]; let bones: [Bone]; let spots: [[Double]]
    let eye, cheek: [Double]; let nose: [Double]?; let box: Box
}
struct NativeDinoCatalog: Decodable {
    let dinos: [NativeDinoDefinition]
    static func load(bundle: Bundle = .main) throws -> Self {
        let url = bundle.url(forResource: "dino-catalog", withExtension: "json", subdirectory: "ArcadeDino") ?? bundle.url(forResource: "dino-catalog", withExtension: "json")
        guard let url else { throw CocoaError(.fileNoSuchFile) }
        return try JSONDecoder().decode(Self.self, from: Data(contentsOf: url))
    }
}
struct NativeDinoCollection: Codable, Equatable {
    var last: String
    var got: [String]
    static let empty = Self(last: "", got: [])
    func sanitized(using catalog: NativeDinoCatalog) -> Self {
        let ids = Set(catalog.dinos.map(\.id)); var unique: [String] = []
        for id in got where ids.contains(id) && !unique.contains(id) { unique.append(id) }
        return .init(last: ids.contains(last) ? last : "", got: unique)
    }
}
struct NativeDinoCompletion { let dino: NativeDinoDefinition; let collection: NativeDinoCollection }

/// Source-derived finger game only. The speech host alone earns a brush and
/// counts sayings. Time can animate a found bone, but cannot uncover a bone.
struct NativeDinoDig {
    enum Phase: Equatable { case idle, ready, found, flying, placed, awake, complete }
    enum Event { case boneFound, flying, placed, moveCompleted(final: Bool), roundCompleted }
    let catalog: NativeDinoCatalog
    let dino: NativeDinoDefinition
    let level: Int
    private(set) var collection: NativeDinoCollection
    private(set) var phase: Phase = .idle
    private(set) var found = 0
    private(set) var rubs = 0
    private(set) var clock = 0.0
    private(set) var cleared: Set<Int> = []
    private(set) var size = CGSize(width: 440, height: 560)
    private(set) var digRect = CGRect.zero
    private(set) var boneOrigin = CGPoint.zero
    private(set) var boneScale = 1.0
    private(set) var phaseAt = 0.0
    private var brushAt = 0.0, glowAt = 0.0, crumbleAt = 0.0
    private var lastPoint: CGPoint?
    static let columns = 28, rows = 14
    init(catalog: NativeDinoCatalog, collection: NativeDinoCollection = .empty, level: Int = 1) {
        precondition(catalog.dinos.count > 0 && catalog.dinos.allSatisfy { $0.bones.count == 8 })
        self.catalog = catalog; let kept = collection.sanitized(using: catalog); self.collection = kept
        let last = catalog.dinos.firstIndex { $0.id == kept.last } ?? -1
        self.dino = catalog.dinos[(last + 1) % catalog.dinos.count]
        self.level = level == 2 || level == 3 ? level : 1
    }
    var pit: CGRect { CGRect(x: size.width * 0.07, y: size.height * 0.6, width: size.width * 0.86, height: size.height * 0.34) }
    var boardScale: Double { size.width / 440 }
    var boardOrigin: CGPoint { .init(x: 0, y: size.height * 0.07) }
    var currentBone: NativeDinoDefinition.Bone? { dino.bones.indices.contains(found) ? dino.bones[found] : nil }
    var brushSize: Double { clock - brushAt >= 6 ? 1 : [1,0.85,0.72][level - 1] }
    var need: Double { clock - brushAt >= 6 ? 0.6 : [0.6,0.68,0.76][level - 1] }
    var glow: Bool { phase == .ready && clock >= glowAt }
    var phaseProgress: Double {
        let duration: Double
        switch phase { case .found: duration = 0.55; case .flying: duration = 0.75; case .placed: duration = 0.9; case .awake: duration = 1.35; default: return 0 }
        return min(1, max(0, (clock - phaseAt) / duration))
    }
    var boneCells: [Int] {
        guard currentBone != nil else { return [] }
        let p = pit
        return (0..<(Self.columns * Self.rows)).filter { index in
            let x = p.minX + (Double(index % Self.columns) + 0.5) / Double(Self.columns) * p.width
            let y = p.minY + (Double(index / Self.columns) + 0.5) / Double(Self.rows) * p.height
            return abs(x - digRect.midX) <= digRect.width / 2 && abs(y - digRect.midY) <= digRect.height / 2
        }
    }
    var revealed: Double { let cells = boneCells; return cells.isEmpty ? 0 : Double(cells.filter { cleared.contains($0) }.count) / Double(cells.count) }
    mutating func resize(_ fresh: CGSize) {
        guard fresh.width.isFinite, fresh.height.isFinite, fresh.width > 0, fresh.height > 0 else { return }
        size = fresh; if currentBone != nil && phase != .idle { positionBone() }
    }
    @discardableResult mutating func earnBrush() -> Bool {
        guard phase == .idle, currentBone != nil else { return false }
        positionBone(); cleared = []; lastPoint = nil; rubs = 0
        phase = .ready; phaseAt = clock; brushAt = clock; glowAt = clock + 4; crumbleAt = clock + 8
        return true
    }
    mutating func endStroke() { lastPoint = nil }
    mutating func rub(at point: CGPoint) {
        guard phase == .ready, pit.contains(point) else { return }
        let radius = max(13, pit.width * 0.072) * brushSize
        if let lastPoint {
            let dx = point.x - lastPoint.x, dy = point.y - lastPoint.y
            let n = min(12, Int(ceil(hypot(dx,dy) / (radius * 0.5))))
            if n > 0 { for i in 1...n { erase(.init(x: lastPoint.x + dx * Double(i) / Double(n), y: lastPoint.y + dy * Double(i) / Double(n)), radius: radius) } }
        } else { erase(point, radius: radius) }
        lastPoint = point; rubs += 1
        if abs(point.x - digRect.midX) < digRect.width * 0.7 && abs(point.y - digRect.midY) < digRect.height * 0.8 {
            glowAt = max(glowAt, clock + 2.5); crumbleAt = max(crumbleAt, clock + 5)
        } else if clock >= crumbleAt {
            erase(.init(x: digRect.midX + cos(Double(rubs) * 1.7) * digRect.width * 0.32,
                        y: digRect.midY + sin(Double(rubs) * 2.3) * digRect.height * 0.32), radius: radius * 0.8)
        }
    }
    /// The original Space/Enter alternative applies nine real brush circles.
    mutating func accessibleBrush() {
        guard phase == .ready else { return }
        for i in 0..<9 {
            erase(.init(x: digRect.midX + Double(i % 3 - 1) * digRect.width * 0.35,
                        y: digRect.midY + Double(i / 3 - 1) * digRect.height * 0.35),
                  radius: max(14, pit.width * 0.085, digRect.width * 0.2, digRect.height * 0.2))
        }
    }
    /// dt is bounded like the original requestAnimationFrame loop. A paused
    /// board supplies active=false; elapsed background time is never replayed.
    mutating func advance(seconds: Double, active: Bool = true) -> Event? {
        guard active, seconds.isFinite else { return nil }; clock += min(0.05, max(0, seconds))
        switch phase {
        case .ready where revealed >= need: phase = .found; phaseAt = clock; return .boneFound
        case .found where clock - phaseAt > 0.55: phase = .flying; phaseAt = clock; return .flying
        case .flying where clock - phaseAt >= 0.75:
            found += 1; phase = .placed; phaseAt = clock; return .placed
        case .placed where clock - phaseAt >= 0.9:
            phase = .idle; cleared = []; return .moveCompleted(final: found == dino.bones.count)
        case .awake where clock - phaseAt >= 1.35: phase = .complete; return .roundCompleted
        default: return nil
        }
    }
    mutating func wake() -> NativeDinoCompletion? {
        guard phase == .idle, found == dino.bones.count else { return nil }
        if !collection.got.contains(dino.id) { collection.got.append(dino.id) }; collection.last = dino.id
        phase = .awake; phaseAt = clock
        return .init(dino: dino, collection: collection)
    }
    private mutating func positionBone() {
        guard let b = currentBone else { return }; let p = pit, box = b.box
        let k = max(boardScale * 1.1, min(boardScale * 1.8, p.width * 0.6 / box.w, p.height * 0.75 / box.h))
        let w = box.w * k, h = box.h * k, spot = dino.spots[found % dino.spots.count]
        let x = max(p.minX + w / 2 + 10, min(p.maxX - w / 2 - 10, p.minX + p.width * spot[0]))
        let y = max(p.minY + h / 2 + 8, min(p.maxY - h / 2 - 8, p.minY + p.height * spot[1]))
        digRect = .init(x: x - w / 2, y: y - h / 2, width: w, height: h)
        boneScale = k; boneOrigin = .init(x: x - box.x * k, y: y - box.y * k)
    }
    private mutating func erase(_ point: CGPoint, radius: Double) {
        for row in 0..<Self.rows { for col in 0..<Self.columns {
            let x = pit.minX + (Double(col) + 0.5) / Double(Self.columns) * pit.width
            let y = pit.minY + (Double(row) + 0.5) / Double(Self.rows) * pit.height
            if pow(x - point.x, 2) + pow(y - point.y, 2) <= radius * radius { cleared.insert(row * Self.columns + col) }
        } }
    }
}

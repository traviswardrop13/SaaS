import Foundation
import JavaScriptCore

/// Pure evaluator for the current shipping rules. Each call uses an isolated
/// context with a copy of one family's storage. It never owns a WebView, disk
/// storage, device services, networking, or a microphone.
public enum NativeFamilyRules {
    public enum Operation: String, Sendable {
        case summary, ensureCalendar, enrollmentSnapshot, practiceTarget, attempt, rungWin, roundReady, targetSound, bookRead, setupForm, completeSetup, changeFocus
        case storySeen, storyPlace, questFinish, gameRep, speechGame
        case rewards, roadSettle, roadOpen, monthOpen, chestOpen, roadRolledSeen
        case shop, equip, buy, undoBuy
        case preferences, savePreferences, turnSoundOn, resetProgress
        case bookWord, storyWord, storyEnding
        case feedGame, feedCount, feedGrowth
        case backupExport, backupImport, backupUndo
        case arcadeCheckpoint
        case arcadeLevelCatalog, arcadeLevelInfo, arcadeLevelAsk, arcadeLevelSet, arcadeBest, arcadeBestOffer
        case dinoCollection, dinoCollectionSave
    }

    public struct Outcome: Sendable {
        public let value: Data
        public let changes: [String: String]
        public let removals: [String]
    }

    public enum EvaluationError: Error {
        case invalidResources, invalidInput, evaluationFailed, invalidResult
    }

    public struct AccessProjection: Encodable, Sendable {
        public let premium: Bool
        public let appleActive: Bool?
        public let legacyBuddies: Bool
        public let keptFreeVersion: Bool

        public init(premium: Bool, appleActive: Bool?, legacyBuddies: Bool, keptFreeVersion: Bool) {
            self.premium = premium
            self.appleActive = appleActive
            self.legacyBuddies = legacyBuddies
            self.keptFreeVersion = keptFreeVersion
        }
    }

    private struct Environment: Encodable { let storage: [String: String]; let canSell: Bool; let access: AccessProjection? }
    private struct Command<Arguments: Encodable>: Encodable {
        let operation: String
        let input: Arguments
    }
    private static let resources = Result { () throws -> [(String, String)] in
        try ["host", "sona", "gamecontent", "story-game-copy", "charge-selection", "say-game-selection", "book-word-selection", "feed-selection", "arcade-checkpoint-selection"].map { file in
            guard let url = Bundle.module.url(forResource: file, withExtension: "js", subdirectory: "Rules"),
                  let source = try? String(contentsOf: url, encoding: .utf8)
            else { throw EvaluationError.invalidResources }
            return (file == "sona" ? try childLedgerProgram(source) : source, file)
        }
    }

    /// REPORT1 has its own native household transaction after a counted rep
    /// commits. Its browser transport hook cannot run inside a child-only save:
    /// it changes the device queue and may assign IDs to other children. Keep
    /// the canonical resource intact for NativeWeeklyReportPolicy's preparation.
    static func childLedgerProgram(_ source: String) throws -> String {
        let hook = """
              // REPORT1: the weekly report's numbers, after today's goal stamp so they
              // count it; at most every 30 minutes, and a no-op unless asked for
              try { _reportTouch(); } catch (e) {}
        """
        guard source.components(separatedBy: hook).count == 2,
              source.components(separatedBy: "try { _reportTouch(); } catch (e) {}").count == 2
        else { throw EvaluationError.invalidResources }
        return source.replacingOccurrences(of: hook,
            with: "      // The native household report owner runs after this child commit.")
    }

    public static func evaluate<Arguments: Encodable>(_ operation: Operation, input: Arguments,
                                                       storage: [String: String], canSell: Bool = false,
                                                       access: AccessProjection? = nil) throws -> Outcome {
        let sources = try resources.get()
        guard let context = JSContext() else { throw EvaluationError.evaluationFailed }
        var failed = false
        context.exceptionHandler = { _, _ in failed = true }
        defer { context.exceptionHandler = nil }
        func run(_ script: (String, String)) throws {
            context.evaluateScript(script.0, withSourceURL: URL(fileURLWithPath: "/SonaRules/" + script.1 + ".js"))
            if failed { throw EvaluationError.evaluationFailed }
        }
        let encoder = JSONEncoder()
        func json<Value: Encodable>(_ value: Value) throws -> String {
            guard let bytes = try? encoder.encode(value), let encoded = String(data: bytes, encoding: .utf8)
            else { throw EvaluationError.invalidInput }
            return encoded
        }
        try run(sources[0])
        context.objectForKeyedSubscript("nativeInstall").call(withArguments: [try json(Environment(storage: storage, canSell: canSell, access: access))])
        guard !failed else { throw EvaluationError.evaluationFailed }
        for script in sources.dropFirst() { try run(script) }
        let command = try json(Command(operation: operation.rawValue, input: input))
        guard let raw = context.objectForKeyedSubscript("nativeRun").call(withArguments: [command]),
              !failed, raw.isString, let string = raw.toString(), let data = string.data(using: .utf8),
              let envelope = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let result = envelope["result"], let changes = envelope["changed"] as? [String: String],
              let removals = envelope["removed"] as? [String],
              let resultData = try? JSONSerialization.data(withJSONObject: result, options: [.fragmentsAllowed, .sortedKeys])
        else { throw EvaluationError.invalidResult }
        return Outcome(value: resultData, changes: changes, removals: removals)
    }
}

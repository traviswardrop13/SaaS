import SwiftUI

/// A native move boundary. The host enables the board only after the
/// current spoken turn has been accepted and persisted.
struct NativeSpeechGameProgress {
    let count: Int
    let advance: () -> Void
    let isHelpActive: Bool
    let isMoveActive: Bool
    let wordIndex: Int?
    /// true only after the full same-word ask, false after cleanup/return.
    let requestHelp: ((@escaping (Bool) -> Void) -> Bool)?

    init(count: Int, advance: @escaping () -> Void, isHelpActive: Bool = false, isMoveActive: Bool = true, wordIndex: Int? = nil,
         requestHelp: ((@escaping (Bool) -> Void) -> Bool)? = nil) {
        self.count = count; self.advance = advance
        self.isHelpActive = isHelpActive; self.isMoveActive = isMoveActive
        self.wordIndex = wordIndex; self.requestHelp = requestHelp
    }
}

private struct NativeSpeechGameKey: EnvironmentKey {
    static let defaultValue: NativeSpeechGameProgress? = nil
}

extension EnvironmentValues {
    var speechGameProgress: NativeSpeechGameProgress? {
        get { self[NativeSpeechGameKey.self] }
        set { self[NativeSpeechGameKey.self] = newValue }
    }
}

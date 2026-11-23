import SwiftUI
import SonaFamilyRules

struct NativeRewardsHost: View {
    @ObservedObject var records: NativeFamilyState
    var arcadeLevels: NativeArcadeLevelsAccess? = nil
    @Environment(\.dismiss) private var dismiss
    @State private var snapshot: NativeRewardsSnapshot?
    @State private var failed = false
    @State private var retry = 0

    var body: some View {
        SonaNavigation {
            Group {
                if let snapshot, snapshot.scope == records.scope {
                    NativeRewardsView(snapshot: snapshot, arcadeLevels: arcadeLevels) { request in
                        guard request.scope == records.scope, let owner = records.activeID,
                              let operation = NativeFamilyRules.Operation(rawValue: request.method)
                        else { throw NativeFamilyRules.EvaluationError.invalidInput }
                        let result: NativeRewardsUpdate = try await records.write(
                            operation, input: .init(scope: request.scope, n: request.number), owner: owner)
                        if request.scope == records.scope { self.snapshot = result.snapshot }
                        return result
                    }
                } else if failed {
                    VStack(spacing: 15) {
                        Text("Sona couldn’t open Trophy Road.")
                        Button("Try again") { retry += 1 }
                    }
                    .padding(20)
                } else {
                    ProgressView("Opening Trophy Road")
                }
            }
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
        .task(id: (records.scope ?? "") + String(retry)) {
            snapshot = nil
            failed = false
            guard let scope = records.scope else { failed = true; return }
            do {
                let value: NativeRewardsSnapshot = try await records.read(.rewards, input: .init(scope: scope))
                if records.scope == scope && !Task.isCancelled { snapshot = value }
            } catch {
                if records.scope == scope && !Task.isCancelled { failed = true }
            }
        }
    }
}

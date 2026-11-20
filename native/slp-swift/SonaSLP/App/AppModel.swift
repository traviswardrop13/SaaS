import Foundation
import Observation

/// Where the app is, and the caseload it has loaded. One object, handed to
/// every screen, so Today and Caseload always read the same list.
@Observable
final class AppModel {
    enum Phase { case starting, signedOut, needsProfile, locked, ready }
    var phase: Phase = .starting
    var me: Me?
    var kids: [Kid] = []
    var invites: [Invite] = []
    var loading = false
    var loadError: String?

    var liveKids: [Kid] { kids.filter { !$0.archived } }

    @MainActor
    func start() async {
        do {
            let me = try await API.shared.decode(Me.self, "api/slp/auth/me")
            guard me.ok else { phase = .signedOut; return }
            self.me = me
            if (me.code ?? "").isEmpty { phase = .needsProfile; return }
            await load()
        } catch let e as APIError where e.status != 0 {
            phase = .signedOut          // the server answered: not signed in
        } catch {
            // No connection at launch: keep the person signed in if a cookie
            // exists, and let Today show the error with a retry.
            phase = HTTPCookieStorage.shared.cookies(for: API.shared.base)?.isEmpty == false ? .ready : .signedOut
            loadError = (error as? APIError)?.message
        }
    }

    @MainActor
    func load() async {
        loading = true; defer { loading = false }
        do {
            let r = try await API.shared.decode(Roster.self, "api/slp")
            kids = r.kids; invites = r.invites; loadError = nil
            phase = .ready
        } catch let e as APIError {
            if e.status == 401 { phase = .signedOut }
            else if e.needPlan || e.status == 402 { phase = .locked }
            else { loadError = e.message; if phase == .starting { phase = .ready } }
        } catch {
            loadError = "Couldn't load your caseload. Pull down to try again."
            if phase == .starting { phase = .ready }
        }
    }

    @MainActor
    func signOut() async {
        _ = try? await API.shared.call("api/slp/auth/logout", method: "POST", body: [:])
        API.shared.clearCookies()
        me = nil; kids = []; invites = []; phase = .signedOut
    }
}

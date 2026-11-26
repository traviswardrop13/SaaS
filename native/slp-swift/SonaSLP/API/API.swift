import Foundation

/// Talks to the same server the web dashboard uses (app.speaksona.com).
/// Sign-in sets an HttpOnly session cookie; URLSession keeps it in the shared
/// cookie store, so every later call is signed in, just like the browser.
/// No Origin header is sent, which the server's same-site checks allow.
struct APIError: Error, LocalizedError {
    let message: String
    let status: Int
    var needPlan: Bool = false
    var errorDescription: String? { message }
}

final class API {
    static let shared = API()
    #if DEBUG
    /// Point a debug build at a preview with SONA_API_BASE in the scheme's environment.
    let base = URL(string: ProcessInfo.processInfo.environment["SONA_API_BASE"] ?? "https://app.speaksona.com")!
    #else
    let base = URL(string: "https://app.speaksona.com")!
    #endif

    private let session: URLSession = {
        let c = URLSessionConfiguration.default
        c.httpCookieStorage = .shared
        c.httpCookieAcceptPolicy = .always
        c.httpShouldSetCookies = true
        c.timeoutIntervalForRequest = 20
        c.httpAdditionalHeaders = ["User-Agent": "SonaSLPApp/2 (iOS; native)"]
        return c
    }()

    /// Every response is JSON with `ok`. A non-ok answer becomes an APIError
    /// carrying the server's own words (they are written for people).
    func call(_ path: String, method: String = "GET", body: [String: Any]? = nil) async throws -> [String: Any] {
        var req = URLRequest(url: base.appendingPathComponent(path))
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let data: Data, resp: URLResponse
        do { (data, resp) = try await session.data(for: req) }
        catch { throw APIError(message: "No connection. Check your internet and try again.", status: 0) }
        let status = (resp as? HTTPURLResponse)?.statusCode ?? 0
        let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        if status >= 400 || json["ok"] as? Bool == false {
            let msg = json["error"] as? String ?? (status == 401 ? "Please sign in again." : "Something went wrong. Try again.")
            throw APIError(message: msg, status: status, needPlan: json["needPlan"] as? Bool == true)
        }
        return json
    }

    /// The same call, decoded into a Codable type.
    func decode<T: Decodable>(_ type: T.Type, _ path: String) async throws -> T {
        let json = try await call(path)
        let data = try JSONSerialization.data(withJSONObject: json)
        return try JSONDecoder().decode(T.self, from: data)
    }

    func clearCookies() {
        for c in HTTPCookieStorage.shared.cookies(for: base) ?? [] { HTTPCookieStorage.shared.deleteCookie(c) }
    }
}

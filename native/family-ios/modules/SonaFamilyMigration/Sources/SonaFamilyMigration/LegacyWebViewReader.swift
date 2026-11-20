#if canImport(WebKit)
import Foundation
import WebKit

/// Capture only a quiesced migration document in the OLD app's default store.
/// This reader does not load URLs or create WebViews: the host must supply a
/// controlled document at the exact origin, block all outgoing traffic and stop
/// legacy writers. See the migration package README before wiring a release.
@MainActor
public enum LegacyWebViewReader {
    public static func capture(from webView: WKWebView, expectedOrigin: LegacyOrigin) async throws -> LegacySnapshot {
        guard webView.configuration.websiteDataStore === WKWebsiteDataStore.default(),
              matches(webView.url, expectedOrigin) else { throw MigrationError.wrongOrigin }
        guard let url = Bundle.module.url(forResource: "CaptureLegacyStorage", withExtension: "js"),
              let script = try? String(contentsOf: url, encoding: .utf8) else {
            throw MigrationError.invalidCapture
        }
        let result = try await webView.callAsyncJavaScript("return await \(script);", arguments: [:],
                                                          in: nil, contentWorld: .defaultClient)
        guard matches(webView.url, expectedOrigin) else { throw MigrationError.wrongOrigin }
        guard let string = result as? String, let data = string.data(using: .utf8) else {
            throw MigrationError.invalidCapture
        }
        return try LegacySnapshot.decodeCapture(data, expectedOrigin: expectedOrigin)
    }

    static func matches(_ url: URL?, _ origin: LegacyOrigin) -> Bool {
        guard let url, let expected = URL(string: origin.rawValue) else { return false }
        return url.scheme == expected.scheme && url.host == expected.host && url.port == expected.port
            && url.user == nil && url.password == nil
    }
}
#endif

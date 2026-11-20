#if os(iOS) && canImport(WebKit)
import Foundation
import WebKit

/// Reads legacy app storage from inert documents owned by the old application.
/// The release host must stop every existing WebKit writer before running it.
/// The separate preview cannot instantiate this adapter.
@MainActor
public final class LegacyUpgradeCapture: LegacyOriginCapturing {
    public init() throws {
        guard Bundle.main.bundleIdentifier == "com.speaksona.app" else {
            throw MigrationError.invalidCapture
        }
    }

    public func capture(origin: LegacyOrigin) async throws -> LegacySnapshot {
        let document = try InertLegacyDocument(origin: origin)
        try await document.open()
        try Task.checkCancellation()
        return try await LegacyWebViewReader.capture(from: document.webView, expectedOrigin: origin)
    }
}

/// A base URL assigns the old origin to bundled HTML. The HTML has no external
/// resources or scripts, and capture runs in WebKit's isolated client world.
/// There is no fallback to a network navigation if an origin cannot be read.
@MainActor
private final class InertLegacyDocument: NSObject, WKNavigationDelegate {
    private static let html = """
        <!doctype html>
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; base-uri 'none'; form-action 'none'">
        <title>Sona local upgrade</title>
        """

    let webView: WKWebView
    private let url: URL
    private let origin: LegacyOrigin
    private var allowedInitialNavigation = true
    private var pending: CheckedContinuation<Void, any Error>?
    private var deadline: Task<Void, Never>?

    init(origin: LegacyOrigin) throws {
        guard let url = URL(string: origin.rawValue) else { throw MigrationError.wrongOrigin }
        self.url = url
        self.origin = origin
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        if origin == .bundled {
            configuration.setURLSchemeHandler(RejectBundledRequests(), forURLScheme: "capacitor")
        }
        self.webView = WKWebView(frame: .zero, configuration: configuration)
        super.init()
        webView.navigationDelegate = self
    }

    func open() async throws {
        try await withTaskCancellationHandler {
            try Task.checkCancellation()
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, any Error>) in
                pending = continuation
                deadline = Task { [weak self] in
                    do { try await Task.sleep(nanoseconds: 30_000_000_000) } catch { return }
                    self?.fail(MigrationError.invalidCapture)
                }
                webView.loadHTMLString(Self.html, baseURL: url)
            }
        } onCancel: {
            Task { @MainActor [weak self] in self?.fail(CancellationError()) }
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction) async -> WKNavigationActionPolicy {
        guard allowedInitialNavigation, navigationAction.targetFrame?.isMainFrame == true,
              LegacyWebViewReader.matches(navigationAction.request.url, origin) else { return .cancel }
        allowedInitialNavigation = false
        return .allow
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard LegacyWebViewReader.matches(webView.url, origin) else {
            fail(MigrationError.wrongOrigin)
            return
        }
        settle(.success(()))
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        fail(MigrationError.invalidCapture)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        fail(MigrationError.invalidCapture)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        fail(MigrationError.invalidCapture)
    }

    private func fail(_ error: any Error) {
        guard pending != nil else { return }
        settle(.failure(error))
        webView.stopLoading()
    }

    private func settle(_ result: Result<Void, any Error>) {
        let waiting = pending
        pending = nil
        deadline?.cancel()
        deadline = nil
        waiting?.resume(with: result)
    }
}

@MainActor
private final class RejectBundledRequests: NSObject, WKURLSchemeHandler {
    func webView(_ webView: WKWebView, start urlSchemeTask: any WKURLSchemeTask) {
        urlSchemeTask.didFailWithError(URLError(.unsupportedURL))
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: any WKURLSchemeTask) {}
}
#endif

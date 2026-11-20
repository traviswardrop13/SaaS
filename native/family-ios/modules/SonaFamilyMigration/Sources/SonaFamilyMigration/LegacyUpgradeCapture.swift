#if os(iOS) && canImport(WebKit)
import Foundation
import UIKit
import WebKit

/// Reads legacy app storage from inert documents owned by the old application.
/// The release host must stop every existing WebKit writer before running it.
/// The separate preview cannot instantiate this adapter.
@MainActor
public final class LegacyUpgradeCapture: LegacyOriginCapturing {
    private weak var host: UIView?

    public init(host: UIView? = nil) throws {
        guard Bundle.main.bundleIdentifier == "com.speaksona.app" else {
            throw MigrationError.invalidCapture
        }
        self.host = host
    }

    public func capture(origin: LegacyOrigin) async throws -> LegacySnapshot {
        let document = try InertLegacyDocument(origin: origin, host: host)
        defer { document.detach() }
        try await document.open()
        try Task.checkCancellation()
        return try await LegacyWebViewReader.capture(from: document.webView, expectedOrigin: origin)
    }

    /// Match the shipping app's retired-recordings policy only after the
    /// audio-free family archive and native seed have both verified.
    /// The clip store is cleared on its old origin, with no clip ever read.
    public func purgeRetiredRecordings(origin: LegacyOrigin) async throws {
        let document = try InertLegacyDocument(origin: origin, host: host)
        defer { document.detach() }
        try await document.open()
        try Task.checkCancellation()
        let result = try await document.webView.callAsyncJavaScript(Self.purgeScript, arguments: [:],
                                                                   in: nil, contentWorld: .defaultClient)
        guard result as? Bool == true, LegacyWebViewReader.matches(document.webView.url, origin) else {
            throw MigrationError.invalidCapture
        }
    }

    /// One explicitly deleted child, on its original app origin only.
    public func redactRemovedChild(_ child: NativeFamilyChildID) async throws {
        let document = try InertLegacyDocument(origin: child.origin, host: host)
        defer { document.detach() }
        try await document.open()
        let source = try await LegacyWebViewReader.capture(from: document.webView, expectedOrigin: child.origin)
        let redacted = try LegacyPlayerRedaction.redact(source.storage, child: child)
        var tracked = source.storage
        var updated = redacted
        if let undo = try await document.webView.callAsyncJavaScript("return localStorage.getItem('_sonaPreRestore');",
            arguments: [:], in: nil, contentWorld: .defaultClient) as? String {
            tracked["_sonaPreRestore"] = undo
            updated["_sonaPreRestore"] = try LegacyPlayerRedaction.redactUndo(undo, child: child)
        }
        let affected = Set(tracked.keys).union(updated.keys).filter { tracked[$0] != updated[$0] }
        guard !affected.isEmpty else { return }
        try Task.checkCancellation()
        guard LegacyWebViewReader.matches(document.webView.url, child.origin) else { throw MigrationError.wrongOrigin }
        let original: [String: Any] = Dictionary(uniqueKeysWithValues: affected.map { ($0, tracked[$0] as Any? ?? NSNull()) })
        let replacements: [String: Any] = Dictionary(uniqueKeysWithValues: affected.map { ($0, updated[$0] as Any? ?? NSNull()) })
        let result = try await document.webView.callAsyncJavaScript("""
            for (const key of Object.keys(expected)) {
                if (localStorage.getItem(key) !== expected[key]) return false;
            }
            const keys = Object.keys(replacement);
            for (const key of keys) if (replacement[key] !== null) localStorage.setItem(key, replacement[key]);
            if (replacement["sona.kids.v1"] === null) localStorage.removeItem("sona.kids.v1");
            for (const key of keys) if (replacement[key] === null) localStorage.removeItem(key);
            return Object.keys(replacement).every(key => localStorage.getItem(key) === replacement[key]);
            """, arguments: ["expected": original, "replacement": replacements], in: nil, contentWorld: .defaultClient)
        guard result as? Bool == true else { throw MigrationError.verificationFailed }
    }

    private static let purgeScript = """
        return await new Promise(resolve => {
            try {
                const opening = indexedDB.open('sona', 1);
                opening.onblocked = opening.onerror = () => resolve(false);
                opening.onupgradeneeded = () => {
                    if (!opening.result.objectStoreNames.contains('recordings')) {
                        opening.result.createObjectStore('recordings', { keyPath: 'id', autoIncrement: true });
                    }
                };
                opening.onsuccess = () => {
                    const db = opening.result;
                    try {
                        const tx = db.transaction('recordings', 'readwrite');
                        const clips = tx.objectStore('recordings');
                        clips.clear();
                        const count = clips.count();
                        tx.onerror = tx.onabort = () => { db.close(); resolve(false); };
                        tx.oncomplete = () => {
                            db.close();
                            if (count.result !== 0) { resolve(false); return; }
                            try { localStorage.setItem('_sonaClipsGone', '1'); resolve(true); }
                            catch (_) { resolve(false); }
                        };
                    } catch (_) { db.close(); resolve(false); }
                };
            } catch (_) { resolve(false); }
        });
        """
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

    init(origin: LegacyOrigin, host: UIView?) throws {
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
        if let host {
            webView.frame = CGRect(x: 0, y: 0, width: 1, height: 1)
            webView.alpha = 0.01
            webView.isUserInteractionEnabled = false
            webView.accessibilityElementsHidden = true
            host.insertSubview(webView, at: 0)
        }
    }

    func detach() { webView.stopLoading(); webView.removeFromSuperview() }

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

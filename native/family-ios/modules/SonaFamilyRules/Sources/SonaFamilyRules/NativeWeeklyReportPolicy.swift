import Foundation
import JavaScriptCore

/// Runs REPORT1's actual preparation and response callbacks in an isolated
/// context. Its fetch only captures one request; it never owns a transport.
public enum NativeWeeklyReportPolicy {
    public enum Action: String, Sendable { case sync, flush, queueOff, queueOn }
    public struct Projection: Sendable {
        public let body: Data?
        public let context: Data?
        public let reportState: String?
        public let profilePatches: [String: String]
        public let status: Data
    }
    public enum Failure: Error { case sourceChanged, evaluation, invalidProjection }
    private static let hostProgram: Result<String, Error> = Result { try source("host") }
    private static let reportProgram: Result<String, Error> = Result { try instrumented() }

    public static func prepare(storage: [String: String], profileKeys: [String], action: Action,
                               force: Bool, now: Date = Date(), removedEmail: String? = nil,
                               signupEmail: String? = nil) throws -> Projection {
        try run(storage: storage, profileKeys: profileKeys, now: now,
                command: ["action": action.rawValue, "force": force, "removedEmail": removedEmail ?? "",
                          "signupEmail": signupEmail ?? ""])
    }

    public static func acknowledge(storage: [String: String], profileKeys: [String], context: Data,
                                   response: Data?, now: Date = Date()) throws -> Projection {
        let info = try JSONSerialization.jsonObject(with: context)
        let reply: Any = try response.map { try JSONSerialization.jsonObject(with: $0) } ?? NSNull()
        return try run(storage: storage, profileKeys: profileKeys, now: now,
                       command: ["action": "ack", "context": info, "response": reply])
    }

    public static func status(storage: [String: String], profileKeys: [String], now: Date = Date()) throws -> Data {
        try run(storage: storage, profileKeys: profileKeys, now: now, command: ["action": "status"]).status
    }

    private static func source(_ name: String) throws -> String {
        guard let url = Bundle.module.url(forResource: name, withExtension: "js", subdirectory: "Rules"),
              let text = try? String(contentsOf: url, encoding: .utf8) else { throw Failure.sourceChanged }
        return text
    }
    private static func segment(_ text: String, from: String, to: String) throws -> String {
        guard let start = text.range(of: from), let end = text.range(of: to, range: start.upperBound..<text.endIndex)
        else { throw Failure.sourceChanged }
        return String(text[start.upperBound..<end.lowerBound])
    }

    private static func instrumented() throws -> String {
        var text = try source("sona")
        let report = try segment(text, from: "  function reportSync(force, recheck) {", to: "  function _reportTouch()")
        let response = try segment(report, from: ".then((j) => {", to: "\n        });")
        let completion = try segment(report, from: "sent.catch(() => false).then((ok) => {", to: "\n    }));")
        let off = try segment(text, from: "  function _reportOffFlush(force) {", to: "  function reportFlush()")
        let offResponse = try segment(off, from: "return sent.catch(() => false).then((ok) => {", to: "\n      });")
        let queue = try segment(text, from: "  function reportOff() {", to: "    return (_reportSyncP || Promise.resolve())")
        let signup = try segment(text, from: "  function reportSet(raw) {", to: "    // the email list hears it too")
        let syncFetch = "      sent = fetch(\"/api/report\","
        let offFetch = "        sent = fetch(\"/api/report\","
        // Insert at their distinct indentation, without rewriting any rule.
        guard text.components(separatedBy: "sent = fetch(\"/api/report\",").count == 3 else { throw Failure.sourceChanged }
        text = text.replacingOccurrences(of: offFetch,
            with: "        global.__reportContext = {kind:'off',o:o};\n" + offFetch)
        text = text.replacingOccurrences(of: "\n" + syncFetch,
            with: "\n      global.__reportContext = {kind:'sync',email:email,body:body,prev:prev||0,now:now,every:every};\n" + syncFetch)
        let hook = """
          global.__nativeReport = {
            prepare: function(p) {
              if(p.action==='queueOff') {
                if(p.removedEmail) _reportOffOwe(p.removedEmail);
                else { \(queue) }
              } else if(p.action==='queueOn') (function(raw) { \(signup) })(p.signupEmail);
              else if(p.action==='flush') _reportOffFlush(p.force===true);
              else if(p.action==='sync') reportSync(p.force===true,p.force===true);
            },
            acknowledge: function(p) {
              var c=p.context, email=c.email, body=c.body, prev=c.prev, now=c.now, every=c.every;
              if(c.kind==='off') { var o=c.o; return (function(ok){ \(offResponse) })(!!(p.response&&p.response.ok)); }
              var ok=p.response?(function(j){ \(response) })(p.response):false;
              return (function(ok){ \(completion) })(ok);
            },
            status: function() {
              var status=reportStatus();
              status.suggestedEmail=status.can&&!status.on?parentEmail():"";
              return status;
            }
          };
        """
        guard let export = text.range(of: "  global.Sona = {") else { throw Failure.sourceChanged }
        text.insert(contentsOf: hook, at: export.lowerBound)
        return text
    }

    private static func run(storage: [String: String], profileKeys: [String], now: Date,
                            command: [String: Any]) throws -> Projection {
        guard let js = JSContext() else { throw Failure.evaluation }
        var failed = false
        js.exceptionHandler = { _, _ in failed = true }
        defer { js.exceptionHandler = nil }
        func eval(_ text: String) throws { js.evaluateScript(text); if failed { throw Failure.evaluation } }
        func json(_ value: Any) throws -> String {
            String(decoding: try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys, .fragmentsAllowed]), as: UTF8.self)
        }
        try eval(hostProgram.get())
        js.objectForKeyedSubscript("nativeInstall").call(withArguments: [try json(["storage": storage, "canSell": false])])
        let random = (0..<256).map { _ in UInt8.random(in: .min ... .max) }
        try eval("""
          var __reportRequests=[],__reportContext=null,__random=\(try json(random)),__randomAt=0;
          var __realDate=Date;
          Date=class extends __realDate {constructor(...a){super(...(a.length?a:[\(now.timeIntervalSince1970 * 1000)]));}static now(){return \(now.timeIntervalSince1970 * 1000);}};
          crypto={getRandomValues:function(a){for(var i=0;i<a.length;i++)a[i]=__random[(__randomAt++)%__random.length];return a;}};
          fetch=function(url,options){
            if(url!=='/api/report') return Promise.reject(new Error('Unapproved native report request'));
            __reportRequests.push({body:JSON.parse(options.body),context:__reportContext});
            return new Promise(function(){});
          };
        """)
        try eval(reportProgram.get())
        let encoded = try json(command)
        try eval(command["action"] as? String == "ack"
                 ? "__nativeReport.acknowledge(\(encoded));" : "__nativeReport.prepare(\(encoded));")
        // JavaScriptCore drains Promise jobs when an evaluation returns, so
        // REPORT1's serial off queue has reached its first unresolved fetch.
        guard let raw = js.evaluateScript("JSON.stringify({requests:__reportRequests,storage:localStorage.snapshot(),status:__nativeReport.status()})")?.toString(),
              !failed, let data = raw.data(using: .utf8),
              let envelope = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let requests = envelope["requests"] as? [[String: Any]], requests.count <= 1,
              let after = envelope["storage"] as? [String: String], let status = envelope["status"] as? [String: Any]
        else { throw Failure.invalidProjection }
        var patches: [String: String] = [:]
        for key in profileKeys {
            let before = object(storage[key]), current = object(after[key])
            var patch: [String: Any] = [:]
            let fields = command["action"] as? String == "queueOn" ?
                ["reportId", "weeklyReport", "weeklyEmail", "email"] : ["reportId", "weeklyReport"]
            for field in fields where !equal(before[field], current[field]) {
                guard let value = current[field] else { throw Failure.invalidProjection }
                patch[field] = value
            }
            if !patch.isEmpty { patches[key] = try json(patch) }
        }
        let request = requests.first
        return Projection(body: try request.map { try JSONSerialization.data(withJSONObject: $0["body"]!, options: [.sortedKeys]) },
                          context: try request.map { try JSONSerialization.data(withJSONObject: $0["context"]!, options: [.sortedKeys]) },
                          reportState: after["sona.report.v1"], profilePatches: patches,
                          status: try JSONSerialization.data(withJSONObject: status, options: [.sortedKeys]))
    }
    private static func object(_ raw: String?) -> [String: Any] {
        guard let raw, let bytes = raw.data(using: .utf8) else { return [:] }
        return (try? JSONSerialization.jsonObject(with: bytes)) as? [String: Any] ?? [:]
    }
    private static func equal(_ a: Any?, _ b: Any?) -> Bool {
        if a == nil && b == nil { return true }
        guard let a, let b else { return false }
        return (a as? NSObject)?.isEqual(b) ?? false
    }
}

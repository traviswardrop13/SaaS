// Execute the Apple driver's actual Timer closures without Apple Speech or a
// microphone. A fired timer queues a MainActor job; invalidation alone cannot
// cancel that job. It must also reject the old recognition generation.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const args = process.argv.slice(2);
const at = args.indexOf('--source-file');
const checkMeter = args.includes('--check-meter');
if (args.some((value, index) => value !== '--check-meter' && value !== '--source-file' && !(at >= 0 && index === at + 1))) {
  throw Error('Use [--source-file /local/ApplePracticeAudioDriver.swift] [--check-meter]');
}
const sourcePath = at < 0 ? fileURLToPath(new URL('../Sources/SonaSpeechCore/ApplePracticeAudioDriver.swift', import.meta.url)) : args[at + 1];
if (!sourcePath || sourcePath.startsWith('--')) throw Error('--source-file needs a local Swift file');
const before = statSync(sourcePath);
const source = readFileSync(sourcePath, 'utf8');
const after = statSync(sourcePath);
if (before.mtimeMs !== after.mtimeMs || before.size !== after.size) throw Error('Source changed during snapshot; rerun');
function timerAssignment(name) {
  // Both spellings are production source. scheduledTimer also registers in
  // the default run-loop mode, so a manual current fire must be invalidated
  // before yielding to prevent an unrelated automatic second fire.
  const match = new RegExp('\\b' + name + '\\s*=\\s*Timer(?:\\(timeInterval:|\\.scheduledTimer\\(withTimeInterval:)').exec(source);
  const start = match?.index ?? -1;
  if (start < 0) throw Error('Review changed Timer source: ' + name);
  const open = source.indexOf('{', start);
  let depth = 1, index = open + 1;
  for (; index < source.length && depth; index++) {
    if (source[index] === '{') depth++;
    if (source[index] === '}') depth--;
  }
  if (depth) throw Error('Unbalanced Timer source: ' + name);
  const registration = source.slice(index, index + 500).match(new RegExp('if let ' + name + ' \\{ RunLoop\\.main\\.add\\(' + name + ', forMode: \\.common\\) \\}'))?.[0] ?? '';
  return { assignment: source.slice(start,index), registration };
}
const deadline = timerAssignment('recognitionDeadline').assignment;
const settle = timerAssignment('recognitionSettle').assignment;
const meter = checkMeter ? timerAssignment('meter') : null;
const folder = mkdtempSync('/private/tmp/sona-recognition-timer-check-');
const program = `import Foundation
import CoreFoundation
import Darwin
@MainActor final class Fixture {
  var recognitionGeneration = 1
  var recognitionDeadline: Timer?
  var recognitionSettle: Timer?
  var stopped = 0
  var settled = 0
  var meter: Timer?
  var metered = 0
  func emitFrame(generation: Int) { metered += 1 }
  func beginRecognitionStop() { stopped += 1 }
  func settleRecognition() { settled += 1 }
  func installDeadline() { let generation = recognitionGeneration; let duration = 0.01; ${deadline} }
  func installSettle() { let generation = recognitionGeneration; ${settle} }
  ${meter ? 'func installMeter() { let generation = recognitionGeneration; ' + meter.assignment + '; ' + meter.registration + ' }' : ''}
}
@main struct TimerCheck {
  @MainActor static func main() async {
    var failures = 0
    func check(_ okay: Bool, _ message: String) {
      print((okay ? "PASS " : "FAIL ") + message)
      if !okay { failures += 1 }
    }
    ${meter ? `// UIKit registers its tracking mode as common. Reproduce that
    // environment; execute the actual meter construction/registration above.
    let tracking = CFRunLoopMode(rawValue: "UITrackingRunLoopMode" as CFString)
    CFRunLoopAddCommonMode(CFRunLoopGetMain(), tracking)
    let metering = Fixture()
    metering.installMeter()
    CFRunLoopRunInMode(tracking, 0.08, false)
    metering.meter!.invalidate()
    for _ in 0..<100 { await Task.yield() }
    check(metering.metered > 0, "meter receives frames during tracking mode (observed \\(metering.metered))")` : ''}
    let fixture = Fixture()
    fixture.installDeadline(); fixture.recognitionDeadline!.fire()
    fixture.recognitionDeadline!.invalidate(); fixture.recognitionGeneration += 1
    for _ in 0..<100 { await Task.yield() }
    check(fixture.stopped == 0, "old queued deadline cannot stop a new saying (observed \\(fixture.stopped))")
    let currentDeadline = Fixture()
    currentDeadline.installDeadline(); currentDeadline.recognitionDeadline!.fire()
    currentDeadline.recognitionDeadline!.invalidate()
    for _ in 0..<100 { await Task.yield() }
    check(currentDeadline.stopped == 1, "current deadline closes recognition once (observed \\(currentDeadline.stopped))")
    fixture.installSettle(); fixture.recognitionSettle!.fire()
    fixture.recognitionSettle!.invalidate(); fixture.recognitionGeneration += 1
    for _ in 0..<100 { await Task.yield() }
    check(fixture.settled == 0, "old queued finalizer cannot settle a new saying (observed \\(fixture.settled))")
    let currentSettle = Fixture()
    currentSettle.installSettle(); currentSettle.recognitionSettle!.fire()
    currentSettle.recognitionSettle!.invalidate()
    for _ in 0..<100 { await Task.yield() }
    check(currentSettle.settled == 1, "current finalizer releases its waiter once (observed \\(currentSettle.settled))")
    if failures > 0 { exit(1) }
    print("PASS stale deadline/finalizer jobs rejected; current jobs execute")
  }
}
`;
writeFileSync(path.join(folder,'check.swift'),program);
writeFileSync(path.join(folder,'source.swift'),source);
const metadata = { sourcePath, sourceSHA256: createHash('sha256').update(source).digest('hex'),
  sourceMtimeUTC: after.mtime.toISOString(), checkMeter, folder };
process.stdout.write(JSON.stringify(metadata) + '\n');
const cache = '/private/tmp/sona-recognition-timer-module-cache';
mkdirSync(cache,{recursive:true});
execFileSync('xcrun',['swiftc','-parse-as-library','-swift-version','5','-module-cache-path',cache,
  path.join(folder,'check.swift'),'-o',path.join(folder,'check')],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
const run = spawnSync(path.join(folder,'check'),[],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
process.stdout.write(run.stdout ?? '');
process.stderr.write(run.stderr ?? '');
writeFileSync(path.join(folder,'result.json'),JSON.stringify({ ...metadata, exitCode: run.status,
  signal: run.signal, stdout: run.stdout, stderr: run.stderr },null,2) + '\n');
process.exitCode = run.status ?? 1;

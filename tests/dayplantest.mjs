// PLANDAY1: the session planner's server checks (lib/dayPlan.ts) and its
// route. Only a sound, a word position, an age range and minutes may reach
// the AI; a malformed reply never reaches the clinician. No network.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0, failures = 0;
function ok(name, pass, detail = "") { checks++; if (!pass) failures++; console.log((pass ? "PASS " : "FAIL ") + name + (!pass && detail ? " :: " + detail : "")); }

function load(file, modules) {
  const code = ts.transpileModule(readFileSync(path.join(root, file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require: (id) => {
    if (id in modules) return modules[id];
    throw new Error("unexpected import " + id);
  } });
  return module.exports;
}
const homework = load("lib/homework.ts", { "@/lib/slpAuth": { kvCmd: async () => null } });
const plan = load("lib/dayPlan.ts", { "@/lib/homework": homework });
const { validSessions, readPlans, PLAN_PROMPT, MAX_SESSIONS } = plan;

const one = { sound: "R", position: "i", age: "5-6", minutes: 30 };
ok("a well-formed day is accepted", JSON.stringify(validSessions({ sessions: [one] })) === JSON.stringify([one]));
const extra = validSessions({ sessions: [{ ...one, name: "Mia", childId: "c1", notes: "anything" }], name: "Mia" });
ok("anything beyond the four choices is dropped, never forwarded", JSON.stringify(extra) === JSON.stringify([one]), JSON.stringify(extra));
for (const [label, bad] of [
  ["no sessions", { sessions: [] }],
  ["too many sessions", { sessions: Array(MAX_SESSIONS + 1).fill(one) }],
  ["an unknown sound", { sessions: [{ ...one, sound: "Q" }] }],
  ["an unknown position", { sessions: [{ ...one, position: "x" }] }],
  ["vocalic R on another sound", { sessions: [{ ...one, sound: "S", position: "v" }] }],
  ["blends on a sound without them", { sessions: [{ ...one, sound: "K", position: "b" }] }],
  ["an unknown age range", { sessions: [{ ...one, age: "6" }] }],
  ["free minutes", { sessions: [{ ...one, minutes: 25 }] }],
  ["minutes as text", { sessions: [{ ...one, minutes: "30" }] }],
  ["a list, not an object", [one]],
  ["nothing", null],
]) ok("refused: " + label, validSessions(bad) === null);
ok("blends for S and vocalic R for R are accepted",
  validSessions({ sessions: [{ ...one, sound: "S", position: "b" }, { ...one, position: "v" }] })?.length === 2);

const reply = JSON.stringify({ sessions: [{ activities: [{ name: "Sound hunt", how: "Hide cards; each find is a turn." }, { name: "Race", how: "One space per try." }] }] });
ok("a well-formed reply is read", JSON.stringify(readPlans(reply, 1)) === JSON.stringify([[{ name: "Sound hunt", how: "Hide cards; each find is a turn." }, { name: "Race", how: "One space per try." }]]));
ok("a fenced reply is read", readPlans("```json\n" + reply + "\n```", 1)?.length === 1);
ok("at most three activities are kept", readPlans(JSON.stringify({ sessions: [{ activities: Array(5).fill({ name: "A", how: "B" }) }] }), 1)?.[0].length === 3);
for (const [label, bad, n] of [
  ["the wrong number of sessions", reply, 2],
  ["not JSON", "Here are some ideas", 1],
  ["no activities", JSON.stringify({ sessions: [{ activities: [] }] }), 1],
  ["an empty name", JSON.stringify({ sessions: [{ activities: [{ name: " ", how: "x" }] }] }), 1],
  ["an overlong idea", JSON.stringify({ sessions: [{ activities: [{ name: "A", how: "x".repeat(221) }] }] }), 1],
]) ok("rejected reply: " + label, readPlans(bad, n) === null);

ok("the prompt asks for play-based activities and leaves words to the clinician",
  /play-based activities/.test(PLAN_PROMPT) && /Do not list practice words/.test(PLAN_PROMPT) && /Do not diagnose, set goals, evaluate, score, or mention a child by name/.test(PLAN_PROMPT));

const route = readFileSync(path.join(root, "app/api/slp/sessions/plan/route.ts"), "utf8");
ok("the route checks the session, origin, rate limit and plan before calling the AI",
  ["liveSession(readSession(req))", "origin !== req.nextUrl.origin", "rateLimit(req", "dashboardGate(session.email)", "validSessions("].every((s) => route.indexOf(s) >= 0 && route.indexOf(s) < route.indexOf("messages.create")));
const sent = (route.match(/content: JSON\.stringify\(([\s\S]*?)\)\),\n/) || [])[1] || "";
ok("only the sound, position words, age and minutes are sent", /sound: s\.sound, position: POS_WORDS\[s\.position\], age: s\.age, minutes: s\.minutes/.test(sent), sent);
ok("the route exports only its handler, runtime and time limit", (route.match(/^export /gm) || []).length === 3 && /^export const maxDuration = 30;/m.test(route));

console.log(checks + " checks; " + failures + " failures");
process.exitCode = failures ? 1 : 0;

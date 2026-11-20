// Run the exact current Sona selection rules without a browser, mic or server.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { feedSelection } from "../tools/export-feed-selection.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const source = path => readFileSync(resolve(root, path), "utf8");
// Reuse the repository's minimal page/clock harness, not a second Sona model.
const suite = source("tests/trophytest.mjs");
const bootSource = suite.slice(suite.indexOf("function boot(opts = {})"), suite.indexOf("const DAY ="));
const setup = vm.createContext({ vm, readFileSync, ROOT: resolve(root, "public"), console, setTimeout, clearTimeout, setInterval, clearInterval });
vm.runInContext(bootSource + ";this.makeBoot = boot;", setup);
const exported = feedSelection(source);
new Function(exported);
let checks = 0;
const check = (condition, label) => { checks++; assert(condition, label); };
for (const sound of ["R", "S", "L", "SH", "CH", "TH", "THV", "K", "F"]) {
  for (const position of ["i", "m", "f", "mixed"]) {
    const p = setup.makeBoot({ profile: { focusSounds: [sound], targetSound: sound, wordPosition: position, childAge: "7" } });
    vm.runInContext(source("public/gamecontent.js"), p.ctx);
    vm.runInContext(exported, p.ctx);
    const result = vm.runInContext("nativeFeedGame({})", p.ctx);
    check(result && result.turns.length === 5, sound + "/" + position + " has an original five-word round");
    check(result.sound === p.S.rotSound(), "round uses canonical rotation sound");
    const pool = p.S.playPool(result.sound, 8);
    const valid = new Set(pool.map(w => w.w));
    check(result.turns.every(t => valid.has(t.target.word)), "every target belongs to the position-aware canonical pool");
    check(new Set(result.turns.slice(0, Math.min(pool.length, 5)).map(t => t.target.word)).size === Math.min(pool.length, 5), "words do not repeat until the actual pool is exhausted");
    for (const turn of result.turns) {
      const canonical = pool.find(w => w.w === turn.target.word);
      check(turn.target.position === (canonical.pos || ""), "canonical word position survives projection");
      check(turn.choices.some(w => w.word === turn.target.word), "the actual target has a picture");
      check(turn.ask === "Where is the " + turn.target.word + "? Say... " + turn.target.word + "." && turn.repeatAsk === "Say... " + turn.target.word + ".", "authored first and repeat asks survive");
      check(turn.markedWord === p.S.soundMark(turn.target.word, result.sound, turn.target.position), "sound letters are marked by the original rule");
    }
    check(result.policy.voicedFrames === 4 && result.policy.quietMilliseconds === 200 && result.policy.listenMilliseconds === 8_000, "Feed keeps its distinct source thresholds");
    check(!p.local[p.S.kkey("sona.gamereps.v1")] && !p.local[p.S.kkey("sona.feed.v1")], "building a board earns and grows nothing");
  }
}
const p = setup.makeBoot({profile:{focusSounds:["R"],childAge:"7",wordPosition:"i"}});
p.local[p.S.kkey("sona.homework.v1")] = JSON.stringify({hw:{id:"synthetic",sounds:["S"],pos:"m",words:["pencil","bicycle"],start:"2000-01-01",due:"2999-01-01",repsPerDay:10},at:1});
vm.runInContext(source("public/gamecontent.js"), p.ctx); vm.runInContext(exported, p.ctx);
const assigned = vm.runInContext("nativeFeedGame({sound:'R'})", p.ctx);
check(assigned.sound === p.S.rotSound() && assigned.turns.every(t => ["pencil", "bicycle"].includes(t.target.word)), "homework overrides a conflicting route request through the canonical pool");
console.log(`Feed selection: ${checks} checks passed`);

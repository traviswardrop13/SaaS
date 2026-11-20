import assert from "node:assert/strict";

// Keep the page's actual pool, distractor and shuffle bodies. This export only
// projects a round; it never calls gameRep, writes growth or opens a device API.
export function feedSelection(source) {
  const page = source("public/arcade-feed.html");
  function between(start, end) {
    const a = page.indexOf(start), b = page.indexOf(end, a);
    assert(a >= 0 && b > a, "Feed source boundary changed: " + start);
    return page.slice(a, b);
  }
  const pool = between("    function pool(sound)", "    // ── tiny cached TTS");
  assert(pool.includes("S.playPool(sound,8)") && pool.includes("S.hasSound(w.w,SOUND)"));
  const shuffle = between("    function shuffle(a)", "    function nextTurn()");
  const pick = between("      var ti; do{", "      var opts=[target]");
  assert(pick.includes("usedIdx.push(ti)") && !pick.includes("feedMicStop"));
  const options = between("      var opts=[target]", "      // the words stay");
  const firstAsk = page.match(/sayGo\(("Where is the "\+target\.w[^\n]+)\)\.then/);
  const repeatAsk = page.match(/sayGo\(("Say\.\.\. "\+target\.w[^\n]+)\)\.then/);
  assert(firstAsk && repeatAsk, "Feed's authored asks changed");
  const floor = page.match(/var FLOOR_MS=(\d+), HEARD_MS=(\d+), micFloor=-1/);
  const listen = page.match(/var LISTEN_MS=(\d+), listenT=0/);
  const voiced = page.match(/var thr=Math\.max\((0\.\d+),micFloor\*(\d+)\),voiced=0/);
  const frames = page.match(/if\(voiced>=(\d+)\)\{/);
  const quiet = page.match(/if\(now-lastLoud>=(\d+)\)\{finishWord/);
  const round = page.match(/var NEED=(\d+), fed=0/);
  const tail = page.match(/var SETTLE_MS=(\d+), QUIET_MS=(\d+), VOICE_TAIL_MS=(\d+)/);
  const percentile = page.match(/a\[Math\.floor\(\(a\.length-1\)\*(0\.\d+)\)\]/);
  const low = page.match(/fam==="low"&&cent>(\d+)&&high>(\.[\d]+)/);
  const hiss = page.match(/fam==="hiss"&&cent<(\d+)&&high<(\.[\d]+)/);
  assert(floor && listen && voiced && frames && quiet && round && tail && percentile && low && hiss, "Feed's numerical contract changed");
  const policy = {
    floorMilliseconds: Number(floor[1]), historyMilliseconds: Number(floor[2]),
    listenMilliseconds: Number(listen[1]), minimumRMS: Number(voiced[1]),
    roomMultiplier: Number(voiced[2]), voicedFrames: Number(frames[1]),
    quietMilliseconds: Number(quiet[1]), settleMilliseconds: Number(tail[1]),
    soundQuietMilliseconds: Number(tail[2]), voiceTailMilliseconds: Number(tail[3]),
    roomPercentile: Number(percentile[1]), lowMaximumCentroid: Number(low[1]), lowMaximumHighFraction: Number(low[2]),
    hissMinimumCentroid: Number(hiss[1]), hissMinimumHighFraction: Number(hiss[2]),
  };
  return `// Verbatim selection and authored asks from public/arcade-feed.html.
function nativeFeedGame(options) {
    var S = Sona, SOUND = (S && S.rotSound) ? S.rotSound() : "R";
${pool}
${shuffle}
    if (!TARGETS.length) return null;
    var usedIdx = [], turnN = 0, target = null, turns = [];
    function word(item) { return { word: item.w, emoji: item.e || "", position: item.pos || "" }; }
    for (var index = 0; index < ${Number(round[1])}; index++) {
${pick}
${options}
        turns.push({ target: word(target), choices: opts.map(word),
            ask: ${firstAsk[1]}, repeatAsk: ${repeatAsk[1]},
            markedWord: S.soundMark ? S.soundMark(target.w, SOUND, target.pos) : target.w });
    }
    var profile = S.getProfile(), feed = {};
    try { feed = JSON.parse(localStorage.getItem(S.kkey("sona.feed.v1")) || "{}"); } catch (_) {}
    return { title: "Feed Echo", sound: SOUND, soundLabel: S.soundLabel(SOUND), family: S.soundFamily(SOUND),
        voice: profile.voiceId || "", voiceOn: profile.voiceOn !== false, soundOn: profile.soundOn !== false,
        volume: profile.volume == null ? 0.8 : Number(profile.volume), micReady: localStorage.getItem("sona.micok") === "1",
        microphonePromise: S.MIC_PROMISE, lifetimeFed: Number(feed.fed) || 0, turns,
        policy: ${JSON.stringify(policy)} };
}
`;
}

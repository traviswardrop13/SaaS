// HEARTSROW1: a round game's three hearts stay on one line in the top bar,
// whatever the count beside them says. In Piano Tiles the count going from
// "9" to "10" widened its pill, the hearts' box gave up the room, and the
// third heart folded under the other two inside a taller pill; Block Stacker
// at 390 and Flappy Glide at 320 did the same (found 20 Oct 2026, fixed then
// on a branch that never reached main; found again by the audit of 5 Nov 2026).
//
// Shared by the six round games' own suites (Fruit Slice, Piano Tiles, Block
// Stacker, Sound Sprint, Flappy Glide, Rise Up). On one open page it tries
// each phone width the games are drawn for with a 1-, 2- and 3-digit count in
// the count the child SEES (Sound Sprint's is its stars, #coinN: its metres
// pill is hidden), beside each word the right-hand pill can show, and returns
// what went wrong (an empty list when nothing did):
//   - the hearts share one row, at their full size;
//   - nothing in the top bar runs past the screen's right edge, and nothing
//     spills out of its own pill (the right-hand pill's bar is what gives way,
//     never its words);
//   - the close button does not move as the count grows.
// The count and the words are written straight into the page and put back, so
// a suite's own watchers see them come and go: call it on a page that is not
// asserting on them. `words` are the right-hand pill's longest labels: a
// string keeps the pill's progress bar, { word, bar: false } is a label the
// game shows with no bar ("Finish!", "Landing!").
export async function heartsOffRow(page, words = []) {
  await page.waitForFunction(() => document.querySelectorAll("#hudspacer svg").length === 3 && (document.getElementById("best") || document.getElementById("timer")).textContent.trim() !== "");
  const size = page.viewportSize(), bad = [];
  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ width, height: size.height });
    const r = await page.evaluate((words) => {
      const count = document.getElementById("coinN") || document.getElementById("score"), was = count.textContent, unit = /m$/.test(was) ? "m" : "", out = [];
      const wv0 = document.querySelector("#timer .wv, #best .wv"), pill = wv0 ? wv0.parentNode : null, pillWas = pill ? pill.innerHTML : null;
      const box = (el) => el.getBoundingClientRect();
      let close0 = null, size0 = null;
      for (const w of [null].concat(words)) {
        const word = w && typeof w === "object" ? w.word : w;
        if (pill && word) { pill.innerHTML = pillWas; pill.querySelector(".wv").textContent = word; if (w.bar === false && pill.querySelector(".wbar")) pill.querySelector(".wbar").remove(); }
        for (const n of ["1", "10", "52", "100"]) {
          count.textContent = n + unit;
          const hearts = [...document.querySelectorAll("#hudspacer svg")], rows = new Set(hearts.map((h) => Math.round(box(h).top))).size;
          const heart = hearts.length ? Math.round(box(hearts[0]).width) : 0;
          const shown = [...document.getElementById("top").children].filter((k) => !k.hidden && getComputedStyle(k).display !== "none");
          const off = shown.filter((k) => box(k).right > innerWidth).map((k) => k.id || k.className);
          const spill = shown.filter((k) => [...k.children].some((c) => box(c).width > 0 && (box(c).right > box(k).right - 1 || box(c).left < box(k).left + 1))).map((k) => k.id || k.className);
          const cut = shown.filter((k) => [...k.querySelectorAll(".wv,b")].some((c) => c.scrollWidth > c.clientWidth + 1)).map((k) => k.id || k.className);
          const c = box(document.getElementById("close")), close = Math.round(c.left) + "," + Math.round(c.top);
          if (close0 === null) { close0 = close; size0 = heart; }
          if (hearts.length !== 3 || rows !== 1 || heart !== size0 || off.length || spill.length || cut.length || close !== close0) out.push({ word, count: n, hearts: hearts.length, rows, heart, size0, off, spill, cut, close, close0 });
        }
      }
      count.textContent = was; if (pill) pill.innerHTML = pillWas;
      return out;
    }, words);
    r.forEach((x) => bad.push(Object.assign({ width }, x)));
  }
  await page.setViewportSize(size);
  return bad;
}

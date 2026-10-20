// HEARTSROW1: a round game's three hearts stay on one line in the top bar,
// whatever the count beside them says (20 Oct 2026). In Piano Tiles the count
// going from "9" to "10" widened its pill, the hearts' box gave up the room,
// and the third heart folded under the other two inside a taller pill.
//
// Shared by the six round games' own suites (Fruit Slice, Piano Tiles, Block
// Stacker, Sound Sprint, Flappy Glide, Rise Up). On one open page it tries
// each phone width the games are drawn for with a 1-, 2- and 3-digit count,
// and returns what went wrong (an empty list when nothing did):
//   - the hearts share one row;
//   - nothing in the top bar runs past the screen's right edge, and nothing
//     spills out of its own pill (the right-hand pill's bar is what gives way);
//   - the close button does not move as the count grows.
// The count is written straight into #score and put back, so a suite's own
// watchers see it come and go: call it on a page that is not asserting on them.
export async function heartsOffRow(page) {
  await page.waitForFunction(() => document.querySelectorAll("#hudspacer svg").length === 3 && (document.getElementById("best") || document.getElementById("timer")).textContent.trim() !== "");
  const size = page.viewportSize(), bad = [];
  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ width, height: size.height });
    const r = await page.evaluate(() => {
      const score = document.getElementById("score"), was = score.textContent, unit = /m$/.test(was) ? "m" : "", out = [];
      const box = (el) => el.getBoundingClientRect();
      let close0 = null;
      for (const n of ["1", "10", "100"]) {
        score.textContent = n + unit;
        const hearts = [...document.querySelectorAll("#hudspacer svg")], rows = new Set(hearts.map((h) => Math.round(box(h).top))).size;
        const shown = [...document.getElementById("top").children].filter((k) => !k.hidden && getComputedStyle(k).display !== "none");
        const off = shown.filter((k) => box(k).right > innerWidth).map((k) => k.id || k.className);
        const spill = shown.filter((k) => [...k.children].some((c) => box(c).right > box(k).right - 1 || box(c).left < box(k).left + 1)).map((k) => k.id || k.className);
        const c = box(document.getElementById("close")), close = Math.round(c.left) + "," + Math.round(c.top);
        if (close0 === null) close0 = close;
        if (hearts.length !== 3 || rows !== 1 || off.length || spill.length || close !== close0) out.push({ count: n, hearts: hearts.length, rows, off, spill, close, close0 });
      }
      score.textContent = was;
      return out;
    });
    r.forEach((x) => bad.push(Object.assign({ width }, x)));
  }
  await page.setViewportSize(size);
  return bad;
}

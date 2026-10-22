// One fuller book's files, as build.mjs writes them: cover.svg (440 x 440) and
// p01.svg … p12.svg (440 x 400). Pure, like tools/gameart/page.mjs, so the
// test can compare what is on disk with what the builder would write.
//
// Every file carries MARK just inside its <svg> tag. It is how build.mjs tells
// its own pictures from hand-made ones saved under the same name (Rory's pages
// are .svg too): it overwrites a file only if the file says it wrote it.
export const MARK = "<!-- Written by tools/bookart/build.mjs: change the page there and rebuild, not here. -->";

const wrap = (inner, h) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 ${h}" width="440" height="${h}">${MARK}${inner}</svg>\n`;

// Whether a file still opens the way wrap() writes it: MARK straight after an
// opening <svg> tag that starts the file. Containing MARK is not enough,
// because the likeliest way to hand-draw a page under the builder's name is
// to open the old one in an editor and redraw it, and an editor that keeps
// comments (Inkscape) keeps MARK too, while adding its own <?xml> header and
// reflowing the tag. So anything else counts as hand-made, and a reformatted
// page is refused rather than drawn over. (A hand edit that leaves the first
// bytes alone gets past this; tests/arttooltest.mjs's byte-for-byte pin fails
// on it before it can be committed.)
export function builtHere(svg) {
  const open = /^<svg\b[^>]*>/.exec(svg);
  return !!open && svg.startsWith(MARK, open[0].length);
}

export function bookFiles(b) {
  if (b.pages.length !== 12) throw new Error(b.slug + " has " + b.pages.length + " pages");
  return [["cover.svg", wrap(b.cover(), 440)], ...b.pages.map((fn, i) => ["p" + String(i + 1).padStart(2, "0") + ".svg", wrap(fn(), 400)])];
}

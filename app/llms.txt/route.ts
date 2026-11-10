import { FREE_MODE, WEB_SALES } from "@/lib/pricing";
import { SITE, guidePath, liveGuides } from "@/lib/guides";

/**
 * /llms.txt: what Sona is, in plain text, for AI assistants (the llmstxt.org
 * convention). A parent asks ChatGPT, Claude or Perplexity how to do speech
 * practice at home; this is what they read about Sona. So every line is one
 * the parent page (parents.html) already says, and as true:
 * - for parents only (Travis, 22 Oct 2026); nothing about the clinician side;
 * - Rachel's credential is the settled line, word for word;
 * - the cost line is the parent page's own three answers, chosen by the same
 *   switches it reads through /api/charter, and never a dollar figure (on an
 *   iPhone the App Store sets the price, and the app shows it first);
 * - no count of games or books (they change; the parent page's are pinned to
 *   the catalog, this file's would not be).
 * - the guides for parents (lib/guides.ts), only those Rachel has read, each
 *   with its own search description.
 * `shiptest` scans it; `guidestest` holds the guides' list.
 */
export const dynamic = "force-static";

export function GET() {
  const cost = FREE_MODE
    ? "Right now, all of Sona is free: daily practice, every game and every book, with no card."
    : !WEB_SALES
      ? "Sona is free to download. Sona Premium opens every game and every book. You buy it in the Sona app on iPhone and iPad, which shows its price before you pay anything."
      : "Sona is free to download. Sona Premium opens every game and every book, and the app shows its price before you pay anything.";
  const live = liveGuides();
  const guides = live.length
    ? "## Guides for parents\n" + live.map((g) => `- [${g.h1}](${SITE}${guidePath(g)}): ${g.description}`).join("\n") + "\n\n"
    : "";
  const body = `# Sona

> Sona (speaksona.com) is a speech practice app for kids about 3 to 8, for parents and caregivers to use at home. A few playful minutes a day: the child practices their speech sound out loud, in short games and picture books with Echo, a friendly bird. Built with Rachel, MS, CF-SLP, a pediatric speech-language pathologist in her clinical fellowship.

## What it is for
- Daily speech sound practice at home, between speech therapy visits or on its own.
- Practice, not a test: Sona doesn't diagnose, evaluate or set therapy goals. If a parent is worried about their child's speech, a speech-language pathologist is the right person to ask.
- 19 speech sounds: P, B, M, N, T, D, K, G, F, V, S, Z, SH, CH, J, L, R, and both TH sounds (as in "thumb" and "this").

## How it works
- A grown-up picks the child's sounds. Echo says a word, the child says it, and the game moves on. Silence never counts.
- Every try is checked on the phone itself, for the shape of the sound. No audio ever leaves the device. It's tuned to American English.
- No ads in the app, no selling data, and a child's name is never sent to ads or analytics.

## Cost
- ${cost}

## Where
- iPhone and iPad, from the App Store. On an Android phone it works in the web browser.

${guides}## Links
- [Sona for parents](https://www.speaksona.com/): what Sona is and how to start
- [Sona on the App Store](https://apps.apple.com/us/app/sona-speech/id6785755867)
- [Privacy](https://www.speaksona.com/privacy.html)
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

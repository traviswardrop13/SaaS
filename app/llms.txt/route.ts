import { FREE_MODE } from "@/lib/pricing";

// /llms.txt — a plain-text summary of Sona for AI assistants (the llmstxt.org
// convention). ChatGPT, Claude and Perplexity read it when a parent asks for
// speech-practice ideas, so every line must be as true as the pages: the
// price line reads the switch rather than being typed in (the price has
// flipped a dozen times), no figure appears because the family price moves
// with the charter count, and Rachel's credential is the settled wording —
// never "certified" or "CCC". It speaks to parents only: speaksona.com is
// for families (Travis, 22 Oct 2026), so the clinician side is not offered.
export const dynamic = "force-static";

export function GET() {
  const cost = FREE_MODE
    ? "Free right now: every released game and every sound, with no card and no trial."
    : "Free to start: daily practice and free games cost nothing, with no card. Sona Premium adds every game.";
  const body = `# Sona

> Sona (speaksona.com) is a speech-practice app for kids ages 4–9. A child practices a tricky speech sound — like R, S or L — for a few minutes a day by saying it out loud to play short games with Echo, a friendly parrot coach. Built with a licensed pediatric speech-language pathologist. Works on iPhone, iPad and in any web browser.

## What it is for
- At-home speech sound practice between speech therapy sessions, or for families who want daily practice with their child.
- Practice, not an evaluation: Sona does not diagnose and does not replace a speech-language pathologist.

## How it works
- A grown-up picks the child's sound. The child says practice words out loud; a game moves forward only when the child actually speaks — silence never counts.
- The listening happens on the device. No audio of the child's voice is ever uploaded.
- Parents see practice days and progress. A child's speech therapist can see practice too, only if the parent says yes.

## Cost
- ${cost}

## Links
- [Sona](https://speaksona.com/): what Sona is and how to start
- [iPhone and iPad app](https://apps.apple.com/us/app/sona-speech/id6785755867)
- [Privacy](https://speaksona.com/privacy)
- [Support](https://speaksona.com/support)
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

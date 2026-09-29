# Full-screen books and read-and-repeat prototype

Requested by Travis on 28 September 2026. Local preview only; no publication or Home rollout.

The illustration fills the reader viewport, with the sentence and controls along the bottom. Echo reads the unchanged sentence, says “Say [word]”, then opens the microphone after narration ends. A voiced attempt followed by quiet closes the microphone and turns exactly one page. Silence, permission denial, cancellation, and device errors stay on the same page. After 15 seconds without a response, the child can retry. Replay, close, previous-page navigation and backgrounding cancel pending speech and recording. Input is released before the next narration begins.

Microphone evidence is processed entirely on the device using the existing harmonic voicing approach. There is no speech transcript or cloud audio request. This detects a voiced attempt; it cannot establish that the speaker is the child or that the requested word was said correctly. Other nearby speech may satisfy the gate. A successful local clip uses the existing per-child, at-most-one-recording-per-day storage path. It adds no scored practice rep or clinician outcome.

## Rachel's review before publication

Previously the child could advance a page with Next. This prototype requires a voiced attempt after one specific word prompt on every page. Under CLAUDE.md, the prompt selection and rule for accepting an attempt need Rachel's review because they change what a child is asked to say. Review the table below and whether a voiced attempt is appropriate for this reading activity. These are proposed words, not a clinically approved progression; original story sentences remain unchanged.

| Book | Target words, pages 1–6 |
| --- | --- |
| Rory | Rory, rocket, rock, ring, river, Rory |
| Reba | Reba, rose, rabbit, ribbon, Rain, ready |
| Ruby | Ruby, rise, red, Ruby, rooster, run |
| Remy | Remy, rock, red, raft, reeds, Remy |
| Rex | Rex, road, rolls, red, rabbit, Run |
| Sunny | sun, silly, sand, soup, song, Sunny |
| Lily | lemon, log, leaf, laughs, look, loves |
| Kiki | cake, key, kite, cookie, cat, cool |
| Shelly | shoes, shell, ship, wish, milkshake, Shelly |
| Charlie | cherries, Charlie, cheese, chair, chips, cheep |
| Theo | thinks, three, thumbs, teeth, bath, Thank |
| Gus | goat, gift, guitar, gate, giggles, game |
| Fifi | Fifi, fish, feet, fast, fun, Fifi |

All words occur in their page's sentence. Theo uses unvoiced TH, including final TH in teeth/bath and a cluster in three. Shelly includes final SH in wish and medial SH in milkshake. Word position is not filtered by the child's prescribed position in this prototype.

## Verification

`tests/bookflowtest.mjs` covers narration/prompt/microphone ordering, silence and timeout blocking, a voiced response advancing once, local recording, cancellation and late permissions. It also exercises real Web Audio with synthetic silence, a pure tone, noise and a harmonic voice-like burst. The regression was run against the saved pre-change page and shared script in `output/books-flow/before/public` and failed before the implementation. Browser fixtures do not validate a real child's voice or iPhone microphone performance; those need device review.

The full release battery must pass before any push. This prototype remains local.

Current checks: book-flow regression 25/25, existing read-aloud suite 25/25, syntax suite and TypeScript all passed (exit 0). This includes all six responses completing a book and returning to the shelf without an open microphone. Phone layouts at 320×568 and 390×844 and tablet layout at 1024×768 were inspected; screenshots are in `output/books-flow/`. The five R books also passed 1,020 layout bounds checks across covers, pages and completion states at those sizes.

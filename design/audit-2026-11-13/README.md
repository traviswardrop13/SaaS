# App audit, 13 Nov 2026

Travis asked for a full read of the app: bugs, and ways to make it better.
Twenty areas were each read by one helper. One report per area is in this
folder. Each bug says what a child or parent sees, where it is (`file:line`)
and how sure the helper was: CONFIRMED (made to happen on the test phone),
LIKELY (traced in the code) or UNSURE. **Check a LIKELY item before fixing
it.** Nothing in the app was changed by the audit.

Clinical items (what a child is asked to say, what counts) are Rachel's.
Nothing merges without Travis's "merge".

## Fix order

1. **Today, no code (Travis):** a spending cap in ElevenLabs.
2. **Security and broken promises**
   - A new therapist account is signed in before the inbox is proved (`server.md`).
   - `/api/tts` open to anyone, per-IP limit only (`server.md`).
   - `/founding.html` gives Premium to anyone and stores a child's name (`server.md`).
   - Removing the first child deletes nothing; "Undo last restore" leaves an added child (`grownups.md`, `core.md`).
   - Parked pages that send a child's name off the phone: `story.html`, `coach-call.html`, maybe `check.html` (`core.md`, `website.md`).
   - No reachable "Stop sharing" for a family (`clinician.md`).
   - Old open routes to delete; forged `/api/track` events (`server.md`).
3. **Money**
   - Home asks the store who has Premium and never repaints (`home.md`, `price.md`).
   - Settings' Restore is the website's email restore in the iPhone app (`price.md`, `grownups.md`).
4. **Rachel decides first:** in the iPhone app a whole word counts only on Apple's
   clear yes, with no fallback, so a child it cannot understand is stuck in the
   word games, books, stories, Feed Echo and the practice page's word steps
   (`listening.md`, also `sayplay.md`, `stories.md`, `books-rewards.md`).
   Also: one slow answer from Apple breaks word listening until reload.
5. **First five minutes**
   - Fruit Slice takes all three hearts in about 7.5 s from a child who has not swiped (`round-a.md`).
   - R is pre-ticked on setup's sounds screen (`setup.md`).
   - Echo is silent after a quiet or failed try (`practice.md`, `sayplay.md`, `round-b.md`).
   - A talking story forgets its page (`stories.md`).
   - A part-round on the practice page can count as a step win (`practice.md`, LIKELY).
6. **Stuck-child bugs in games:** Observatory gears (`daily-b.md`), Lantern lamps and
   Bakery oven (`daily-a.md`), Wind-Up Toys taps and Puzzle Bridge holds (`storygames.md`).
7. **Check on a real phone:** Sound Sprint and Flappy Glide move per frame, so they
   may run twice as fast at 120 Hz (`round-b.md`).
8. **Website and words:** the share picture says "licensed"; "Start free"; the Meta
   pixel is missing from the privacy page; the age-gate claim; Support and Terms
   leftovers (`website.md`).
9. **Therapist dashboard:** only the first try of a session arrives; a lapsed account
   cannot remove a child on screen; no Archive button (`clinician.md`).
10. **Bigger product moves:** the word as part of the game; simpler ages 3-4 story
    games; hats that show in games; something after Day 14; rebuild Race Car, Castle
    Builder and Grow a Flower; one look across the app (`rebuilt-a.md`,
    `rebuilt-b.md`, `daily-a.md`, `daily-b.md`, `books-rewards.md`, `stories.md`).

`setup.md`, `price.md` and `home.md` came from the first pass; the rest from the second.

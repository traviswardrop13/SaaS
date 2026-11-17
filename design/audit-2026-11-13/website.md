# Website (what a parent sees before the app)

## In five lines
1. The home page and /try are clean, fast and honest in tone. /try is a good short ad bridge: one button, Rachel's line, no email gate.
2. The home page makes a parent type an email BEFORE they can reach the App Store. If the server is down or the rate limit hits, they are stuck. /try has no such gate.
3. Three claims are not true today: "Sona waits on a sound until a child is old enough", the share picture's "licensed" line, and "Free to start" for a family who meets the price before the first game.
4. The privacy page never mentions the Meta ad pixel that runs on the home page, /try and the Speech Check. /try has no privacy link at all.
5. Support page and Terms still carry templates, a personal Gmail, and stale how-to-cancel and "in your browser" text.

## Bugs
### P1
**B1. The share picture says "licensed" and "kids ask for".** Sees: anyone who shares speaksona.com (iMessage, Facebook, Slack) gets a card reading "Built with a licensed pediatric speech-language pathologist" and the old headline. Steps: open public/og-parents.png. Where: public/og-parents.png, used by parents.html:62,72 and try.html:34. The CLAUDE.md rule bans this exact phrase on every surface and requires Rachel named; shiptest cannot read pixels, so it passes. Status: CONFIRMED (opened the file). Fix: redraw with the settled line, "Built with Rachel, MS, CF-SLP...".

**B2. Home page claims Sona holds back sounds by age; the code does not.** Sees: "The right sound at the right age. Sona waits on a sound until a child is typically old enough" (parents.html:589) and FAQ "holds back a sound... R isn't expected until about age 7" (parents.html:731). Where it is false: Sona.soundNorm is used only for a grey "by ~Ny" label in settings.html:548 and the book word moment, library.html:1779; CLAUDE.md:5871 says nothing gates a sound by age, and setup picks R for 2-4 year olds. Status: LIKELY (traced every soundNorm use). A parent of a 4-year-old on R sees the opposite. For Rachel. Fix: reword ("Sona shows each sound's usual age and Rachel picks the order") or build the gate.

**B3. Email-first gate on the home page.** Sees: a parent types an email, taps Start free; if /api/lead errors, is rate-limited (10 per hour per IP, app/api/lead/route.ts:91, shared on school and mobile networks), or the address is mistyped in shape, the button just shows an error and the App Store is never reached. Where: parents.html:885-913 (the catch and the !j.ok branches never call leave()). Status: LIKELY. Fix: on failure still offer the App Store link ("Skip, take me to the App Store").

**B4. Privacy policy omits the Meta pixel.** Sees: a parent reading privacy.html finds PostHog but no Meta/Facebook. Where: privacy.html:255-281 (grep for Meta/Facebook/pixel finds nothing) versus pixel.js on parents.html:90, try.html:44, check.html:17, onboarding, subscribe. Only the home-page FAQ (parents.html:751) discloses it. Status: CONFIRMED by grep. Fix: add a paragraph; consider a "Do not sell or share" link (CPRA). Lawyer's call.

**B5. /try has no privacy link, no disclaimer, yet loads the Meta pixel and PostHog recording.** try.html:44-45,109. Status: CONFIRMED. Fix: add a footer line "Not therapy or a diagnosis. Privacy" and mention recording.

**B6. check.html: the Meta pixel runs with Meta's automatic form reading ON on a page with a "Child's first name" box.** (Your question a.) pixel.js:40 turns off autoConfig only when the script tag has data-autoconfig="off"; onboarding.html:25 does, check.html:17 does not, nor parents.html:90. check.html:78 has `<input id="cName">` labelled "Child's first name", plus an email box (check.html:106). With autoConfig on, Meta's script can read form fields (automatic advanced matching: hashed first name / email) and button text; the existing test only checks sonaTrack() calls (telemetrytest.mjs:172-183), not Meta's own scanning. Whether the name actually leaves depends on the Events Manager "automatic advanced matching" toggle, which I cannot see. Status: UNSURE (path is clear; the setting is unverified). Exposure is limited: the page is noindex and nothing links to it (only a stray ad could). Fix: add data-autoconfig="off" to check.html and parents.html (the latter has the parent's email box), or delete check.html.

**B7. Speech Check page is stale.** After the email gate it says "We'll email you the moment it's ready" (check.html:272, the app launched 1 Oct), "Start practicing free" and "works on any device, no credit card" (check.html:130-131, true only on the web free version), and silently saves a profile with onboarded:true (check.html:267) so a browser visitor skips setup. Status: LIKELY. Fix: retire the page or update it; Rachel owns whether it stays (CLAUDE.md).

### P2
**B8. "Free to start" / "Start free" / "Free to try on iPhone and iPad"** (parents.html:40,423,770; try.html:29,107). In the iPhone app a new family meets the price first; "Not now" leaves everything locked, so nothing is free to start. The FAQ (parents.html:727) is accurate; the buttons and meta are not. Status: LIKELY. Wording choice for Travis ("Start free trial" is true and needs no number).

**B9. Terms and Support are out of date** (see Experience). Terms line 330 prints "This document is a template and not legal advice... have it reviewed by a qualified attorney before launch" to every reader (terms/page.tsx:330). Support says "Sessions run in your browser" (support/page.tsx:51) and "cancel anytime from your account" (:56), wrong for iPhone (Apple Settings, Subscriptions). Status: CONFIRMED by reading.

**B10. Terms never mention the one-payment ($59.99) purchase.** The app sells it as "Yours Forever", but terms/page.tsx:366-421 describes only yearly and monthly, and says monthly "has no free trial" (:405-407) while the app's monthly has a store free trial. The app line at :440 covers Apple trials in general, not the one payment. Status: LIKELY. Lawyer and Travis.

**B11. og:image uses the bare domain** (parents.html:62, try.html:34) which 308-redirects to www; some scrapers do not follow. UNSURE. Fix: use https://www.

**B12. launching.html and the lock code are dead weight** (LAUNCH_LOCK false; lib/launch.ts:50). Title says "opens Friday, October 2". Harmless unless the flag is flipped.

**B13. privacy.html still says the Talk-to-us message holds "whether you would recommend Sona"** (:140); CLAUDE.md says that question was removed. Also mentions AI daily stories with child names (:70, :197) that may be parked. Fix: re-check with the code.

## Experience problems
- 5-second test on /try (390x844): yes. Headline, the game screens, "Try Sona free", Rachel's line. Missing: what the first minute looks like, any proof, price, rating, App Store badge, privacy link.
- Home page phone: headline, email box and Rachel are all above the fold. But the button says "Start free", then an email box, which reads like an account sign-up, not "get the app". Page is ~10,600 px tall on a phone (about 12 screens), 980 KB first load phone, 1.7 MB laptop; only /fonts.css blocks paint. Fine.
- Laptop and Android: the home page and /try send a laptop to apps.apple.com, which on Windows or Linux is a dead end. Rescue exists but is hidden: the welcome email carries the App Store link (lib/nurture.ts:43). The page never says "we emailed you the link". Android gets the web app (/onboarding.html) with "Free to try in your browser": works, not a dead end.
- Screens shown are the old ads' screens on purpose (hero), and "slice.webp/piano.webp" real screens lower down; no screen of today's Home, stories, books or the buddy.
- Support page uses a different look (blue Tailwind) and a personal Gmail (the address in the file, with a code note "replace with your real support email before launch", support/page.tsx:9-10; same in terms:22 and subscribe/page.tsx:358). hello@ and privacy@ exist. No answers for: restore purchase, new phone, iPhone mic permission, delete my data.
- Home FAQ sits at the very bottom; the price is not stated anywhere (by design), which a tired parent may read as hiding it.
- trial.html (your question b): since WEB_SALES is false it shows only "Sona Premium is in the iPhone and iPad app" and an App Store button (trial.html:139-145) plus a restore box. Its hidden sell block (:78-131) holds prices that are NOT what the app sells: $59.99/yr with "3 days free", $9.99 monthly, charter line, "under $5 a month". The app today: monthly with 7 days free, then $9.99, and $59.99 one payment; no yearly. Pages linking to it: only app/subscribe/page.tsx:355 ("restore it with your email") and app/subscribe/success/page.tsx:189 (a web-checkout success page that cannot be reached while sales are off). Nothing in public/ links to it. Visible price copy is not shown today, so it is not currently false; if web sales return, "3 days free" and the missing one-payment mismatch. Also the app/subscribe PaidPicker (hidden) says "3 days free", "Priority support" (no such thing found).
- /families (noindex) and /subscribe repeat 3-day wording and "works in any browser"; hidden today.

## Improvements, ranked
1. Fix the share picture (B1). High, Small, Travis (new image) + Rachel's wording.
2. Make the home page never trap a visitor: on error or skip, show the App Store link; on desktop say "we emailed you the link" and show a QR code. High, Small, engineering.
3. Add a 15-second silent video of a real child saying "rrrr" and the game slowing (the clips already exist in assets/home/reel and setup/reel). High, Med, Travis (needs a real child, parent consent).
4. Fix B2 (age claim) and B8 (free wording). High, Small, Rachel and Travis.
5. Add the Meta pixel, PostHog replay and a privacy link to the privacy page and /try; turn off Meta autoConfig on check/parents. High, Small, engineering + lawyer.
6. Replace the Gmail with hello@speaksona.com everywhere; rewrite the Support page (iPhone cancel, restore, new phone, delete data); delete the "template" line in Terms; add the one-payment purchase. Med, Small, Travis.
7. Add an App Store badge. True today. Low effort. Add rating or reviews only when real ones exist (never invent; the page says so).
8. Truthful proof available today: "no audio leaves the phone" (already there), Rachel's line, game and book counts (pinned by shiptest), "no ads". Not available: results or testimonials.
9. Sitemap, robots, llms.txt, JSON-LD are good. Add og:url/twitter on /terms, /privacy; there is no custom 404 page I found (UNSURE). Low.

## Versus the best apps
Duolingo, Khan Academy Kids and Lingokids landing pages lead with the App Store badge, a short looping video of a child playing, and a rating line; Speech Blubs adds a "see the app in action" clip and "X million kids". Headspace shows the price and a trial plainly. Sona has the strongest trust story (named SLP, voice stays on the phone) but no video, no badge, no rating. A "text me the link" box (Duolingo, Lingokids do this on desktop) fits Sona's rules; the email box already does most of it.

## Decisions worth another look
- Email before the App Store (Travis 4 Oct: "immediately", and Start free with an email). The risk is B3; the benefit is an email list and a welcome email that survives a closed tab.
- "Start free" wording versus trial-first (B8).
- Home page says no price anywhere (CLAUDE.md: never print a dollar figure). Hiding the price may cost trust; "free trial, then a monthly price shown in the App Store" is true.
- A pixel and session replay on the home page with no consent banner.

## Already good (keep)
Rachel's credential wording is exact everywhere I read (shiptest all green, 146 checks). Game and book counts match the catalog. No audio claims are accurate. /try is quick (324 KB, 12 requests, no horizontal scroll at 390 and 1280). robots.txt, sitemap and llms.txt follow the rules; noindex pages are not blocked. Terms and the FAQ's price answers read the switches rather than typing prices. Native-app redirect on both pages works. Form: disabled button blocks double taps; errors are shown.

## Not checked
Live Events Manager settings (B6); how Instagram's in-app browser handles the App Store link; the 404 page; the real welcome email text; Lighthouse timing; app/families page in full (only grepped); the clinician /for-slps page (other area).

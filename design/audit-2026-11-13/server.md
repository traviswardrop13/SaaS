# Server (API routes, lib/, middleware, daily jobs)

## In five lines
1. Money and access are mostly solid: webhooks and founder/cron routes check a secret, the board really is dark, the clinician plan routes hold their lock on the server, and the Stripe/KV "store down" cases fail safe.
2. The two worst holes are about spending Sona's money and email reputation: `/api/tts` (paid voice) and the clinician sign-up (`/api/slp/auth/request`) have no real limit, so a script can run up a bill or mail strangers.
3. A stranger can sign in as ANY email address that has no account yet, with no proof of inbox, and keep that login for 30 days even after the real owner arrives.
4. `/api/founding` hands out permanent free Premium to anyone who fills the (hidden but public) form, and stores a child's first name plus a parent's phone number on the server.
5. Several routes are dead code the app no longer calls (chat, coach, heygen, pair, isolate, voice-change, story) but are still open on the internet. Delete them.

## Bugs

### P0
**B1. Anyone can run up the voice bill (`/api/tts`).** (CONFIRMED by reading; not run against the real service.)
- Sees: nothing, until the ElevenLabs bill arrives.
- Steps: POST `{text: <800 characters>}` to `/api/tts` in a loop, from many IP addresses. No sign-in, no same-site check.
- Where: `app/api/tts/route.ts:226` (limit 120 calls a minute per IP only), `:241` (800 chars), `:302-306` (cache only for lines up to 120 chars, only 48 clips, only in one warm server's memory, so cold servers re-bill the same line).
- Math: 120 x 800 = 96,000 characters a minute from ONE address. Voice APIs bill roughly $0.1 to $0.3 per 1,000 characters, so tens of dollars a minute per address, with no global ceiling.
- Also `voice` is any string put straight into the vendor URL (`:260`, `:316`): not an allow-list, not URL-encoded. A crafted value can point the call at a different vendor path. UNSURE how far that goes.
- Fix: same-origin check; cap text at ~160 characters; 20 a minute per IP; a global daily character budget in the store that returns 503 over budget; keep clips in the store (or Blob) by hash so repeats are free; allow-list the ten family voices and `encodeURIComponent` the id.

**B2. Anyone can make Sona email strangers (`/api/slp/auth/request`).** (LIKELY: full path traced.)
- Steps: POST `{email: "victim@x.com", name: "<any 60 chars>"}` with a new address each time. The only limit is 5 per address per hour (`:171-178`); there is no per-IP or global limit.
- Each call sends (a) the "Your sona dashboard is ready" email with the attacker's chosen name in "Hi <name>," (`lib/slpAuth.ts:381-395`), (b) creates a Resend contact, and (c) enrolls the address in the parent welcome series, because `/api/lead` enrolls every role (`app/api/lead/route.ts:~300`, `lib/nurture.ts:306`), and the lead is signed so it skips the lead limit (`auth/request/route.ts:100`). So one request = 2 emails now + 2 more over the next 2 days.
- Harm: harassment, spam complaints, a burned sending domain (this domain also sends the sign-in and weekly report mail), Resend bill.
- Fix: per-IP limit (like lead: 10 an hour); per-IP daily cap; do not enroll `role: slp` in the parent series (also a plain bug: therapists get "Try this the next time they say wabbit"); only send the magic email if the account exists or after a small proof-of-work/captcha.

**B3. Anyone can sign in as someone else's email, and the login can't be cancelled (`/api/slp/auth/request` new-account branch).** (LIKELY: traced; the code comment says it is deliberate for funnel reasons.)
- Steps: POST `{email: "real.clinician@school.org"}` for an address with no account. The response sets a 30-day signed cookie for that email (`auth/request/route.ts:229-262`). No inbox check.
- When the real clinician later signs up, "account exists" -> they only get a link, into the same account. The squatter's cookie still works: sessions are stateless (`lib/slpAuth.ts:178-198`), logout only clears the caller's own cookie, and "Rotate key" does not touch sessions.
- What the squatter can then do for up to 30 days: read the roster (children's initials, practice days), see/rotate the family key, open the Stripe billing portal for the clinician's customer and cancel or view the card (`app/api/slp/plan/portal/route.ts:29-54`), start the one-time Sona Pro trial under the victim's email (burning it).
- A district privacy officer would call this account takeover. Also the "SLP community" (names of real members) and the displayed member count (`app/api/slp/community/route.ts`) are open to any fake account.
- Fix: keep the instant sign-in but mark the session `unverified`, store `acct.sessionsFrom`, and bump it the first time a magic link is verified (`auth/verify`), rejecting older cookies. Block billing portal, roster, key and community until verified.

### P1
**B4. Free permanent Premium for anyone (`/api/founding` + `?ff=`).** (LIKELY.)
- Steps: open `/founding.html` (not linked, but public), fill any name/phone/child, tick the box, get a link `/?ff=<id>`. `GET /api/founding?id=` says valid (`app/api/founding/route.ts:46-52`), then `sona.js:10288-10296` marks the phone a founding family, and `premium()` includes `foundingPilot()` (`sona.js:3176`), forever. The page says "free 90 days"; nothing in the code ends it.
- Limits: 10 a hour per IP, no email/phone check. The id is `Math.random()` base-36 (`:79`), not a secure random.
- Also stores the child's first name, age and parent's cell phone number in the store and forwards them to `LEAD_WEBHOOK_URL` (`:79-98`). That breaks the "child's name never leaves the device" rule and is exactly what a privacy officer or Apple's privacy questions ask about.
- Fix: if the founding programme is closed, delete the route and page (or refuse with 410). If open, drop the child's name and phone, require an emailed confirmation, and give the pilot a real end date.

**B5. Anyone can plant emails into the Friday email list (`/api/trial`).** (LIKELY.)
- Steps: POST `{email: "victim@x.com"}` 10 times a minute. It lands in the `trials` set (`app/api/trial/route.ts:62-65`, up to 5,000). The Friday cron (`vercel.json`, `app/api/cron/weekly/route.ts:140-176`) emails up to 200 of them "Your week of brave sounds", with no confirmation. It already notes "double opt-in is the tracked follow-up".
- Content is also stale: it promises "the clips worth hearing twice" (`cron/weekly/route.ts:91-95`), which has been false since clips stopped being kept on 5 Nov.
- Fix: delete `/api/trial` and the Friday cron (the Monday email and report replace it), or require confirmation. Remove the "clips" sentence if kept.

**B6. Fake numbers can be written into the free-trial report (`/api/track`).** (LIKELY.)
- No rate limit and no same-site check (`app/api/track/route.ts:67-`). Anyone can send "free trial started" / "played today" with random ids (`:92-99`). Those create real `trial:<id>` records and rows in `trials:idx` (`lib/trials.ts:46-51`) and forged "purchase completed" events go on to PostHog.
- Harm: Travis is deciding the 7-day trial from the /leads "Free trials" report; a few lines of script corrupt it. Also every call waits up to 4 s on PostHog (`:105`), so it is a cheap way to hold server time.
- Fix: same-origin + 60/min per IP; allow only `fid`s the app minted (sign them), or ignore the funnel events from outside the app.

### P2
- **B7. Open expensive routes that nothing calls.** `/api/chat` (`chat/route.ts`: unlimited `messages` size and the child's name and any "sound" text go straight into the model prompt; model `claude-opus-4-8`, the most expensive), `/api/coach`, `/api/story` (only the parked story page calls it), `/api/heygen/token` (mints a paid avatar session, any avatar id, `heygen/token/route.ts:46-50`), `/api/heygen/avatars` (NO limit at all, 9 vendor calls per hit, `heygen/avatars/route.ts`), `/api/pair` (stores up to 256 KB of a family's full save, which includes the child's name, for 48 hours, `pair/route.ts`: nothing calls it since 2 Oct). Each is a free LLM/avatar proxy or a privacy question. Fix: delete them.
- **B8. `/api/feedback` is open with no limit** (`feedback/route.ts:35-`): anyone can create unlimited `feedback:<anything>` lists in the store (each lasting 180 days) and fires the webhook once per call. Its GET compares the founder key with `!==` and takes it from the URL (`:100-103`). Fix: limit it, cap the number of distinct codes, move the key to a header with the constant-time check.
- **B9. A family's "enrolment ticket" works as a login cookie.** `verifySession` (`lib/slpAuth.ts:190`) accepts any correctly signed payload, including a ticket (`t:"enrol"`, no email). A family that holds a ticket can set it as `slp_session` and act as the email "undefined": account `slpacct:undefined`, shared by everyone who does it. No cross-clinician data (checked: `s.code` is never read), but it is junk-account creation and a type-confusion trap. Fix: require `typeof email === "string"` and reject `t`.
- **B10. Cron and founder key checks.** `cron/nurture` and `cron/weekly` compare the founder key with `===` and accept it in the URL (`?key=`), so it lands in logs and history (`cron/nurture/route.ts:36-40`, `cron/weekly/route.ts:112-118`). `isolate` and `voice-change` use `!==` (`isolate/route.ts:23`) and are fully OPEN on any preview deployment (`isPreview`), with the paid ElevenLabs key; the voice id is not validated there either (`voice-change/route.ts:42`). The strong gate (`founderGate`) exists; use it everywhere.
- **B11. Restore-by-email unlocks on an email alone** (`subscription/route.ts`, known and recorded as "interim"). Anyone who knows a Stripe buyer's email gets Premium on their device, and the route also confirms whether an email is a customer. 8 a minute per IP. Little exposure now (web sales are off), real if web sales return.
- **B12. Billing-portal link from a checkout id** (`portal/route.ts`): a `cs_...` id (which is in the success page URL) opens that customer's billing with no sign-in. Same exposure class as B11.
- **B13. Clinician unlimited trials.** The Sona Pro trial is "once per email" but accounts need no email proof (B3), so a new address every 14 days is unlimited free Pro: dashboard plus Premium for an unlimited number of families (the redeem cap is `Infinity` when covered, `redeem/route.ts:~110`). Needs a card each time, but not a new card.
- **B14. No browser security headers at all** (`next.config.js` has only Cache-Control): no `X-Frame-Options`/`frame-ancestors` (the clinician dashboard and plan buttons can be framed for clickjacking), no `Referrer-Policy`, no CSP, no `nosniff`.
- **B15. Confirm-email budget can be drained.** Report confirmation emails are capped at 300 a day for everybody (`lib/report.ts` ASK_CAP) and 40 an hour per IP; ten scripts use it up and real parents' confirm emails stop for the day. Low.
- **B16. Long email addresses can't unsubscribe.** Lead accepts 254 characters; the unsubscribe link signs and reads only the first 120 (`email/unsub/route.ts:50`, `slp/auth/request:158`). Rare.

## Experience problems
- A therapist who signs up gets three PARENT emails ("Here's Sona" with the App Store link, "Try this the next time they say wabbit", "Quick answers before you decide") because every lead is enrolled in the parent series (`lib/nurture.ts:306`; `lead/route.ts`). Rachel and a school SLP both see a mismatched product.
- A parent can receive two weekly emails on different days: the Friday "week of brave sounds" (if planted, B5) and the Monday email.
- The sign-in email for clinicians says "the dashboard is ready" but the dashboard then answers 402 until Sona Pro is started (`lib/proGate.ts`): the first thing a new therapist sees is a paywall after a 30-second sign-up. Worth checking the wording on slp.html (not my area).
- After a failed (not "unsub") nurture send, that email is dropped for good (`lib/nurture.ts:356`: "a failed send moves on"), so a one-off Resend hiccup at 16:00 silently loses a parent's day-2 email.

## Improvements, ranked
1. Put a hard budget and an allow-list on `/api/tts` (B1). Impact High, effort Small, engineering. (Travis should also set a spend cap in ElevenLabs today.)
2. Add per-IP and daily limits and stop the parent-series enrolment on `/api/slp/auth/request` (B2). High, Small, engineering.
3. Make a new clinician session "unverified" until the magic link is used, and invalidate older sessions then (B3). High, Medium, engineering.
4. Decide the founding programme: close it (delete route + page + `?ff=` path) or fix it (B4). High, Small, Travis.
5. Delete dead routes: chat, coach, story, heygen/*, pair, isolate, voice-change (or founder-key only), trial and cron/weekly (B5, B7). Medium (shrinks attack surface, bill risk), Small, Travis OK + engineering.
6. Sign the family id the app sends to `/api/track` and rate-limit it (B6). Medium, Small, engineering.
7. Add security headers (B14) via `next.config.js`. Medium, Small, engineering.
8. Make `/leads.html`'s cron/founder checks header-only and constant-time (B10). Low, Small.
9. Add a daily spend/volume alarm (emails sent, TTS characters, signups) that pings Slack/email. Medium, Small, Travis.
10. Retry a failed nurture send once next day instead of dropping it. Low, Small.

## Versus the best apps
- Duolingo/Khan Academy Kids put every paid service (voice, AI) behind a signed-in account and a server-side quota, never an open endpoint. Sona's kid pages call `/api/tts` anonymously, so the fix is a signed short-lived token minted by the page (or an install-bound key) plus a per-install daily cap.
- Headspace/Calm confirm an email before they send anything to it (double opt-in). Sona sends mail on a stranger's say-so (leads, clinician sign-up, trials list).
- Sago Mini and Toca do not ask for a child's name on a server at all; the founding form is the one place Sona does.

## Decisions worth another look
- "A new clinician is signed in on the spot" (`auth/request` comment): good for the funnel, but see B3. Keep the instant sign-in; add the verified flag.
- "Unlimited families, no cap on a covered code" (12 Nov, Travis): with unverified accounts and repeat trials (B13) this is a free-Premium lever. Keep, but tie the trial to a verified email and a card fingerprint.
- Founding programme: is it still open? If not, B4 is a hole with no benefit.
- Whether the Friday `/api/cron/weekly` email should exist at all now that the Monday email and weekly report do the job.

## Already good (keep)
- Every founder route uses the constant-time header gate (`founderGate`); RevenueCat's webhook checks its secret in constant time, caps size, and writes idempotently; Stripe session reads require `status === complete`.
- Practice Board is really dark: all but `leave`/`remove`/`admin` answer 503 through `gateJson` (`lib/board.ts:707`); prefix keeps a preview from touching production.
- Weekly report: same-origin check, 4 KB cap, field-by-field validation, confirm link whose GET has no side effects and whose POST checks an HMAC; unsubscribe link has the same design. Never logs an address.
- Family feedback route: origin check, honeypot, limits, escaped email, no call requests.
- `/api/lead` really is allow-list based; the child's name is stripped before the webhook, list and ledger.
- Pro lock is held on the server and never blocks a delete or the family side; the charter count fails open so a lookup failure never costs a family money; clinician plan mirrors keep the last answer when Stripe is down.
- Rate limiter uses `x-real-ip`, /64 for IPv6, an atomic count+expiry script.
- No route accepts an upload except `isolate` and `voice-change` (founder-only on production).

## Not checked
- Did not run any route or script against live Stripe, Resend, ElevenLabs or Upstash (read-only audit; no real keys). B1's vendor-path point and B2's mail volume are traced in code, not tried.
- Did not read in full: `lib/contacts.ts`, `lib/weekly.ts`, `lib/revenuecat.ts` internals, `lib/roster.ts`, `lib/lessons.ts`, `lib/workEmail.ts`, `app/api/slp/claim`, `slp/child`, `slp/homework`, `slp/feedback`, `homework`, `pilot/forget`, `founders/*` bodies (only their auth gates and call patterns).
- Did not check actual Vercel environment (which env vars are set, plan limits for `maxDuration` 300, whether a spend cap exists in ElevenLabs/Resend).
- Whether any page interpolates a child's name into a line sent to `/api/tts` (grep found none).

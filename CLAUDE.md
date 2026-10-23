# Working with Travis (and Rachel)

## Communication style
**Talk to Travis like he's 10 years old, and keep it short** (Travis, 25 Sep
2026: "explain as if im 10 years old and be more concise"). Short sentences,
everyday words, no tech words unless explained in a few plain words. Say what
happened, what he needs to do, and stop. If a reply is more than a few short
lines, cut it.

- Be concise. Default to a few sentences; use short bullets when listing.
- Lead with the answer or the thing that happened. Cut background, caveats,
  and strategy essays unless asked.
- One recommendation, not a menu. No recaps of prior context.
- Long-form only when explicitly asked ("go deep", "full plan").

**Concise is not the same as compressed.** Travis is the founder, not a reader
of this codebase. He has not memorised the function names, the file names, or
the internal shorthand for things — and a sentence he cannot act on because he
does not know what it points at is not brief, it is just short.

Asked for outright, 19 Sep 2026. Three decisions had been flagged as needing
him or Rachel, written as "the not-sure routing", "whether accuracy by sound
stays a percentage", and "the replay boundary". All three were real,
load-bearing questions. None of them meant anything to him, so none of them
could be answered. Four hours of correct work sat waiting on three phrases.

So:
- **Name things by what a parent or a child SEES**, not by the function or the
  storage key that implements it. "The button under the win screen", not
  "planEligible()". Internal names are fine *after* the plain version, or in a
  commit message or PR body where the diff is sitting right there.
- **The first time an internal word appears in chat, define it in one clause.**
  "The demonstration — the one free run a new family gets before any price —"
- **When something needs his decision or Rachel's, give three things:** what
  happens today, what would change if they chose differently, and why it is a
  person's call rather than an engineering one. A decision he cannot picture is
  a decision he cannot make.
- **Explain it the way you would to a smart fifth grader.** That is a clarity
  bar, not a length one — it usually costs a clause, not a paragraph. Being
  brief and being clear are not in tension; being brief and being cryptic is
  just a failure with fewer words.

## Project
Sona (speaksona.com) — kids' speech-practice PWA in public/, Next.js API
routes, Capacitor iOS shell that remote-loads the site. Solo founder, ships
fast.

**Two people work in this repo.** Travis builds. Rachel is a pediatric
speech-language pathologist and co-founder — she owns clinical correctness.

**Her credential wording is settled — say exactly this.** Rachel holds an
**Idaho CF licence** (confirmed by Travis, 1 Sep 2026) and is a **Clinical
Fellow (CF-SLP)**: master's complete, supervised fellowship year in progress.
She does **not** hold ASHA's CCC.

So: **wherever Rachel is presented as an SLP, her name carries "MS, CF-SLP"**
(Travis, 29 Sep 2026: "make sure that it says everywhere that you're talking
about her being a SLP … that she's a CF. So like MS, CF-SLP" — reversing the
23 Sep call to leave the fellowship out). **The line is Travis's, word for
word** (1 Oct 2026: "need to add this to speaksona.com, the onboarding and
anywhere else where it mentions rachels credentials"): **"Built with Rachel,
MS, CF-SLP, a pediatric speech-language pathologist in her clinical
fellowship."** The plain words beside her name are always "a pediatric
speech-language pathologist in her clinical fellowship" ("in my clinical
fellowship" where she speaks): "Rachel Wardrop, MS, CF-SLP · Co-founder ·
Pediatric speech-language pathologist in her clinical fellowship", "Reviewed
by Rachel, MS, CF-SLP, a pediatric speech-language pathologist in her
clinical fellowship", a sign-off "Rachel, MS, CF-SLP · Co-founder". It
replaced the 29 Sep line, "licensed pediatric speech-language pathologist",
which `shiptest` now keeps off every surface (her Idaho CF licence is still
real; the line just says where she is). **Wherever copy presents Sona's SLP,
it names her**: "Built with Rachel, MS, CF-SLP", "reviewed by Rachel, MS,
CF-SLP, a pediatric speech-language pathologist in her clinical fellowship" —
never an anonymous "built with a licensed SLP" or "our SLP". (A child's OWN therapist — "your SLP", "your
child's speech-language pathologist" — is someone else, and stays generic.)
**Her cards name nobody else** (Travis, 29 Sep 2026: "don't mention my name").
Never "fully licensed", never anything that suggests the fellowship is behind
her. `tests/shiptest.mjs` scans every public page, the manifest and every
`app/` and `lib/` source with comments stripped, and fails on: "Rachel" or
"Rachel Wardrop" followed by a clinician word without ", MS, CF-SLP"; an
anonymous "built / made / designed / shaped / reviewed with / by a (licensed)
(pediatric) SLP / speech-language pathologist" or "our SLP"; a page that puts
Rachel and "SLP" or "speech-language pathologist" in one sentence without
"MS, CF-SLP" somewhere on it; any CCC or "certified" claim; and any of the
pages that introduce her (parents, subscribe, trial, progress, talk, slp)
missing it.
One of those places is setup (Travis, 29 Sep 2026: a Meet Rachel screen with
her photo). **Since 22 Oct 2026 she has her own screen again** (Travis: "a
bigger slide of Rachel that's just like all by itself of like her
credentials"), the fourth of setup, before the child's name: her photo, big,
and the settled line word for word, "Built with Rachel, MS, CF-SLP, a
pediatric speech-language pathologist in her clinical fellowship.", shown
once (its first words are the heading, "Built with Rachel, MS, CF-SLP,", the
rest the line under it; `#rachelLine`'s own text is the whole sentence, its
start not drawn or read twice), and a pill, "Sona co-founder". Nothing else.
From 5 to 22 Oct 2026 (option B) she sat in an "About Sona" box on the ready
screen; the ready screen no longer carries her. Where her credential sits is
hers and Travis's to change. She still is a
Clinical Fellow: if an SLP, a district or a board asks, the answer is yes.

**Never "CCC", "certified", "board-certified" or "ASHA-certified".** The
landing page claimed "Licensed & board-certified (CCC-SLP)" until it was caught
— a specific, checkable false claim about a trademarked certification, on the
page that sells the app. `tests/iaptest.mjs` fails if it comes back, and if
the licence ever lapses or she moves state, that pin is where to start — and
setup's Rachel screen (`onboarding.html`, her line pinned word for word in
`tests/setupscreenstest.mjs`) shows her credential to every new family.
If a change
touches what a child is asked to say, how a sound is cued, what counts as
practice, or what an SLP is shown, it is Rachel's call, not an engineering
one. Surface those in the PR body so she can review them without reading
the diff.

## Pricing — a free version, Premium, and the cohorts no flip can take back
**Current release: pricing is ON (Travis, 30 Sep 2026: "separate free from
paid" ... "we add the paywall today").** `FREE_MODE = false` in
`public/sona.js` and `lib/pricing.ts`. Families first meet it on launch day,
when the launch lock lifts (see "The family app is locked until launch day").
**The free version:** daily practice, **two games for each age group**
(Travis, 30 Sep 2026: "the two free games for older kids, the two free games
for younger kids"): **Fruit Slice and Piano Tiles** for 5-8 (Piano Tiles
turned free that day; Block Stacker, Sound Sprint, Flappy Glide, Rise Up,
Hoops, Soccer Goal and Dino Dig are Premium), **Feed Echo and Bubble Pop** for 3-4 (Bubble Pop came back from
Coming soon that day), and **one book, Rory and the Rainbow** (`FREE_BOOKS`
in sona.js). Everything else is Premium and greyed out ("ask a grown-up");
buying opens every finished game and every book. Unfinished games stay
closed regardless of subscription, trial or earned access, and since 19 Oct
2026 have no card on Home (see "Coming soon games are hidden"). **The daily
story is Premium too** (STORY1, 22 Oct 2026), by the books' rule: shown
locked where Sona can sell, and on a phone that cannot buy replaced by the
game of the day (see "Daily story (STORY1)"). **Since 3 Oct 2026 the free version is not every
family's:** where Sona can sell, a family set up from then on starts with the
trial (see "TRIAL FIRST" right below).

**TRIAL FIRST: THE PRICE BEFORE THE FIRST GAME, NOTHING FREE WHERE SONA CAN
SELL** (Travis, 3 Oct 2026: "lets add the paywall before they try anything in
the app. and then they unlock everything. so fruit slice and piano tiles and
feed echo and bubble pop are all part of paid or needing to start a trial";
then, with ReciMe's onboarding screenshots, "something like this. yeah home
locked", and "using chatgpt art"). One rule in `sona.js`, `freeVersion()`:
the free version (the free-tier games, `FREE_BOOKS`, and the practice that
opens them) is open only to
- **a phone that cannot buy:** an app build with no purchase plugin (the App
  Store's 1.0.4) or a browser while the website does not sell
  (`canSellHere()`). A wall nobody can pass is a broken app, not a paywall;
- **a household already set up on this build's first load:** the one-shot
  sweep `_keepFreeVersion()` stamps `sona.freever.v1` "kept" (set up: it was
  told those games were free) or "post" (not set up yet: it starts with the
  trial). It keeps the free version, never Premium; it reads no free era's
  stamp; and it is on `NO_IMPORT`, so a backup never brings it;
- **a family who joined through their speech therapist** (`slpVerified()`):
  every clinician page promises those families the free version. A pasted
  backup can carry `sona.slpok` and with it the free version (never Premium):
  accepted, since that is what those pages promise.
Premium from any source, a trial, or Sona being free open everything, as
before. These three were defaults Travis did not pick; ask him before
changing one. What follows from the rule:
- **SETUP, REBUILT FROM SCRATCH: SELL SONA, A FEW QUESTIONS, THE PRICE, THEN
  THE PHONE IS HANDED OVER** (Travis, 22 Oct 2026: "I want to do a
  completely new onboarding ... from scratch. I want animation ... make it
  live, animated. We want to sell the product in the onboarding ... simplified,
  some of the slides have too many words"; he approved the storyboard, then
  "ok go build it all"). It replaced option B (4-5 Oct 2026). For new
  families only: a family already set up keeps everything. A parent's first
  setup is the hello → **"Speech homework is hard at home."** → **"They
  practice by playing."** (the games playing) → **Rachel on her own** →
  name and age (**"Who's practicing?"**) → **"What does <Name> love?"** →
  **"Games <Name> will love"** → **"Is <Name> in speech therapy?"** →
  sounds (**"Which sounds?"**) → **"How long each day?"** → **"Get the weekly
  progress report"** → **"<Name>'s practice is ready!"** → (**"Want a
  reminder before your free trial ends?"**, where it can be kept) → the price
  → microphone ("Let Echo hear <Name>") → "Hand the phone to <Name>!" → Home
  (the first game for a phone with nothing to sell). A headline and at most
  one short line a screen; **every word is a default for Travis and Rachel to
  change.** A child set up before walking setup again (`REWALK`: Back from the
  first game, a second visit) gets the questions only if the household was
  never asked them (no `sona.setupasks.v1`: set up before 5 Oct 2026): hello,
  name, therapy, sounds, minutes, the email step while the household has
  none, ready, microphone. Any family set up since, a second child, or a
  family already asked gets hello, name, sounds, ready, microphone; the clinician's own setup is unchanged. Five progress segments,
  one a question (name, what they love, therapy, sounds, minutes); the screens
  that sell, the email step, ready, the reminder, the microphone and the
  hand-off take none. The machinery under it is the old page's (the globals
  `draft`, `ORDER`, `ORDER_PARENT`, `ORDER_SLP`, `REWALK`, `obPhone`, the tap
  lock, the name step's keyboard system, the replay hooks, the draft, the way
  to the price and back), and so are its pins. `onboardingtest` walks it,
  `setupscreenstest` holds the new screens, `setupsteadytest` the steadiness,
  `replaytest` the recordings; `tests/_phone.mjs`'s `setupWalk(page, to,
  answers)` walks it by the screen showing, so a new screen is taught once.
  - **The hello is alive** (Travis: "make it live, animated"). The orchard
    without Echo painted in (`orchard-game.webp`, the Fruit Slice practice
    page's own; `welcome-orchard.webp` has him painted in and is no longer
    used), and ONE live Echo on the path: on a visit's first hello he hops in
    with a squash, says "Hi! I'm Echo!", "Sona" drops in letter by letter and
    "Speech practice kids love." rises; then he bobs, now and then waves
    (`echo-welcome` and `echo-wave` faded into each other), a cloud drifts, an
    orange drops from a tree and rolls to a stop, a star twinkles. CSS
    keyframes only (transform and opacity: a session recording holds no
    stream of changes), in a layer outside `.ob` that is drawn on the hello
    alone and hidden while the page is held blank; the loops never live
    inside a step (a test settling a step finishes its motion, and a loop
    would throw). Its button is "Get started", the last thing to fade in on
    a first hello, and it takes no tap until it has (1.75 s, `hello-wait`).
    **Under Reduce Motion nothing in setup moves, and each screen's first
    frame is its last** (the review of 22 Oct 2026: `sona.css` cuts an
    animation to 0.001 ms but keeps its delay, so a delayed one showed its
    first keyframe: the problem screen's game card was invisible for 1.15 s,
    then jumped): Echo stands on the path and says hi, the tossed flashcard
    and the ready screen's sparkles are not drawn, the game card and Echo
    cheering are in place, the reel is one still poster, and "Get started"
    takes a tap at once. `setupsteadytest` watches the problem and ready
    screens for 2.3 s and holds Reduce Motion's first frame to where the
    motion-on run ended.
  - **The problem**: "Flashcards turn into fights. Play turns into
    practice."; three flashcards (rug, red, run), one tossed away once, and
    Fruit Slice's painted card slides in. A statement, nothing stored.
  - **The reel** (Travis: "Do like a little clip of a few games so that
    parents can see it, and even have like the voice say your R sound"):
    real play, filmed frame by frame by `tools/setupreel/record.mjs` into
    `public/assets/setup/reel/<key>.mp4` and a poster `<key>.webp` (no audio
    track; `setupreeltest` holds the files), one after another in a 3:4
    frame, two muted inline videos taking turns, in a fixed order (Fruit
    Slice, Hoops, Piano Tiles, Bubble Pop, Soccer Goal, Dino Dig, Feed Echo,
    then the rest), only the games this phone may show (the games screen's
    rule, both age groups: no age is asked yet). A phone that cannot play
    them or refuses to start one (Low Power Mode, the tests' Chromium) gets
    the posters as a slow slideshow, and a game with no clip or poster its
    painted Home card: never a dead frame (a clip that will not load turns
    the rest of that visit's reel into the posters). Off the screen nothing
    plays; under Reduce Motion it is the first game's poster, still, with no
    clip asked for. Over it Echo asks "Say your rrrr sound!" (only the
    sound's letters orange; a screen reader reads it, the pictures are
    decoration), and "Example: the R sound" says the R is an example.
    **How the clips are made:** `tools/setupreel/record.mjs`, run by hand and
    never in the battery (its header says how; it needs ffmpeg and is CPU
    heavy, so run it alone), opens each real game page on
    `tools/appstore/capture.mjs`'s fake phone (an onboarded child on R, no
    name on any game page, and every frame checked for one), plays it with
    the page's own controls and the fake microphone (a power or a ball is
    earned only the way a child earns it), and films it one 1/30 s frame at
    a time on Playwright's virtual clock, cropped to the game at 3:4 (3 to 4
    s, 540×720, at most 300 KB, a poster at most 60 KB). Look at every
    contact sheet it writes before committing a clip. **A new game on the
    reel** is a scene in `record.mjs`, its key in that tool's `KEYS` and in
    `setupreeltest`'s list, and its place in `REEL_ORDER` in
    `onboarding.html` (a playable game missing from `REEL_ORDER` still shows,
    after the listed ones; one with no clip yet shows its poster, else its
    Home card). **The R example:** every clip is filmed on R and the pill and
    "Hear Echo" say R, before any sound is picked, so a parent of a 2–4 year
    old sees and hears R, a sound not asked of that age (`SOUND_NORM`):
    Rachel's to rule on, with which moment each clip shows (Travis's).
  - **"Hear Echo" is the one sound setup makes** (setup was silent by
    Travis's 24 Sep rule; he reversed it for this one tap). Echo's line "Say
    your sound with me!" (`SayIt.line`, the phone's voice cache), 200 ms of
    quiet, and Rachel's one take of R (`/coach/say-echo/R-sound.wav`), joined
    into ONE recording and started by ONE `Sona.mediaPCM` call inside the
    grown-up's tap (the app and the website alike). The line missing: her take
    alone. Sona's sound off (volume 0): nothing. Never the robot voice, never
    "Go!", no microphone; leaving the screen stops it. **For Rachel:** a
    parent of a 2–4 year old hears R too (an example, before any sound is
    picked, though R is a later sound); how a sound is cued is hers.
  - **Rachel on her own screen** (Travis: "a bigger slide of Rachel that's
    just like all by itself of like her credentials"; she sat on the ready
    screen from 5 Oct): see her credential section above.
  - **"What does <Name> love?"**: seven tiles, any number (Sports, Music,
    Dinosaurs, Animals, Space, Building, Food), each a piece of the games'
    own painted art; Continue or Skip, nothing picked for them. Kept on the
    profile as ids (`profile.interests`) when asked (an older profile's story
    themes stay when not). The picks only order the next screen: **"Games
    <Name> will love"** shows the games a pick fits first, ringed, then the
    rest, each part in Home's order (`INTEREST_GAMES` in `onboarding.html`:
    sports Hoops and Soccer Goal, music Piano Tiles, dinosaurs Dino Dig,
    animals Sound Sprint and Feed Echo, space Rise Up, Flappy Glide and
    Bubble Pop, building Block Stacker, food Fruit Slice and Feed Echo; the
    pairs are Travis's to change; the games opened on 22 Oct 2026 joined
    them: sports Race Car, animals Puppy Bath and Fish Tank, space Space
    Trip, Rocket Blast and Bedtime Stars, building Castle Builder, Robot
    Builder and Build a Snowman, food Pizza Chef and Birthday Cake). The grid
    is the catalog's (never a Coming soon game; where no price follows, only
    the games that phone opens), with no Free or Premium label, and **a peek,
    not the catalog** (#232, 22 Oct 2026, when 18 games opened and the grid
    ran off a phone): nine games of one age group, or three little-kid and
    six big-kid games with no age (`SELL_CAP`), the loved ones first so the
    cap never hides one, each group's rest counted under it ("and 7 more",
    `.sell-more`). They change nothing a child is asked to say.
    **The ids are setup's own** (`sports`, `music`, `dinosaurs`, `animals`,
    `space`, `building`, `food`: `INTERESTS` in `onboarding.html`), no longer
    the story themes (`dragons`, `space`…) the parked adventure reads:
    `library.html`'s hidden adventure tile and the parked `story.html` take
    `profile.interests[0]` as a story theme ("A brand-new sports story"), so
    map the ids to a theme before either comes back (a comment in each says
    so; `story.html` also reads `dailyMinutes`, now 5, 10 or 15, as a story's
    length).
  - **The two questions are one tap each and can be skipped.** **Therapy**
    ("Yes" / "No" / "Not yet", since 16 Oct 2026, Travis: "add a no so
    there's yes, no, and then not yet"; "Not yet" is the old "Not right now",
    id `t_no`, and "No" is `t_none`; "Your answer stays on this phone.")
    changes nothing a child is given: it puts one true sentence about SONA
    on the ready screen, never one about the child ("Sona is practice for the
    days between speech visits." / "Sona is practice you can do at home.",
    the second for both No and Not yet; Travis took "It does not replace a
    speech therapist." off the second on 15 Oct 2026). **"How long each
    day?"** (Travis, 22 Oct 2026: "more so like how many minutes per day";
    5 min / 10 min / 15 min) replaced "How many days a week will you
    practice?": a real setting, the daily goal in reps (`MINUTE_REPS`: 30,
    60, 90; 5 minutes is the 30 every family had by default), saved as
    `profile.dailyGoal` beside `profile.dailyMinutes`, the goal Home's gift
    button fills toward and Progress shows (Settings until #233, 22 Oct 2026, moved the picker). Skip leaves both as they were. A second child is
    never asked (as the days a week were not) and keeps the default 30
    reps (whether a second child should be asked is Travis's call). The
    days a week are no longer asked, and **setup writes none**: a new
    family's goal reads as 4 days (`Sona.goalDays()`; Progress still offers
    3, 4, 5 or every day, Settings no longer), and the weekly report names a plan
    only for a child whose days a grown-up picked (REPORT1 sends `gw` only
    when `profile.weeklyGoal` is set; with none the email says "Reached the
    daily goal on N days" and never "That's the plan you set."). **The
    minutes table is Rachel's call, and so is this edge of it:** it is one
    table for every age, so a 2–4 year old can be set to 15 minutes, 90 reps
    a day; the daily chest and goal days come only on a goal day, so a
    little one who plays only Feed Echo and Bubble Pop needs about 18 rounds
    for a chest at 90 (six at the default 30). The words, the two sentences,
    the minutes-to-reps table (and whether it should differ by age) and how
    much practice a family is asked for are Rachel's.
  - **Built on defaults, for Rachel and Travis to rule on** (22 Oct 2026).
    Rachel's: every word a child's parent reads in setup; 5/10/15 minutes as
    30/60/90 reps a day (and 90 for a three-year-old); the R example played
    and shown to every parent, a 2–4 year old's too; Echo's voice on setup at
    all ("Say your sound with me!" then her take, no "Go!"); that a recording
    may show what the child loves; that the therapy screen now says "stays on
    this phone". Travis's: every word; the interests and the games each
    fits; the reel's order; the reminder's words (the notification's are
    NOTIFY1's); that a re-walk by a household never asked the questions
    (set up before 5 Oct 2026) is asked the minutes again (and the email
    step while the household has none), while one set up since is not; that
    the reminder ask is only on a first setup.
  - **The email comes before the price** (Travis, 13 Oct 2026: "also move
    the email box before the price"). It used to be on the hand-off, after
    the price, so a parent who closed the price was never asked. Now it is
    its own one-tap-skippable step (`updates`) before the ready screen,
    asked once per family and only while the household has no parent email
    (`Sona.parentEmail()`). It is not one of the questions and has no
    progress segment. It is optional: empty or Skip go on, and a
    wrong-looking address stays with one line ("That email doesn't look
    right."). Travis's line, "We'll also send occasional tips from Rachel.
    Unsubscribe anytime.", is on screen before anything is sent. **Its
    heading is "Get the weekly progress report"** (Travis, 15 Oct 2026: "i
    want the setup page to say get the weekly progress report", with no
    "Optional. Rachel's tips…" line under it; Echo's bubble says "Want a
    weekly report?"), **and the report is real**: an address given here sets
    `profile.weeklyReport`, and only that sends a child's numbers (see "THE
    WEEKLY PROGRESS REPORT" under the email list). The address is saved in the
    profile and posted once, by `postParentLead()` (the address and nothing
    else), to `/api/lead` (`source "app-setup"`, role `parent`, nothing
    about the child), when the parent leaves the ready screen (or the
    reminder after it), before the price, never waiting on the network. The hand-off has no email box and
    no ×. After a Skip there is no other place to give an email (Settings
    has no field): Travis's call.
  - **The therapy answer stays on the phone**: a household key
    (`sona.setupasks.v1`, `Sona.setupAsks()`), not in the profile, not in a
    backup (`NO_EXPORT`), in no request, event, title or log. In a browser
    Meta's pixel reports the words on tapped buttons by itself, so the setup
    page's pixel tag carries `data-autoconfig="off"` (that page only; whether
    the landing pages should too is Travis's call). Asked once per family.
    PostHog's session recording (REPLAY1, below) is off while this question
    and the ready screen are on screen, and both steps carry `ph-no-capture`,
    so no recording holds the answer.
  - **The ready screen** ("<Name>'s practice is ready!", Echo cheering with
    a sparkle that plays once, no sound) repeats only what the parent said
    (the age group if given, the sounds, or "Every sound, easiest first",
    and "N min a day") with the therapy sentence and "Sona practices — it
    doesn't test or diagnose." Never "plan", an age norm, a result or a
    price. **The profile is saved when the parent leaves it** (or the
    reminder screen after it), before the price and before the microphone.
  - **The reminder ask** (Travis, 22 Oct 2026: "can we add push
    notifications and have that be a step in the onboarding where we ask
    them to turn it on to notify them a day before their trial ends"):
    "Want a reminder before your free trial ends?", "One notification, the
    day before." (it shows about 30 hours before the end, so a cancel still
    counts: NOTIFY1), a teal "Turn on reminders" (iOS's own Allow box,
    `Sona.notifyAsk`) and a cream "Not now"; Echo says "I'll give you a
    heads-up!". Only on a family's first setup, in an iPhone build that can
    set one (`Sona.notifyAvailable`), while iOS has never been asked
    (`Sona.notifyState()` "prompt"), and where the price follows
    (`trialFirst()`) — **and only for a buyer the store says will be given
    free days** (the review of 22 Oct 2026: an Apple ID that already had them,
    a reinstall or a second iPad, is charged today and must never be told
    about "your free trial"). As the ready screen shows, beside the
    "already has Premium?" ask, setup asks the store for its plan
    (`Sona.storePlan`) and, where sona.js has it, iOS for its real answer
    (`Sona.notifyRefresh`, NOTIFY1: `notifyState` alone is a guess on a page
    that has not heard from iOS), both feature-checked and bounded together
    at 2.5 s (`remindAsk`). Leaving ready shows the reminder screen only when
    the row the price screen picks on arrival (the yearly one when offered,
    else the monthly) is `"free"`: a product with free days and a buyer
    Apple has not called ineligible (a definite "not eligible" is `"paid"`),
    **and the store is sure of it** (`plan.sure`, the price line's own test
    in `trialReminderOn`: a "new subscribers" row may charge today, and the
    price screen then promises no reminder, so setup asks none).
    No store answer by then: no reminder screen, never a guess. The ready
    screen's Continue waits on that ask ("One moment…") only while it is in
    flight; a store that found a purchase meanwhile skips the screen too.
    Either answer, or "Not now", goes on to the price; nothing is set here
    (the reminder is set only once a free trial really starts: NOTIFY1).
    While iOS's Allow box is up both buttons and Back are still; a bridge
    that never answers holds the screen 12 s at most (`REMIND_ASK_MS`; NOTIFY1
    itself waits 60 s), then it goes on to the price. Its two buttons are its
    way on (no Continue), and leaving it is leaving the questions: the
    profile is saved then. The words are Travis's and Rachel's; asking only
    where the store offers this buyer free days (and skipping the screen
    when it has not answered) is a default Travis did not pick (the
    alternative, words that assume no trial, is his call).
  - **Leaving the questions goes to `/subscribe.html?setup=1` when
    `trialFirst()` says so** (after asking the store once whether this Apple
    ID already has Premium, `Sona.setupWall()`, 2.5 s at most; the grown-ups
    check is marked passed), else on, in the page, to the microphone. A
    clinician's own setup still ends on Home.
  - **The look** (Travis: "not sure I love the greenish button"): the main
    buttons are a brighter teal (#11b3b0, edge #0a8784: a #16c2be → #0e9c99
    face, a dark teal shadow under the white words), a picked chip, tile or
    answer a teal ring on a pale teal fill; words on the page's cream, no
    cards. Every colour is `onboarding-crafted.css`'s (the page's own
    `<style>` is layout only). The price screen's button
    (`.planbuy .btn.go` in `crafted-family.css`) takes the same teal with
    the one-payment change of 22 Oct 2026 (the lifetime work, which owns
    that file), so the two buttons a parent taps in a row match.
  - **A purchase or a restore comes BACK to setup** for the microphone and the
    hand-off: a tab-only marker (`sona.setupafter.v1`, `Sona.setupAfter()`)
    written when setup leaves for the price. **The hand-off's "Let's play!"
    then goes Home, where the child picks a game** (Travis, 17 Oct 2026:
    "once I start a trial, I don't want it to go jump straight into a game.
    I just want to have it go to the homepage"); no first game is marked.
    A phone that never left for the price still opens the first game. The marker picks a screen and
    grants nothing; without it (app closed on the price) the family lands on
    Home and the games ask for the microphone themselves.
    `Sona.firstGameStart()`'s mark is written by the hand-off's last tap.
  - **Nothing moves under a finger:** for about half a second after a setup
    step changes, and after the price card changes shape, taps are ignored.
  - **The name step holds still** (Travis, 15 Oct 2026: "the onboard feels
    jumpy especially on the page where i put the name and age"). In the
    iPhone app the keyboard shrinks the whole page about half a second after
    it starts to rise, and setup's screen-height rules laid the name card out
    again on the way up and down: Echo came and went, the heading shrank or
    vanished, the box and the age choices jumped by up to 190 px, Continue
    sat under the keyboard and then jumped 300 px, and an age tap closed the
    keyboard and did all of it under the finger. Now the step has one layout
    that already fits above the keyboard, sized by the phone and never by
    the keyboard (`html.ob-short` / `ob-tiny`, `obPhone` in
    `onboarding.html`: the window's height, taken only with no box focused
    and the keyboard down; in the app an iPad turned while the keyboard is
    up takes its screen's height the new way at once, and the window's own
    once the keyboard is down, while on the website a turn waits for the
    keyboard to go down (a browser's bars make its window 80-180 px shorter
    than the screen); on a touch screen only, so a short laptop
    window, a clinician's setup in a browser, keeps the progress bar and the
    label, and its margins and Continue follow the window's height like the
    screens around it). The cost: no Echo and no "So Echo knows who to cheer
    for." on this one screen (the line is still the box's spoken
    description; Travis's to bring back); and under Reduce Motion nothing in
    setup fades, Continue included. **The smallest size (`ob-tiny`) also
    has no progress bar on this screen, and the box's label is read, not
    drawn.** It goes by the touch window's height with no keyboard, not by
    the phone's size: 600 px or less, or 700 or less when 340 wide or less.
    So it is a 4-inch iPhone, a Face ID iPhone in Display Zoom (320×693, in
    the app: its notch and taller keyboard leave it less room than an
    iPhone SE), **and also any bigger iPhone whose window is that short in
    Safari**: a 4.7-inch iPhone on the website is about 553 px tall under
    Safari's bars, so it loses the bar and the drawn label too. Whether a
    phone on the website should keep them is Travis's call: nothing breaks
    either way. **In the iPhone app** an age tap keeps the keyboard up; **on
    the website** it still lets go of the box, because nothing there lifts
    Continue above the keyboard and the keyboard going down is what shows
    it. Continue steps aside while the keyboard rises and fades in above it;
    an iPad's hardware keyboard (a height under 80) is no keyboard to the
    layout and moves nothing; leaving the step with the keyboard up draws the
    next screen once, at full height (`whenRoomy`); during the tap lock no
    tap takes the focus off the box (a double tap on "Let's go!" or Back, a
    tap on an age or the box's label); every step slides in as one piece,
    and under Reduce Motion each screen's first frame is its own (sona.css's
    0.01 ms transitions painted it in the last screen's layout). Only two
    things still change its size. A window taller than 700 px that the
    keyboard leaves 400 px or less (an iPad on its side) takes the `ob-tiny`
    layout while the keyboard is up. And a phone whose keyboard is too tall
    for its own size (on an iPhone SE, over 280 px, the footer counted: a
    third-party keyboard with a number row; Apple's is 260) takes `ob-tiny`
    as that keyboard first starts to rise, and keeps it (`ROOM` in
    `obPhone`): with motion on that is while the step fades in, under
    Reduce Motion its first two frames show the bigger size. Without it
    the age choices sat under the footer, and a tap on "5–6" pressed
    Continue with no age picked. A phone never changes size for a keyboard
    its own size fits above (an iPhone SE with a 268 px keyboard, and a
    phone in Display Zoom, used to lose the bar and the label as the
    keyboard rose, the box jumping 67 px). The email step still re-lays out
    for the keyboard as before. `setupsteadytest` measures every frame at
    390×844, 375×667 and 320×568, with motion on and under Reduce Motion,
    again with the SE's taller keyboards (268, 280), keyboards too tall for
    it (291, 320) and at 320×693 (300, 336), turns a phone on the website
    and narrows a laptop window while a name is typed, and plays each of
    these edges.
- **The price is ONE screen** (the two ReciMe-style screens before it are
  gone): a two-row timeline, **Today** ("Everything opens. Nothing to pay
  today.") and **the billing day** (the store's price starts "unless you
  cancel at least 24 hours before", Apple's own measure), one button, and
  "Not now" in plain sight. See "THE IPHONE SELLS ONE PLAN" for where every
  word comes from. **No email reminder is promised:** since 16 Oct 2026
  Sona sends one ("Your free days end soon", RCHOOK1, below), but only to a
  parent who gave the app an email, so the price screen never promises that
  email, and the words email and notify, and remind outside the one line
  below, may not appear on it (`pricescreentest`, `setupbuytest`,
  `planwordstest`). **The one line, since 22 Oct 2026** (Travis: setup asks
  iPhone for its Allow box, so the phone itself reminds, NOTIFY1; "THE TRIAL
  REMINDER ON THE PRICE SCREEN", below): under the button and its small
  print, **"We'll remind you the day before it ends."**, only when `Sona.trialReminderOn(picked
  row)` says this phone will show it AND the picked row is a free trial
  (`planWords`' `headsUp`, painted into `#iapAhead`; the page feature-checks
  the function), and only on a row whose free days are certain (`plan.sure`;
  on a "for new subscribers" row Apple may charge today, with no trial and
  so no reminder). Never on a charged-today row or the one payment, never
  otherwise; `planwordstest` holds it to that word for word and
  `pricescreentest` (1d, 15c) plays it. The words are Travis's and Rachel's
  to change. "Paywall viewed" and the one-shot (`planShown`) count only once
  a priced card is on screen.
- **THE PRICE SCREEN IS ONE ROW, NO DATE, AND AN X (Travis, 6 Oct 2026, with
  a reference paywall: "too many words ... I don't want it to say Friday
  October 9th I just want it to say three days", then "Get rid of not now ...
  just like a subtle X in the top right", "get rid of the built with Rachel
  information on the bottom", "just say cancel anytime period").** This
  replaces the two-row timeline described just above and under "THE IPHONE
  SELLS ONE PLAN". On Apple's card, as an offer: Home's game pictures and
  Echo, the headline, "Unlimited access", three features with small icons
  (every game and every book · real speech practice in every game · "No ads,
  ever"), then one row that looks like a picked radio: "Monthly" over "3-day
  free trial", the store's price as "$9.99/mo" on the right. Under it one
  check line, "No payment today · Subscription auto-renews", the button
  ("Start practicing!", his words; charged today it stays "Subscribe — $9.99
  a month"), and one small line: "3 days free, then $9.99 a month. Cancel
  anytime." Restore Purchases looks like Terms and Privacy beside it. No
  header, no line under the headline, no "at-home practice companion" line,
  no Rachel line under the offer (her
  line is still on setup's Rachel screen and on Settings › Your plan). **The X
  IS "Not now"** (the same link, labelled "Not now" for a screen reader), so
  it leaves exactly as before. Every word is still `Sona.planWords`' and the
  store's: `name`, `sub`, `amount`, `check`, `note`, `noteLast`; `rows` is
  always empty. Charged today: "Charged today" under the name and
  "Subscription auto-renews". Not sure of the free days: "3-day free trial
  for new subscribers", no "No payment today", and the "Only new subscribers
  …" note between the row and the button. **"No ads, ever" is a promise:**
  Sona shows a child no ads; do not add one without taking the line off.
  **Since 19 Oct 2026 the yearly plan is a second row above this one**
  (below, "TWO PLANS ON THE IPHONE AGAIN"), **and since 22 Oct 2026 the one
  payment a third row under it** (below, "ONE PAYMENT, A THIRD ROW").
- **"Not now" goes to Home with everything locked:** every game and book is
  "Premium" and the Books card says "Premium"; no microphone ask and no
  hand-off. Settings then says "Plan: none yet", never "free version".
- **A tap on a grey game or book opens the price at once** (Travis, 4 Oct
  2026: "I want it to open automatically if they click on a game that is
  grayed out"): no "Ask a grown-up" note, no grown-ups check, straight to the
  plan screen as the offer on that game (`?from=<game>`, a book `?from=library`,
  Home's locked story card `?from=adventure` since 22 Oct 2026, STORY1),
  for any family Sona can sell to (`offerOnLock()`), free version or not. The
  plan screen asks no check for a `?from=` visit that shows the offer: Apple
  wants a parental gate before a buy screen only in its Kids category, which
  Sona is not in, and Apple's own sheet asks for Face ID or the password
  before anything is bought. A `?from=` visit that shows no offer (Premium
  already, a phone that cannot buy, an unknown game) is Settings › Your plan
  and goes through the check. On a phone that cannot buy, the note stays:
  there is nothing to open. A typed address to a grey game (`?locked=` from a
  bounce) still shows the note: it is not a tap.
- **No surface tells such a family something stays free.** Home's "Free"
  label and "1 free book", the plan screen's third check, its card lines, its
  header line, "What stays free", the decline ("Not now", never "keep the free
  version"), the Premium page's notes: each asks the rule. The website's cost
  answer (`parents.html`) no longer promises free games ("Sona is free to
  download …"), and the Terms say who keeps the free version. The old
  `/families` page, the Next `/subscribe` page and `trial.html` still describe
  the free version: true in a browser (which cannot sell), and nothing in the
  app links to them.
- **Known and left for Travis:** a family sent by a speech therapist who
  opens the iPhone app (not the website) meets the trial too, unless they
  bring their link across (Settings › Moving to a new phone?), though the
  clinician pages promise them the free version. (The Apple card's "3 days
  free" tag and button were typed until 5 Oct 2026; since then every line on
  it is painted from the monthly product's own answer.)
- **THE OFFER, ONCE, FROM HOME** (Travis, 13 Oct 2026: "yeah, let's show
  the offer again"). Some families' Home locked with no offer ever on screen:
  set up on the App Store's 1.0.4 (no purchase plugin, so setup skipped the
  price and opened the free games) after the 3 Oct build stamped them "post",
  then updated to a build that can buy, which took the free version away.
  Now, the next time Home opens for a family who owes the price
  (`trialFirst()`: a phone that can sell, no free version, no Premium, no
  trial), is set up, is not a clinician's own setup, and has never been shown
  the offer on this phone, Home is not painted: the store is asked once (2.5 s
  at most, `Sona.setupWall`, so a payer who reinstalled is found and gets
  Home), then the plan screen opens as the offer (`?from=home`, "Unlock every
  game for <Name>", no grown-ups check, as a grey-game tap), and its X comes
  back to Home. **Once per phone, whatever they do:** `subscribe.html`
  spends `sona.offerseen.v1` once the offer frame is up, from ANY door
  (setup, a grey game, a first run, Home), AND the store gave a definite
  answer (a priced card, which also spends `sona.planmoment.v1`; nothing to
  sell; Premium already there). **An error card is not the showing:** a frame
  the store never priced ("We couldn't reach the App Store.") marks only that
  visit (`sona.offerseen.tab`, sessionStorage, so X never loops) and counts a
  try (`try:N`); the next launch tries again, three tries at most, so a
  broken store never opens an error card on every launch.
  `Sona.homeOfferDue()` only reads. While the store is asked, Home shows only
  its background (2.5 s at most, on that one load). The mark is on `NO_EXPORT` and
  `NO_IMPORT` (true of this phone); `planmoment` still travels, so a backup can
  take the offer away, never add one. Never on `?gate=`, `?locked=` or a
  preview. Who it catches: the 1.0.4 households above; a household set up on
  1.0.5 before 13 Oct whose setup price never showed a figure; a "post"
  household whose Apple Premium lapsed; a browser household only if
  `WEB_SALES` turns on. **Travis's to know:** it is the first time Home opens
  the plan screen by itself, so whoever holds the phone (maybe the child) sees
  it, as a grey-game tap already does. Test seeds: a set-up `_phone.mjs` seed
  carries the mark unless `homeOffer: true`; a suite seeding a "post"
  household by hand on a phone that can sell sets it too. `homeoffertest`
  plays it.
`tests/trialfirsttest.mjs` plays the rule on every kind of phone, setup's last
tap, both screens, "Not now", the first game after the free days start, a
store that sells no free days or never answers, and the smallest phones.

`premium()` recognizes subscriptions, founders, free-era families, founding
pilots, and covered caseloads. Never a fixed count of free games: the plan
screens name them from the catalog, and the free book from `FREE_BOOKS`.
Clinician dashboard and Caseload Premium work stays separate and intact.

**Era five shipped in this build:** `_grandfatherFreeEra5()` keeps Premium for
every device already onboarded when it first loads this build (the window
that opened when #140 restored free on 24 Sep 2026). Preserve all five
sweeps. `tests/freetest.mjs` checks that both pricing switches agree. The
next free window, if there is one, gets its own sweep in the build that ends
it, never before.

**Before families can buy on the iPhone** (Travis's tasks, not this repo).
On 1 Oct 2026 none of the three was true, so **only the web checkout sold**:
1. **The app build must carry the purchase plugin.** 1.0.4, the build on the
   App Store, does not (`@revenuecat/purchases-capacitor` is missing from the
   iOS project in `~/Documents/SaaS`; 1.0.3 build 6 had it). Without it the
   app has no buy button: `Sona.iapAvailable()` is false.
2. **RevenueCat:** the yearly product attached to the `full` entitlement. It
   was attached to none (only an old `lifetime` product was), so a purchase
   would have been taken by Apple and left the app locked.
3. **App Store Connect:** the yearly subscription approved at the price he
   wants. It was listed at $79.99, under a description saying $59.99.
`NATIVE.md` says how to check each. **Since 5 Oct 2026 the iPhone sells the
monthly plan alone**, with 3 free days (see "THE IPHONE SELLS ONE PLAN"
below): `com.speaksona.app.monthly` approved in App Store Connect at the
monthly price with its free introductory offer, and in RevenueCat's `full`
entitlement. All three were true that day (1.0.5 Ready for Distribution).

**THE CHARTER PRICE IS TRUE BY CONSTRUCTION, OR IT IS THE BANNED ANCHOR AGAIN
(19 Sep 2026).** This repo already threw out one struck-through price
($119.88) for anchoring against a number nobody could pay. "$59.99 for the
first 50 families, regular price $99.99" is honest only because spot 51 really
is charged $99.99: `/api/checkout` reads `charterSpots()` (`lib/charter.ts` —
Stripe `subscriptions.search`, memoised a minute, falls OPEN if Stripe is
unreachable so a lookup failure never costs a family $40) and picks the tier
at the moment of purchase, whatever any page showed. Every surface reads that
same count — `/api/charter` for the static pages, `charterSpots()` for the
landing page — and the in-app plan screen disables its button until the count
answers, so a parent never taps $59.99 and meets $99.99 on the Stripe page.
A spots-left number is printed ONLY when Stripe answered it; a fallback count
is a guess, and a guessed scarcity number is the one thing no surface may show.
A spot is a subscription that checkout stamped `tier: charter`, in any status
but the two "never finished paying" ones; the yearly subscriptions from before
the offer existed carry no stamp and are not spots — they are Travis's own
test purchases ("dont count", 19 Sep 2026).
`tests/chartertest.mjs` pins the counting rule and every surface.

The word is **charter**, never **founding**: "founding family" already means
the free SLP-referred cohort, with a banner on Home saying so, and one word
for a paid tier and a free one is a support ticket. `CHARTER_LABEL` in
`lib/charter.ts` is the one user-facing constant. The arithmetic rule extends:
$99.99 ÷ 12 = $8.3325, so "**under $8.50 a month**" and never "$8.33".

The native card shows none of this. App Store Connect owns the iOS price;
mirroring the charter tier there is an ASC introductory offer, not a change in
this repo — `NATIVE.md` says what and why.

**TWO WAYS TO PAY: YEARLY, AND MONTHLY AGAIN** (Travis, 1 Oct 2026: "we need to
add to the paywall a $10 a month option. So that does not have a free trial.
That's a pay today, but the $59.99 has a three-day trial. And have that as the
default option selected"). Monthly was retired on 18 Sep 2026 and is back on
sale: **$9.99 a month, charged at purchase, no trial** (`MONTHLY_CENTS` /
`MONTHLY_PRICE` in `lib/charter.ts`, the one figure checkout, `/api/charter`,
the pages and the Terms use). The yearly plan keeps its 3 free days and the
charter price, and **it is the one picked when the plan screen opens**.
- **The plan screen** (`subscribe.html`, web and Apple cards, offer and
  Settings views): two boxes that are radios, yearly picked, **one button**
  under both. Everything true of only one plan follows the pick, from one
  paint function per card: the button ("Start 3 days free" / "Subscribe —
  $9.99 a month"), the billing line and "no charge today" (yearly only),
  "charged today" (monthly only), the small print and the heading. Nothing
  yearly stays on screen beside a button that charges today. The monthly box
  says **"Charged today"**, never "no free trial" (Travis, 1 Oct 2026: "dont
  say no free trial at the bottom"), and never the word "free" at all.
- **Under the button, one line: the day they are billed** (Travis, 2 Oct
  2026: "there's still too much information ... just briefly say like what
  day they'll be billed on the bottom"). Yearly: "Free until October 5, then
  $X a year." and, on Apple's card, "Renews unless canceled in Settings →
  Subscriptions." (on the web, "Cancel anytime.": a web buyer has no cancel
  button "in your account", and Stripe's page spells out the renewal). The
  date is the same +3 days the charge uses; the price is the store's string
  on Apple's card and the charter figure on the web, so the line never names
  a different number from the box above it, and it never promises a reminder
  itself: on Apple's card the one line that may ("We'll remind you the day
  before it ends.", NOTIFY1) is its own, shown only where the phone will set
  that notification, and RCHOOK1's email follows an App Store trial for a
  parent who gave the app an email, never a web purchase. It replaced a dated three-row timeline and the
  Apple card's paragraph of small print, and the web's yearly small print
  steps aside for it; monthly keeps its own line, which says how to cancel.
  What Apple requires stays: each plan's price and period, the renewal, where
  to cancel, and Restore Purchases, Terms and Privacy as links. The button is
  setup's teal (`.planbuy .btn.go` in `crafted-family.css`, "for
  now": painted art for it has not arrived), since 22 Oct 2026 setup's
  BRIGHTER teal (Travis: "not sure I love the greenish button"; a
  `#16c2be → #0e9c99` face, a `#0a8784` edge and shadow, a white label with
  a `#087572` shadow), so the two buttons a parent taps in a row still
  match (`pricescreentest` 14).
- **Monthly never touches the charter.** `/api/checkout` has its own short
  branch for it — its own amount, a month interval, no `trial_period_days`,
  **no `tier` stamp**, inline `price_data` only (never an env Price), and it
  does not even call `charterSpots()`. Routed through the yearly block it
  would be charged $59.99 or $99.99 every month. Its price does not move when
  the charter closes, and no surface calls it "charter" or gives it a
  spots-left number.
- **Only the plan screen can ask for it, by the exact word.** `pickPlan` sells
  monthly for `"monthly"` and nothing else; a missing plan, a typo or "month"
  is the yearly plan. **A plain GET link is always yearly**, whatever its
  `?plan=` says: an old ad or email link has no plan screen and no grown-ups
  gate in front of it, and must never open a pay-today checkout.
- **On the iPhone the store owns every figure.** Since 5 Oct 2026 the Apple
  card is not two ways to pay but one plan (see "THE IPHONE SELLS ONE PLAN"
  right below); the web card, which sells nothing while `WEB_SALES` is off,
  keeps both. No dollar saving and no ratio on the Apple card.
- **The comparison figures did NOT come back with it.** **$119.88** and
  **"save $59.89"** are still banned, on every surface, in both pricing
  states (`chartertest`). Twelve months of $9.99 is a real price again, but
  the saving is $59.89 only while the charter price lasts: at family
  fifty-one the yearly plan is $99.99 and the saving is $19.89, and on the
  iPhone the numbers are Apple's.
- **The receipt is Stripe's.** `/api/checkout/session` answers only a session
  Stripe marks `complete` (an opened, unpaid form used to unlock Premium), and
  the success page takes the plan from the subscription's interval, never
  from the address: a monthly buyer is never told "$0 charged" or shown the
  charter line.
`caseloadtest` plays the checkout route against a fake Stripe (what each plan
is charged, charter open and closed); `progtest` and `iaptest` play the pick on
both cards; `firstgametest` keeps both boxes and the button on the first
screen at seven phone sizes with the charter line showing, and re-prices
every yearly figure when the price check answers late.

**TWO PLANS ON THE IPHONE AGAIN, AND A 7-DAY TRIAL** (Travis, 19 Oct 2026,
"yes" to a funnel expert's review: one plan leaves a parent only "buy or
don't buy"; two let them compare; 3 days is too tight to see a child use it).
This replaces "one plan, no pick" below.
- **Yearly above monthly, yearly picked on arrival**, one button under both;
  the button, check line and small print follow the pick, and the button buys
  the picked product (`Sona.buyPlan`). Each row's words are its own
  product's store answer and eligibility (`plan.year`). **"Best value"** sits
  on the yearly row only when the store's yearly price is below twelve
  monthly ones; still no saving in dollars and no ratio. The page is sized
  to fit with either plan picked, so a tap moves no row; a yearly row that
  appears after the card showed monthly alone comes in unpicked.
- **The yearly row shows only when RevenueCat's current offering lists
  `com.speaksona.app.annual`** (`Purchases.getOfferings()`) and the store
  returns it; missing, slow or throwing, the card is the monthly row alone,
  exactly as before. That listing is Travis's switch, because on 1 Oct the
  yearly product was attached to no entitlement and a sale would have
  charged a parent and unlocked nothing: attach it to `full`, then add it to
  the current offering.
- **The free days are the store's.** Travis sets the introductory offer to
  one week in App Store Connect; `planFree` reads a week as "7 days", so the
  card, the Premium page and the small print follow by themselves. The
  welcome emails no longer name a number ("Try Sona free."). The web card,
  `/api/checkout`'s Stripe trial and `trial.html` keep 3 days: the website
  sells nothing.
- **No "<Name> wants to play <Game>" line** on the offer: by then the one
  tapping is the grown-up. The headline names the game.
- **A parked game is never offered:** `?from=<a Coming soon game>` is
  Settings › Your plan, behind the check.
`pricescreentest` (1b, 15, 15b) and `planwordstest` (2b) play both rows.

**ONE PAYMENT, A THIRD ROW (22 Oct 2026, iOS 1.0.9)** (Travis: "ok go build
it all", the one-time purchase on the price screen; "i dont wanna say
lifetime"). Apple's card can show a third row, under monthly.
- **The product:** `IAP_PRODUCTS.lifetime = "com.speaksona.app.lifetime"`, a
  NON-CONSUMABLE in the same `full` entitlement, App Store name "Sona
  Premium, One Payment", $59.99 (Travis's to set in App Store Connect; the
  card shows the store's price). The id is the store's and never shown. **It
  is July 2026's "Sona Lifetime" ($79.99) product, edited, not a new one:**
  App Store Connect never reuses an id, and Apple's buy sheet shows the
  display name, so a leftover "Sona Lifetime" puts the word on screen.
- **No "Best value" beside it:** the yearly row's tag compares twelve monthly
  prices, so it goes whenever the one payment shows at a price at or under
  the year's, or the two cannot be compared (one payment $59.99 under a
  "$59.99/yr · Best value" would be a false comparison).
- **Shown only by the yearly row's rule:** RevenueCat's CURRENT offering
  lists it (among its packages or as its `lifetime` package; one
  `getOfferings` read serves both rows, `_offered`) AND the store returns it
  by its own id with a price (`iapProduct("lifetime")`, category
  `NON_SUBSCRIPTION`). Missing, slow (the same 1.2 s grace), throwing, an
  unnamed product, no price, or one that claims free days: no row, the card
  exactly as before. No monthly product sells nothing, this row included.
  It is `plan.life` on the Plan `storePlan()` answers: always "paid", `per`
  "once", no eligibility asked.
- **Its words (`planWords`, Travis's to change):** "One payment" over "Yours
  to keep. No subscription.", the store's price with no period; picked, the
  check line "One payment · No subscription", the button "Get Sona Premium —
  $59.99" and the small print "One payment of $59.99. No subscription."
  Never "lifetime", "free", "Best value", a trial or a renewal (planwordstest).
- **The pick:** yearly, monthly, then the one payment, top to bottom; yearly
  picked on arrival (monthly without a yearly row), **never the one
  payment**; a row that arrives on a card a parent is reading comes in
  unpicked, and one that goes away while picked takes the pick to monthly
  (`take()` keeps the row the parent was reading while it is there). The fit
  holds for every row picked (`APPLE.others`, `APPLE.alt(kind)`), so a tap on
  any row moves no row; for three rows on the smallest phone in the longest
  shape one more level closes the rows up (`fit9`, last, never reached with
  one or two rows). The arrow keys go round all three.
- **Buying and keeping it:** `Sona.buyPlan(plan.life)` buys it through the
  same one purchase call (`purchaseStoreProduct`; an old plugin's
  `purchaseProduct` with type "inapp"); success is the `full` entitlement on;
  the list hears "paid" (`_tellPlan`); Restore finds it by the same
  entitlement; it never arms the trial reminder. RevenueCat tells the server
  with `NON_RENEWING_PURCHASE`, already "paid" in `lib/revenuecat.ts` (the
  welcome series stops; no note is queued: nothing ends).
- **The web sells no such thing** (`/api/checkout` is subscription mode only,
  `iaptest`): the one payment is Apple's alone.
- **The Premium page and Settings › Your plan:** in the app the Premium
  page's price line names the one payment when the store's answer carries
  it ("…, or one payment"), and the cancel line says a one payment has
  nothing to cancel.
- **Travis's tasks (NATIVE.md, "One payment, a third row"):** the existing
  non-consumable edited in App Store Connect, submitted with the build; in
  RevenueCat, attach it to `full`, THEN add its package to the current
  offering (offered but not attached, Apple would take the money and open
  nothing). **Travis's to know:** a family who bought the one payment and
  still has an old subscription that later ends would be told "We miss you
  at Sona" by RCHOOK1 (its EXPIRATION does not know of the one payment). It
  cannot happen from Sona's own card (an Apple ID with Premium is never sold
  a second plan), only from a subscription bought somewhere else beside it.
`planwordstest` (2c), `pricescreentest` (1c, 15c) and `rcwebhooktest` (3b)
play it.

**THE IPHONE SELLS ONE PLAN: 3 DAYS FREE, THEN $9.99 A MONTH** (Travis, 5 Oct
2026: "get rid of the annual option and update the copy so that it says three
days free, then $9.99 a month", after giving `com.speaksona.app.monthly` a
free 3-day introductory offer in App Store Connect). On the Apple card of
`subscribe.html` (offer and Settings views):
- **One plan, no pick:** the tile says "3 days free, then $9.99 a month."
  (Travis's words, built from the store's answer), the button "Start 3 days
  free", and the two-row timeline above it. Charged today: "$9.99 a month,
  charged today." and "Subscribe — $9.99 a month", no timeline.
- **The store decides every word, and the page types none.**
  `Sona.storePlan()` asks for the monthly product only, through
  `iapProduct("monthly")` (which refuses any other id), and answers one of
  `free` / `paid` / `none` / `owned`; `Sona.planWords(plan)` returns every
  sentence the card may show. `subscribe.html` ships no price, no day count
  and no "free" of its own: until the store answers the button reads
  "Checking the App Store…", and with no answer in 4 seconds the card says
  "We couldn't reach the App Store." with Try again and Not now. A store with
  no monthly product, or one that answers with the yearly product, sells
  nothing in its place. A late answer repaints the card by itself.
- **The buyer's own eligibility is asked** (the plugin's
  `checkTrialOrIntroductoryPriceEligibility`; Apple gives free days once per
  subscription group). A definite "not eligible" removes the free days. When
  the phone cannot tell (the call is missing, slow or unsure) the free days
  still show, but nothing is stated as plain fact: the rows say "new
  subscribers" and a line says "Only new subscribers get 3 days free.
  Otherwise Apple charges $9.99 today. Apple shows your exact terms before
  you confirm." An Apple ID that already holds Premium is told "You already
  have Sona Premium. Welcome back!" and sold nothing.
- **Never less able to sell than before:** purchase goes through the calls
  real phones already use; every new native call is optional and may only
  ever leave the card as if it did not exist.
- **The yearly product is not removed from sale in App Store Connect:** Apple
  says that also stops renewals for anyone who bought it. It is only no
  longer offered, and `IAP_PRODUCTS.annual` stays in `sona.js` for restore.
- **Not changed:** the web card and `/api/checkout` (the website sells
  nothing while `WEB_SALES` is off; turning it on would sell the yearly plan
  and a pay-today monthly, as built on 1 Oct), the clinician plans, the
  Terms (which name no Apple price or trial length). The Premium page says
  "One plan, month by month" in the app, and names the free days only once
  the store reports them.
`planwordstest` plays the store answer and every sentence; `pricescreentest`
the card in each store state (trial, none, no monthly product, the wrong
product, not eligible, unsure, already owned, the store silent) and that it
ships no typed figure; `setupbuytest` a new family from setup through a
purchase to the first game; `iaptest` and `trialfirsttest` the rails around
it; `chartertest` that the card's price span ships empty.

**THE TRIAL REMINDER ON THE PRICE SCREEN (NOTIFY1, 22 Oct 2026, iOS 1.0.9)**
(Travis: "notify them a day before their trial ends"). The one exception to
"No reminder is promised" above: on Apple's card, under the button, "We'll
remind you the day before it ends.", only when `Sona.trialReminderOn(picked
row)` is true: a build that can set a phone notification, a parent who
allowed it on setup's reminder screen, and a picked row that is a free trial
the store is SURE of (`plan.sure`: a "new subscribers" row may be charged
today, with no trial to remind of) whose reminder moment is more than an
hour away. The notification shows about 30 hours before the trial ends
(`TRIAL_REMIND_LEAD_MS`), not 24: Apple counts a cancel only at least 24
hours before the end, so a reminder at exactly a day before came too late to
act on; 30 hours is still "the day before" and "tomorrow".
Never on a charged-today row or the one payment. It is a promise
the code keeps: the purchase sets the reminder at once (`buyPlan`, before
the page leaves 1.2 s after a sale), and the daily check moves it or takes
it back. The line's words and the notification's ("Sona" / "Your free trial
ends tomorrow.") are Travis's and Rachel's to change. The rest (the four
native methods, the daily check, why never on Home) is under "THE TRIAL
REMINDER (NOTIFY1)" beside RCHOOK1.

**Do not hand-edit copy for a pricing flip. The surfaces read the switch.**
The switch has changed **twelve times in eight weeks** (`git log -G'const
FREE_MODE = (true|false)' -- public/sona.js`) — twice on the same day, twice on
consecutive days. Every purchase surface now branches on the switch and keeps
BOTH states: `app/families/page.tsx`, `app/terms/page.tsx`, `app/subscribe/page.tsx`,
`public/subscribe.html`, `public/trial.html`, `public/today.html`. Flipping
pricing is **one boolean in two files**. If you find yourself rewriting a price
into a page, stop — you are undoing this.

**The iOS price does not live in this repo.** `subscribe.html` overwrites the
figures with whatever RevenueCat reports from App Store Connect, so the native
card never states a saving at all, in dollars or as a ratio. Change
ASC, not this repo. And **flipping to free here cancels no Apple or Stripe
subscription** — anyone who bought during a paid window keeps being billed
until it is stopped in those dashboards. That is an operations task.

**The ask happens after the product proves itself** (for a family who keeps
the free version; since 3 Oct 2026 a family set up where Sona can sell meets
the price at the end of setup instead: see "TRIAL FIRST"). Setup goes straight into
the first game (Travis, 27 Sep 2026: "it will choose feed echo for the littles
and fruit slice for ages five and up"): Feed Echo for ages 3-4, Fruit Slice (its
practice page first) from 5, a clinician's own setup still ends on Home.
**That first game ends with no price** (Travis, 30 Sep 2026, after playing the
27 Sep version where it did: "the top stays as play again ... when they see
home they see the other games they can play and that there are premium ones
... the flow was not good"): "Play again" on top, "Back home" under it.
`Sona.firstGameStart()` marks the game for this tab and `firstGameEnd(key)`
spends the mark once and always answers Home. For a family who keeps the free
version, the offer is made in exactly two
places (a family who starts with the trial also meets it at setup's end, on a
grey-game tap, and once from Home: see "TRIAL FIRST" and "THE OFFER, ONCE,
FROM HOME"), both behind the grown-ups gate: **once**, automatically, at the end of
the first completed practice run ("Show a grown-up →" to
`/subscribe.html?first=1` while `planEligible()` says so), and **whenever** a
grown-up answers a child's tap on a locked game or book ("Ask a grown-up" →
`premium.html`, which forwards a family it would offer to
`/subscribe.html?from=<game>` or `?from=library`). Since 4 Oct 2026, wherever
Sona can sell, the tap itself opens that offer, with no note and no check in
between (see "A tap on a grey game or book opens the price at once" under
"TRIAL FIRST"); the note and `premium.html` remain for a phone that cannot buy. Never during onboarding,
which used to end at a price screen before the child had said a word. It is an
offer, not a wall, it is inert while free, and it never fires for anyone
already entitled. Declining leaves Home with every game but the free ones
greyed out (still tappable: "ask a grown-up"). `tests/firstgametest.mjs` pins
all of it.

**The plan screen reached as an offer is a moment, not Settings** (Travis, 30
Sep 2026: "this paywall is absolutely terrible!"). With `?first=1` or `?from=`
and a purchase card on screen, `subscribe.html` sets `body.offer`: the
grown-ups tabs, crumb, "Your plan" head and summary box step aside, and the page
leads with the Premium games in Home's own art (`Sona.CRAFTED_CARDS`, one map
for both pages), one line built only from what the device recorded ("Milo just
practiced the R sound — 12 words out loud!") or the tapped game ("Milo wants to
play Hoops"), a headline, three checks, then the plan card (two ways to pay
since 1 Oct 2026, above) with the button on the first screen at 360×740,
375×667 and up. **The fit is measured, never guessed from the screen's
height:** `fitOffer()` looks at where the button actually landed and takes
one step at a time (`body.fit1`…`fit5`: a smaller picture, a strip, tighter
type and boxes, then the third check gives way to the "What stays free" card
under the offer, and only last the picture goes) until it is on screen. A
height rule failed between 701 and 855 px tall with the charter line showing.
Everything it resizes has `transition:none`, because `sona.css` gives every
property a near-instant transition under Reduce Motion and a box
mid-transition reports the size it WAS. **The line under the headline says
who Premium's games are for, never how many** (Travis, 1 Oct 2026: "a
different way to say 6 more games today, like more games for littles and for
bigs ... new ones on the way is fine"), and it is read from the catalog so it
is true for the parent reading it: "More games for little kids and big kids,
and new ones on the way." only once BOTH age groups have a Premium game a
child can open. On 1 Oct every playable Premium game was a big-kid (Arcade)
one, so it says "More games for big kids, and new ones for little kids on the
way." and changes by itself the day a little-kid Premium game is released. No
date is promised. **Anything switched with the `hidden` attribute is hidden**
(`[hidden]{display:none !important}` on this page): a display rule on the same
element once showed an empty win pill and Rachel's line twice. Rachel's line moves under the
decline, word for word, and the note under the decline steps aside (2 Oct
2026). Settings › Your plan (no flag) is the page as it was.
Every pricing rule in this section still applies to the card itself.

**Eligibility and impression are two functions, and merging them is the bug.**
`planEligible()` answers "should we take them to the plan screen" and changes
nothing; `planShown(surface)` is called by the paywall once it has actually
rendered, and is the only thing that spends the one-shot and logs "plan moment
shown". They were one function (`planMoment()`, now an unused shim) that
decided and consumed in the same breath — so a parent who backed out of the
grown-ups gate in between lost the only ask Sona will ever make, while the
funnel counted an impression nobody saw. `iaptest.mjs` pins both halves.

### Clinician Premium — for you, then for your caseload
**Two yearly plans, bought on the web by the clinician** (Travis, 24 Sep 2026
— this reversed "there is no payment path for an SLP or clinic"; re-priced 29
Sep 2026: "they're going to still pay the 60 bucks for an account, and they
can pay an extra 60 bucks a year for all of their caseload"):
- **"Sona Premium for you", $59.99 a year** (`plan: slp-self`): every game on
  the clinician's own phone or tablet, by the emailed own-phone link.
- **"Sona Premium for your caseload", $59.99 a year MORE** (`plan:
  slp-caseload, addon: "1"`): every family who joins through that clinician's
  link gets Premium — whether or not they say "Yes, share progress": access
  and sharing are separate promises. **An add-on:** `/api/slp/plan` refuses
  it (`needSelf`) until the clinician's own Premium is on, and the page and
  Settings say so. Its own subscription, under the same Stripe customer, so
  Manage billing shows both and each cancels on its own.
Stripe hosted checkout from the dashboard's Premium page or the Premium card
in Settings, **no trial**, renews yearly, cancel anytime in Stripe's billing
portal. $59.99 ÷ 12 = $4.9991, so "**under $5 a month**"; both, $119.98 ÷ 12
= $9.998, "**under $10 a month**". Neither is the family plan at the same
figure: never a charter spot, never $99.99 when the spots run out.
`lib/caseload.ts` holds every constant; the static landing page cannot import
it, so `shiptest` pins its copy to it. The caseload's fixed-Price env var is
`STRIPE_PRICE_ID_SLP_CASELOAD_ADDON` (new, so an old $79.99
`STRIPE_PRICE_ID_SLP_CASELOAD` can never be charged under a $59.99 page); the
own plan's is `STRIPE_PRICE_ID_SLP_SELF`. Both optional.
- **Three account eras, one `terms` stamp, never backfilled.** No `terms`
  (before 24 Sep): caseload AND own phone free forever. `terms:
  "caseload-2026-09"` (`FREE_SELF_TERMS`, 24–29 Sep): own Premium free with a
  work email or a founder's approval, as they were told; caseload is the
  add-on. `terms: "premium-2026-09-29"` (`CASELOAD_TERMS`, from 29 Sep): buy
  both. A caseload subscription sold before 29 Sep has no `addon` stamp: it
  keeps renewing at $79.99 (`LEGACY_CASELOAD_PRICE`) and keeps switching on the
  clinician's own phone. `selfStatus()` in `lib/caseload.ts` is the one place
  those rules live; `/api/slp/covered` reads it for an own-phone ticket.
- **Covered = paid or grandfathered.** Paid is a Stripe subscription stamped
  `plan: slp-caseload, slp: <email>` in active, trialing or past_due. Stripe
  keeps a cancelled plan active to its period end, so families keep Premium to
  the end of the year that was paid for, then drop to the free version — and
  that holds by construction, not by a dashboard toggle: **Manage billing opens
  the caseload's OWN billing-portal configuration, whose cancel button cancels
  at period end** (`openCaseloadPortal()` in `lib/caseload.ts` creates it once
  and reuses it — its id cached per Stripe mode in the `stripe:portalcfg:caseload`
  hash — or reads `STRIPE_PORTAL_CONFIG_CASELOAD`). A "no plan" answer is
  remembered for 60 seconds only, so a payment whose redirect was lost is
  found by the recovery search within a minute. The account's
  default portal, which the family billing page shares, is only the fallback
  if Stripe refuses that configuration. Never a `tier` stamp: only
  `tier: charter` is a charter spot.
- **Clinicians who signed up before 24 Sep keep "free forever".** They were
  promised "Free forever, unlimited families — for you and every kid on your
  caseload", and they and their caseload stay covered, free. Structural, no
  dates: an account with no `terms` predates it. Never backfill that field.
- **"Every family on your caseload", never "unlimited".** The redeem cap is
  300 for a covered clinician (60 uncovered), counted **per code AND per
  clinician** (`slpredeem:<code>` and `slpredeem-owner:<email>`, ~a year each)
  — a clinician can claim a new code at any time and every code shares one
  family key, so a per-code cap alone multiplied with every rename. It counts
  successful sign-ups, not distinct families (a second phone or a re-tapped
  link counts again), so the Terms say "a single link allows up to 300
  sign-ups a year … we raise it on request", and the error at the cap says
  "ask your speech therapist to contact Sona" — a fresh link hits the same
  wall.
- **Coverage rides the enrolment ticket, and the ticket never freezes.**
  `/api/slp/covered` answers a correctly signed ticket at any age and, past
  half its 400-day life, hands back a fresh one that `Sona.caseRefresh()`
  stores — before this, from day 400 a family's coverage stuck in whatever
  state it was last in. The SLP link state (`sona.slp`, `sona.slpok`,
  `sona.slpticket`) **travels through backups** (Settings › Moving to a new
  phone?; setup has had no code box since 2 Oct 2026), because
  the iOS app keeps separate storage from Safari and that is the only way a
  covered family's Premium reaches the iPhone app; the cached answer
  (`sona.caseplan.v1`) never travels, and the server is asked afresh.
- **The clinician earns nothing on their caseload, ever** — the creator-only
  rule below is unchanged, and the Premium page says so in words.
- **The family price, on the Premium page, comes with its conditions** —
  "on the web, $59.99 a year for the first 50 families" (price and cap from
  `/api/charter`), "on the web, $99.99 a year" once the charter spots are
  gone, and nothing when the route doesn't answer. A clinician repeats what
  she reads, and a bare launch price is a figure most families will not see.
- **Their own phone: bought, or free where it was promised.** The dashboard
  stays open to any email (the landing page collects every one). The
  own-phone link is emailed to anyone whose own Premium is on. Only a 24–29
  Sep account without a work email sees "No work email? Request access",
  approved by hand on `/leads.html` (which, and `/api/founders/approve`,
  refuse an approval for any other account: it would change nothing).
  Approval sends no email, so the card says "Requested — once we approve it,
  this button will work." beside the greyed-out button. **Never "one phone":**
  each link works once, but three can be sent a day and none is retired, so
  the copy is "Premium on your own phone or tablet. Each link works once."
  How many devices a clinician may have is Travis's open call.
- **The family surfaces refuse both clinician receipts** (`isClinicianPlan()`):
  restore-by-email, the family billing page and the family success page.
- **Web only.** Clinician pages never render in the iOS shell, so neither plan
  has an App Store product or meets an in-app purchase rule (`NATIVE.md`).
  They do not read `FREE_MODE`, which is the FAMILY paywall switch.

### Five free eras, and the sweeps that honour them
`_grandfatherFreeEra()` through `_grandfatherFreeEra5()` run at load and are
pinned in `iaptest.mjs` and `freetest.mjs`. **Do not "clean them up".** Each is
a promise to a real cohort that no later flip can revoke:
- **Era one** — before pricing existed. An onboarded device carrying no stamp
  predates pricing.
- **Era two** — nine days in August (20–28).
- **Era three** — 31 Aug to 15 Sep, announced as permanent.
- **Era four** — 20 Sep 2026 ("make it free" merged to main) to the Caseload
  Premium build of 24 Sep 2026. (The 17–18 Sep flip is NOT this era: it never
  reached main, so no family was told anything.) **`_grandfatherFreeEra4()`
  shipped in that same build**, as this rule required (Travis, 24 Sep 2026), and
  it also counts a device that had redeemed a clinician's link
  (`sona.slpunlock` / `sona.slpok`): before that build a redemption WAS
  free-forever access. The rule stands for the next window: a sweep ships in
  the build that ends a free window that actually SHIPPED (merged to main) —
  never earlier, because a sweep shipped during the window stamps the very
  families it exists to protect before they onboard, and they would pay.
- **Era five** — 24 Sep 2026 (#140 made the family app free again the
  afternoon Caseload Premium merged) to the paywall build of 30 Sep 2026.
  **`_grandfatherFreeEra5()` shipped in that build**: every device already
  onboarded on its first load keeps Premium for good (`freeEra5` on the
  profile, `sona.freeera5.v1` stamped). Unlike era four, a clinician's link on
  its own is not this era's evidence: since 24 Sep a redemption is a ticket
  whose Premium is the clinician's coverage, and that promise keeps itself.
  The launch lock means most families meet this sweep on launch day, their
  first load of the build.

**The sweeps are one-shot and structural, and that is load-bearing.** A device
already onboarded on the first load of the build carrying a sweep necessarily
predates that build; a family arriving afterwards is stamped before they
onboard and correctly still pays. Each new sweep must NOT read the earlier
stamps — a device whose first load happened during a later window carries all
the earlier ones and belongs to no earlier cohort.

**Test seeds must set EVERY era stamp.** An onboarded seed missing the newest
`sona.freeeraN.v1` looks exactly like that era's cohort, gets grandfathered,
and silently disables the paywall inside that test. This has bitten once per
era across `iaptest`, `progtest`, `loadtest` and `hwtest`. The trial-first
stamp works the other way round: an onboarded seed without `sona.freever.v1`
is judged "kept" and has the free version, as every suite before it assumed;
a test about trial first seeds "post". The kept-buddies stamp (11 Oct 2026, OWN1)
works the same way: an onboarded seed without `sona.buddyset.v1` is judged
"kept" (its profile gains every legacy buddy, hat and place on first load);
a suite about a new family's Buddy Shop seeds "post". A suite that loads a
page before it seeds must set the stamp itself: that first load stamps
"post". A suite that holds a page's first load to writing nothing seeds
"kept", as it seeds `sona.freever.v1`: the sweep writes on that first load.

**Tests do not pin the switch's value.** They pin that the two copies agree,
and they exercise the purchase rails through the `?paid=1` / `sona.paidui` seam
so they hold in either state. A test that must be hand-edited on a business
decision guards nothing and taxes every flip. `IS_FREE_NOW` in `iaptest.mjs`
reads the live state from source where a suite genuinely needs it.

Free regardless of the switch: practice, the free games (Fruit Slice, Piano
Tiles, Feed Echo and Bubble Pop) and the free book (Rory and the Rainbow), for every
family that keeps the free version (since 3 Oct 2026 not every family: see
"TRIAL FIRST"); founding pilots (`ff-` codes) and founders; every device onboarded, or
that redeemed a clinician's link, before the Caseload Premium build; every
device onboarded before the paywall build of 30 Sep 2026. **Not**
an SLP-code pilot: "Yes, share progress" makes every consenting family a
pilot, so counting `isPilot()` in `premium()` would hand every uncovered
clinician's families Premium and undo the caseload plan.
- **Founding status is the household's** (`sona.founding.v1`, written by the
  verified `?ff=` path — or carried out of a slot an older device's `ff-` code
  is about to be overwritten in — and on `NO_IMPORT`). It used to be read off the
  per-child pilot code, which "Yes, share progress" overwrites with the
  clinician's code — so a founding family lost every game the day they joined
  an uncovered clinician, and a second child never had them.
- **Grandfathering is the household's too.** `addKid()` copies `earlyAdopter`
  onto a new child, and an import never takes a free-era mark away from the
  device it lands on (it never brings one either). It is still a mark on the
  device the sweep ran on: it does not travel to a new phone. **What a clinician's link
brings changed on 24 Sep 2026 (Travis):** until then it was free-forever
access, in writing on `for-slps.html`; now it is the free version, plus every
game while that clinician's caseload is covered. Entitlement is never granted
from a URL parameter: coverage is the server's answer to the enrolment ticket
the device earned by redeeming code + key (`Sona.caseRefresh()`, re-asked every
6 hours; only an authoritative answer changes anything).

**THE SLP SIDE WAS THE CHANNEL, 21 Sep to 22 Oct 2026** (Travis, 21 Sep
2026: "im keeping it free. targetting slps first"; since 22 Oct speaksona.com
does not look for therapists at all, below, and clinicians already here keep
everything). It was hidden on 19 Sep as "not a priority" and that
is now reversed. **Setup itself is for parents** (Travis, 5 Oct 2026: "I want
to take out the button of who's setting up Sona because it's just for the
parents"): the "Who's setting up Sona?" screen of 1 Oct is gone, and the
hello (Echo in his world, one Continue) goes on to the screens that sell
(see "SETUP, REBUILT FROM SCRATCH"; a family's first setup only), then the child's name. A
speech therapist signs up at speaksona.com/for-slps. The clinician's own
setup (`ORDER_SLP`) is kept, and kept tested, behind its own address,
`/onboarding.html?slp=1`, which nothing in the app links to (in the iPhone
app that address sets the app up for a child in a clinician's words, with no
price, and ends on Home). `for-slps.html` is `noindex` and linked from
nothing a parent reads since 22 Oct 2026 (below), and `betatest` pins that
setup asks no such question. Since 24 Sep 2026 the channel can
also pay: the dashboard and the free version stay free, and a clinician who
wants every game for their families buys their own Premium and adds their
caseload — yearly prices, never per family, never to the clinician. **Parents come first now** (Travis,
29 Sep 2026: "lose my attachment in stop caring about the SLP stuff, but still
leave the $5 a day add on"): the offer sits in plain sight on the dashboard,
and the new ads, and the work, go to parents. The SLP ad kept running until
22 Oct 2026; stopping it is Travis's, in Meta.

**speaksona.com is for parents and caregivers** (Travis, 26 Sep 2026: "change
it to target parents and caregivers only. not slps"). Its yellow is pale
butter, not sun (27 Sep 2026: "the more pale yellow. to help the app icon in
top left stand out"), so Echo's bright tile is the yellowest thing on it. The
root is `parents.html`: the headline "Speech practice kids love." (Travis, 4
Oct 2026: "I want to make the website say speech practice kids love"; until
then it was the parent ads' "Speech practice kids ask for.", which the ads
still say; setup's hello says "Speech practice kids love." since 22 Oct 2026),
the new Echo and the two game screens from those ads, one email box and one
button (role `parent`, nothing else — no name, no "I'm a…"), then the App
Store (Android: the web app). **Right under the top come the sliding games
and books, then Rachel** (the same day: "I want that a lot higher up ... and
I also want Rachel's bio higher up"), then the rest in its old order. **The
email goes straight to the App Store** ("I just want it to go immediately"):
once the server says yes the Lead fires, the button reads "Opening the App
Store…" and the page leaves 150 ms later (`LEAVE_MS`, the time the pixel's
request needs to get out). No panel and no second button come first; the
"You're in" panel with "Get the app" is only what an iPhone visitor finds
when they come back from the App Store. `landingtest` plays it. No Sign in in its header, and
nothing on it links to `/for-slps` (22 Oct 2026, below). Its pictures were cut from the ads and
changed only where the ads showed what the app no longer does — the STAR MODE
gold tile, gold key and star fruit, and the "Say rrrr for GOLDEN KEYS / a
FRENZY" banners are painted out — and the ads' text thread and "Max's" fridge
note are not used: they quote parents who do not exist. It never prints a
dollar figure; its cost answer reads the switch from `/api/charter`. Its
game count (every game Home opens, never a Coming soon one), its book count
(only the books the shelf has opened: each book tile carries its opening day,
and the page counts and tags them on the visitor's own calendar) and "19
speech sounds" are pinned to the catalog by `shiptest`, and its game strip
shows only games a child can open: bring a game back and the test fails until
the page says so. **The strip's game tiles are the app's own painted Home
cards** (1 Oct 2026; they were the old flat stickers and three frames of a
canvas court beside painted book covers): `python3 tools/art/site-tiles.py`
cuts each `public/assets/crafted/home-<name>.webp` to a square in
`public/assets/site/games/<key>.webp`. A new game on the strip is one line in
that script's `TILES`. **Two kinds of phone screens** (Travis, 6 Oct 2026):
the game sections further down show today's painted games
(`/assets/site/slice.webp`, `piano.webp`, fresh captures), but behind Echo at
the top the ads' old flat screens stay (`hero-slice.webp`, `hero-piano.webp`):
the painted ones "don't go with Echo or the app icon", and "what we had before
was better even though it's not what the screens actually look like anymore".
They are decoration (`aria-hidden`), and `landingtest` pins them.

**speaksona.com/try is the ads' bridge page** (Travis, 9 Oct 2026: "more of
a bridge page. I don't want to collect email ... just like a headline, a
sub-headline, a button. Maybe a picture of a screen"). `public/try.html`,
rewritten from `/try`: the brand, Echo between the two flat hero screens, "Speech
practice kids love.", one sub-headline, one teal button ("Try Sona free") to the
App Store (Android: the web app), "Free to try on iPhone and iPad", and
"Built with Rachel, a pediatric speech-language pathologist in her clinical
fellowship." (Travis, the same day: without "MS, CF-SLP" on this page only;
`shiptest` allows that exact line there and nowhere else). No email box and nothing posted; a tap sends the
pixel `ViewContent` (the fact, never who) and leaves 150 ms later. `noindex`
(the root is the page search finds), on `OPEN_PAGES` and on the pixel's
allow-list. The root page with its email box is unchanged. `landingtest` plays
it on an iPhone and an Android phone.

**The clinician page lives at `/for-slps`** (the root from 22 to 26 Sep). It
still speaks to parents and SLPs alike (Travis, 25 Sep 2026: "I don't know
who my customer is"): the headline stays, and the one form asks for **an
email and "I'm a…"** (Parent or caregiver · Speech therapist (SLP or SLPA) ·
Other) and nothing else. The header is just Sign in (Travis, 26 Sep 2026:
"get rid of for parents"). An SLP or SLPA also gets their dashboard account
and sign-in email, because the iPhone app has no clinician side; everyone
else goes to `/api/lead` with their email and role. `tests/landingtest.mjs`
drives both pages.

**speaksona.com is only for parents, and does not look for therapists at
all** (Travis, 22 Oct 2026: "speaksona.com is only for parents. I don't
want to target therapists at all"). `/for-slps` keeps working for anyone who
has the address (clinicians already signed up, some paying for Premium), but
it is `noindex`, out of the sitemap and `llms.txt`, and no page a parent
reads links to it: the parent page's footer lost "For speech therapists",
the old `/families` page its "For SLPs". The dashboard, sign-in, the
clinician plans and every covered family are untouched; not looking for
new therapists is not breaking the ones already here. A therapist ad, if
one still runs, is Travis's to stop in Meta. `shiptest` and `landingtest`
pin it.

**Search engines and AI assistants** (Travis, 22 Oct 2026: a parent asking
ChatGPT or Google how to do speech practice at home should hear about Sona).
The site is built to be read:
- `app/robots.ts`: every crawler welcome, the AI assistants' by name; only
  `/api/` and `/admin/` blocked. Never block a `noindex` page there: a
  blocked crawler never reads the noindex.
- `app/sitemap.ts`: the root, privacy and the Terms; never an app screen or
  a `noindex` page.
- `app/llms.txt/route.ts`: Sona in plain text for AI assistants, every line
  one the parent page already says. Rachel's settled line word for word, no
  dollar figure, no count of games or books, and the cost line is the
  parent page's own answer, chosen by `FREE_MODE` and `WEB_SALES`.
- schema.org labels (`application/ld+json`) in `parents.html`'s head: who
  makes Sona and what the app is, with no price.
- `noindex`, so search sends parents to the root: `for-slps.html`,
  `try.html`, `check.html`, `/families`, and the private surfaces below.
Any page written to answer a parent's search ("how to practice the R sound
at home") explains how to practice a sound, so it is Rachel's to review
before it ships. `shiptest` pins all of it.

**The app is live, and the websites send people to the App Store** (Travis,
1 Oct 2026: "yeah send people to app store now!", with the listing checked:
a free download, not a pre-order). `APP_READY = true` in `lib/launch.ts` and
`var APP_READY` in `parents.html` and `for-slps.html`, pinned equal by
`shiptest`: the top line reads "Now on iPhone and iPad", Start free takes the
email and opens the App Store (Android: the web app), and the "launches
Friday" welcome email and the clinician's P.S. stop. **Nobody on the waiting
list is emailed by this**: they were promised an email "the moment it's
ready", and that is a broadcast Travis sends. The switch stays, both
states built, for the next time the app is not ready (25 Sep 2026: "the app
launches next week"; the iOS 27 build closed on launch). While it is `false`,
nobody is sent to the App Store: a parent or "other" is thanked
on the page ("Sona launches Friday, October 2. We'll email you the moment it's
ready.", the date Travis emailed the list on 30 Sep) and emailed the same once through Resend (`/api/lead`,
`launchmail:<email>`; a reply goes to `RESEND_REPLY_TO` when it is set, and
nowhere otherwise); a speech therapist goes to their dashboard's
community (`/slp.html#community`) and their sign-in email carries the same
P.S. Not the web app: Travis chose to wait for the app. When the app is
live, set all three switches to true.

**The family app is locked until launch day** (Travis, 30 Sep 2026: "the
official V1 of Sona launches Friday, October 2nd ... lock the app until
Friday ... they can turn on a notification if they press notify me or ... put
in their email"). Until `LAUNCH_AT` in `lib/launch.ts` (midnight at the start
of Friday 2 October in Idaho, 06:00 UTC), `middleware.ts` answers every
family page, on the iPhone and the web, with `public/launching.html` at the
same address: the date and one email box (`/api/lead`, role `parent`, source
`app-launch`, the one launch email). `OPEN_PAGES` stay open: the two
websites, the clinician's dashboard and sign-in, the founder pages, privacy
and the lock page. Every other .html page locks, a new one included. At
`LAUNCH_AT` the app opens by itself with no deploy, and a phone left on the
lock page reloads into it. **The team door:** five taps on Echo, then the
founder key (`/api/launch/preview`, sent in a header, never the address)
sets an HttpOnly cookie that is an HMAC of the key; the iPhone app keeps its
own cookies, so open the door from inside the app. `APP_READY` still flips by
hand, once the App Store shows Get. An App Review build before launch sees the
lock page. `tests/launchtest.mjs` pins all of it.

**The lock was lifted early** (Travis, 30 Sep 2026: "Reopen the app so that I
can more easily edit", and yes to opening it for everyone now, before the
Friday launch he emailed). One switch, `LAUNCH_LOCK` in `lib/launch.ts`:
`false` opens every family page whatever the date; `true` locks them until
`LAUNCH_AT` again, as above. The date, the lock page and the team door stay,
unused, and the websites still say the app launches Friday. A lock page left
open (an iPhone app in the background) asks the server when it comes back to
the front and opens the app once Home is no longer the lock page.
`launchtest` tests the lock switched on and off, whichever way it ships.

**The SLP community shows who is there** (Travis, 25 Sep 2026): the real
number of SLP accounts and up to a dozen members' first names, newest first,
only to signed-in members, rebuilt every ten minutes
(`{slp-community}:members`). Never a last name, an email or an invented
member.

Still `noindex`, correctly: `slp.html` and `slp-login.html` (a private
dashboard and its login) and `join.html` (a family's redemption link, which
carries a credential in the URL). Those are surfaces, not marketing. So,
since 22 Oct 2026, is `for-slps.html` (above).

Still absent now that Premium is back (24 Sep 2026): the "working with a
speech therapist?" card on the plan screen and the trial page; `progtest`
pins its absence. Bringing it back is a product call, not a cleanup.

## The clinician's dashboard: carryover, in the honest register
**The SLP dashboard (`public/slp.html`) is built around ONE problem — carryover
(Travis, 21 Sep 2026):** a child goes home, practices, and the clinician can
see that it happened and paste it into a note. Not "assigning homework"
(table stakes), not income. So the page is Today (who practiced this week,
who went quiet, what ends soon — one action per row) → Caseload (every child,
oldest-practiced first, **Copy note on every row**) → a child page (8-week
strip, pass rate by sound and position, the current homework, the composer)
→ Premium (its own page, 24 Sep 2026: Today keeps exactly its four
cards, and no price ever appears in them; viewing it only reads) → Settings
(which carries a Premium card with the same two plans and buy buttons, 29 Sep
2026: "an upsell … in like the SLP settings").
Since 29 Sep 2026 (Travis: "yes add the $80 button to the first screen") a
button with the server's price sits in the top bar of every page but the
Premium page, because a clinician from the ad lands on Community and never
saw the price. It offers the next thing to buy: **Get Premium** (their own)
until that is on, then **Add your caseload**, then nothing. Only once the
plan has answered; `slptest` 9b pins it.
Reviewed by three lenses — a school SLP, a district privacy
officer, an engineer — whose rulings are now rules:
- **Register.** "Pass rate" (defined on the page as "did that sound like this
  sound"), "practice", "homework". Never "accuracy", "score", "adherence",
  "therapy", "treatment", "diagnosis", and no credential in an example name.
  `tests/slptest.mjs` scans the page with comments stripped.
- **`SMALL_N = 20`.** Under twenty attempts a pass rate is "too few to read"
  and no percentage is shown — anywhere: table, grid, strip, note, CSV. One
  constant; whether a percentage is shown at all is Rachel's call.
- **The note is a fixed template** and carries its own hedge: "Between {start}
  and {end}, {Name} practiced on {n} of {N} days ({avg} tries a day). {Sound}
  in {position}: {pass}% pass rate over {attempts} attempts. A practice
  snapshot from at-home listening on the family's device; not an evaluation."
  Window = the current homework, else the last 14 days. Never an age.
- **No caseload-wide average.** An unweighted mean of percentages across
  children is meaningless; the one number is "N of M children practiced this
  week". No leaderboard, no ranking, no comparison across families — a
  district officer ends the app's use on that alone. This binds the
  clinician side. The family Practice Board exists by Travis's decision (9
  Oct 2026), built switched off until his go (`BOARD_LIVE`, BOARD1/BOARD2).
  It is opt-in by a grown-up's email, off on clinician-linked and many-child
  phones and for families who say a therapist or school sent them, and never
  in `slp.html`, `sendProgress` or any clinician route.
- **Invites hold initials, never a name.** The SLP may add a child before the
  family joins, but the placeholder is a label ("MK"), an optional age and a
  target; the family types the name when they join, so nobody at a school or
  clinic ever sends Sona a student's name. Unclaimed invites delete
  themselves after 30 days. The claim fires only on the parent's "Yes, share
  progress" — never on link open — and "No thanks" leaves the SLP seeing "not
  joined", never "declined".
- **A parent's email, typed by the clinician, is used once** (Travis, 24 Sep
  2026). Add a child may carry it; Sona hands it to Resend to email the join
  link one time and keeps no copy — not on the invite, not in the email list or
  `/api/lead`, not in a log — at most 30 a day per clinician. Say "handed to
  Resend", never "kept nowhere": Resend has it, and a privacy officer checks.
  A parent joins the list only by typing their own email under the consent
  line (`join.html` → `/api/lead`).
- **Remove means delete.** Removing a child deletes the roster row and the
  homework AND tombstones the child (`slpgone:<code>`) so the device's next
  sync cannot resurrect them; the dialog promises exactly that, and that
  nothing on the family's device is touched. The words ship only with the
  routes.
- **One family door.** Every generated link is `join.html?slp=CODE&k=KEY`
  (`&inv=TOKEN` per child). The message says "free", never "pilot" or "trial",
  and promises what is true today: the free version, and Premium only while
  the caseload is covered. "Free forever" and "unlimited" are gone from every
  clinician surface (`slptest`, `shiptest`).

**The affiliate program, when it is built, is CREATOR-ONLY** (Travis, 21 Sep
2026 — settled, do not re-open). An SLP who makes content and brings in
families from outside their own client base can earn on it. An SLP never
earns on a family from their own caseload: a clinician taking a per-sale
commission for recommending a product to their own clients is a referral fee
under several state practice acts, and two of those reach the party OFFERING
the payment as well as the clinician. So the rule is enforced in code, not by
trust — a payout is structurally impossible for any family that arrived
through that clinician's caseload code or sits on their roster — and the
clinician's free dashboard never depends on how many of their families
upgrade.

## The email list: Resend's contacts (Kit and GoHighLevel are gone)
**GoHighLevel was deleted on 24 Sep 2026 and Kit replaced it; on 16 Oct 2026
Resend's contacts replaced Kit** (Travis: "I am done using Kit. I'm going to
be using Resend", then "every new email goes into like a resend contact list
... I want to be able to not have to go into that HTML page"). Every grown-up's
email goes through one door, `/api/lead`: the SLP sign-up (via the auth
route's `tellCrm`), the app's setup (a clinician's account email, a parent's
optional email from setup's email step, before the price), the parent's optional box on `join.html` and the Speech
Check. An address a clinician types for a parent never reaches it. That route:
- **keeps every lead first** in the store (`leads:all`, capped), whether or not
  a list takes it — it once forwarded and forgot, and 26 "leads" were unfindable;
- makes it a **Resend contact** (`lib/contacts.ts`, `upsertContact`): in the
  segment **Parents**, **Speech therapists** or **Other** by who they said they
  are (a lead with no role is a parent), and in **Started Premium** once the
  phone's plan post says "trial" or "paid"; three properties, `role`, `source`
  (where it was given) and `plan`. The segments and properties are made the
  first time (or found, by name, if Travis made them) and kept in the store
  (`resend:list:<hash of the key>`). A contact Resend already has gets the
  plan and the segments; **nobody is ever re-subscribed**: `unsubscribed` is
  only ever set to true, and an address in `email:unsub` (or its plain
  mailbox) is made unsubscribed. Only Resend holding the address counts;
- says `captured` only when a list actually said yes.

**It needs a Full access Resend key** (`RESEND_API_KEY`, the one that sends):
a "Sending access" key sends every email and adds no contact, and the ledger
says "the Resend key can only send emails". Resend allows about two requests
a second for the whole account, shared with every send, so each contact call
and each welcome email is tried once more after a 429 (the welcome's
idempotency key makes a double send impossible).

**One unsubscribe list, both ways.** Sona's own unsubscribe link
(`/api/email/unsub`) also marks the Resend contact unsubscribed at once, and
the plain mailbox's contact too (`markUnsubscribed`), so a broadcast skips
them; the address is owed (`resend:unsubowed`) until Resend says yes. The
daily `/api/cron/nurture` starts with `syncUnsubscribes` (45 seconds at
most): the owed unsubscribes; then, **every day while `KIT_API_KEY` is set**
(an old Kit email's unsubscribe link works until Kit is closed), Kit's
leavers (`importKit`: every subscriber Kit lists as cancelled, bounced or
complained, never "inactive", which in Kit is someone who never confirmed;
a bounce as the exact address only, since "john+sona@" bouncing says nothing
of "john@"); then the check both ways (`reconcileUnsubscribes`): a contact
who unsubscribed in Resend (a broadcast's link) joins `email:unsub`, so the
welcome series and the weekly report stop for them too, and a contact still
subscribed whom `email:unsub` says has left (a Kit leaver added before Kit's
list was in, another spelling of the same Gmail inbox) is unsubscribed in
Resend. A check that runs out of time keeps its place
(`resend:reconcile:after`) and the next carries on. Then the welcome emails
(`runDue`, until 150 seconds in; a day-0 email Resend turned away at sign-up
waits for this run instead of being lost) and the weekly report (until 250),
and last, with what is left (until 265), `backfill`: first every post that
did not fully land (`resend:retry`, address to what it carried: a purchase
the phone tells Sona once is never lost to a busy Resend, and a later post
for the same address carries it too; purchases first, 50 a day, each tried
on at most 7 days, and a send-only key or a busy account costs none; an
address Resend refuses for good is not owed), then a batch of up
to 150 of the addresses Sona held before (`everyone()`: the ledger, one
address's rows read together, and every clinician account), paced. It never
writes a clinician's account: the leads page's "in the list" and its "In
Resend" count read `resend:synced`. **The older addresses wait until Kit's
leavers have been copied once in full (`resend:kitunsub`), and without
`KIT_API_KEY` they wait for good**: someone who left Kit put back on a list
is the one mistake here that cannot be undone. New emails join Resend from
`/api/lead` either way. **Keep `KIT_API_KEY` in Vercel until the day Kit is
closed** (Travis's task: on that day, run the daily job once by hand with the
founder key, then delete the key). The first segments are made under a short
lock (`resend:listlock`), so two first leads at once make one "Parents".

What reaches Resend's list: the email, a **clinician's own** first name, the
role, where it was given, and, since 5 Oct 2026, whether a parent started Sona
Premium in the iPhone app. Never anything about a child. Travis sees and
emails the list in Resend's dashboard (Audience); broadcasts are his to write
there, with Resend's own unsubscribe link.

**THE WEEKLY PROGRESS REPORT (REPORT1, 15 Oct 2026)** (Travis: "i want the
setup page to say get the weekly progress report"; told that nothing sent
one, he picked "Build the real report" over changing the words alone). Every
Monday a parent who asked for it, and confirmed, gets last week's practice
from Rachel.
- **Who:** only a household whose setup email step was given an address under
  that heading (`profile.weeklyReport: true`, beside `email` on the profile
  of the child set up first). `weeklyEmail` alone (the hand-off box before 13
  Oct, which asked for a "weekly summary", and the 13-15 Oct step, which asked
  for tips) sends nothing: "Progress leaves only with a grown-up's explicit
  consent", and those grown-ups agreed to something else. Settings has no
  switch for them, and no status line or off switch for anyone: Travis's
  call. Skip sets neither. A brother or sister set up later on the same phone
  is in the report too (the address is the household's). Removing the child
  whose profile holds the address stops the report.
- **Nothing is kept or sent until the address says yes** (the review, 15 Oct
  2026: a mistyped address would have sent a stranger a child's sounds every
  week, and anyone can post). The first post from a phone (setup sends one as
  it ends) emails "Confirm your weekly progress report" with a button; the
  link opens a page whose button POSTs (a mail scanner's GET confirms
  nothing) and marks that phone confirmed in `report:dev:<keyed hash of the
  mailbox>` (device ids, no address; 120 days from the last post). Asking is
  limited, each limit taken atomically before the send and given back if
  Resend refuses: once a week a phone (a stranger's post cannot take a
  phone's own link, though five of them can use up the mailbox's), five links
  a mailbox in a fixed 180-day window from the first, 300 a day in all; a
  step the store did not answer gives nothing back. A phone nobody confirms
  stops asking after eight weeks and only checks once a month, quietly (no
  numbers; the server never sends a link for a quiet check), so a mistyped
  address hears at most five times a window and a late tap still starts the
  report. A second phone confirms
  itself the same way. A confirm link for an address that has since
  unsubscribed says so. **One list:** unsubscribing from Rachel's tips stops
  the report too (and vice versa); `/api/email/unsub` now also keeps the plain
  mailbox, so every Gmail spelling of that inbox stops.
- **The phone (block REPORT1 in `sona.js`, `Sona.reportSync`,
  `Sona.reportEmail`)** posts `/api/report` as setup ends, then from
  `_goalCheck` (a rep, on a practice or game page, after the day's goal
  stamp) at most every 30 minutes, and once more when that page goes to the
  background, so Sunday evening's practice is in Monday's email. A failed post
  is tried again five minutes later; a phone still unconfirmed two weeks on
  checks in once a day, and one still "pending" after eight weeks checks
  quietly once a month ("pending", "off" and "gaveUp" are kept per address,
  so a corrected address starts fresh). A confirmed
  phone told "off" stops sending numbers and checks once a month, with no
  child's numbers, whether the address is back; only a plain "ok" ends
  "off", never "pending" (the server keeps such a phone's confirmation fresh
  so it keeps hearing "off"). Home never sends: it writes nothing. The
  body is the address (printable ASCII, at most 120 characters, as the
  unsubscribe link reads it), this phone's random device id and, for this
  week and last (local Mondays), per set-up family child (not a clinician's
  own setup, not one mid-setup, at most 8): a random child id
  (`profile.reportId`, travels in a backup, so a moved child is still one
  child), days with a rep, days at the daily goal, the plan's days a week
  (only when a grown-up picked them, `profile.weeklyGoal`: setup stopped
  asking on 22 Oct 2026 and writes none, and the default 4 is never sent),
  reps, practice tries among them, and the sounds those reps were in. Never a
  name, an age, a word, a pass rate or a voice. `sona.report.v1` (device id,
  last send, `off`/`offAt`, `pend`/`pendFor`, `gaveUp`) is on `NO_EXPORT` and
  `NO_IMPORT`: a restored phone is a second device.
- **The server (`lib/report.ts`, `app/api/report/route.ts`,
  `app/api/report/confirm/route.ts`)** takes it same-origin only, 4 KB, 40 an
  hour per IP (an IPv6 /64 as one), builds what it keeps field by field
  (numbers clamped, unknown sounds dropped), and keeps a confirmed phone's
  numbers in `report:wk:<monday>` ("<email> <device>" to the numbers) until
  three weeks after that Monday (a fixed end). An unconfirmed phone gets
  "pending", also when its address unsubscribed, so the route says nothing
  about anyone; a confirmed phone of an address in `email:unsub` (exact, or
  its Gmail-dot/+tag mailbox) is told "off" and stops. The daily
  `/api/cron/nurture` runs `runReports` after the welcome series: Monday
  (Tuesday and Wednesday catch up) emails last week, once an address a week
  (`report:sent:<monday>:<email>`, released if Resend refuses), with a 550 ms
  pause before each send (the first too: the welcome series has just sent), a
  429 tried once more after a longer pause and then the run stopped, stopping
  too 250 seconds into the run, at most 250 a run. A week
  with no reps sends nothing. Two phones, one address: one email, a child
  (by its id) once with the fuller count, two quiet brothers still two, at
  most three devices. A founder's manual run with `?report=1` sends on any
  day.
- **The email** says "Child 1", "Child 2" (never a name), the week ("Oct 12
  to Oct 18"), "Said their sound out loud on N days" (not "practiced": the
  days count game and book words too, and Progress's "practiced" counts the
  practice page alone), "Reached the daily goal on N days (your plan: 5 days
  a week)" (no "(your plan: …)" for a child with no picked plan), reps split
  "in practice" and "in games and books", the sounds, a kind line ("That's
  the plan you set" only when every child has a picked plan and kept it), what a
  rep is, "A practice snapshot from your phone, not an evaluation." and
  "Rachel, MS, CF-SLP / Sona co-founder". No pass rate, no clinical words, no
  emoji, no prices (`reporttest`). **Its words, and the confirm email's, are
  Rachel's to change**, as is whether a week with no practice should send a
  gentle note (today it sends nothing).
- **For Rachel, also:** a parent who answers "Not right now" to "Is <Name> in
  speech therapy?" no longer reads "It does not replace a speech therapist."
  on the ready screen (Travis, 15 Oct 2026). Whether a family with no
  therapist should be told Sona is not a substitute is her clinical call.
- The privacy page has its own section ("The weekly progress report (only if
  a grown-up asks for it)"), and the parents' "What's stored" answer names it.
  **For Travis:** App Store Connect's App Privacy answers should now list
  usage data linked to the parent's email (no review needed). The old Friday
  email (`/api/cron/weekly`, to the retired `trials` list) is separate and
  untouched.
`reporttest` plays the phone and the server.

**SESSION RECORDING (REPLAY1, 15 Oct 2026)** (Travis, of PostHog's replay
page: "how do i start recording", then yes to recording only the grown-up
screens with names and typing blanked out). PostHog session replay runs on
four screens of **speaksona.com itself** (a preview build or a test server
never records): the home page and /try (in a browser; in the app they
redirect home), **parent setup** up to the hand-off (never a clinician's own
setup, `?slp=`), and **the plan screen's offer when a grown-up opened it**
(`?setup=1`, `?first=1`; never a child's tap on a locked game `?from=`,
never Home's own offer, never Settings › Your plan). It needs "Record user
sessions" on in PostHog too.
- **Off unless switched on.** `analytics.js` inits with
  `disable_session_recording: true` everywhere; only
  `SonaAnalytics.replay(true)` on one of those pages turns it on. Setup's
  `replayAt(key, painted)` turns it off BEFORE the therapy question, the
  ready screen (`NO_REPLAY`) or the hand-off is painted and on again only
  once a screen without them is up, so a tap on Yes / Not right now is never
  recorded (the ready card's size alone would tell the answer). **The
  screen a therapy answer lands on is not recorded either** (`replayHold`;
  since 22 Oct 2026 that is the sounds): a double tap's second tap, or a
  mouse moving on, would be recorded at the answer's place; recording comes
  back one screen later ("How long each day?"), reached by the fixed
  footer. **A child already set up walking setup again** (`REWALK`:
  Back from the first game, a second visit) is never recorded, and **the
  hand-off ends recording for the whole tab** (`sona.replayoff.v1` in
  sessionStorage, which `SonaAnalytics.replay` reads). The plan screen
  calls `replay(true)` once the offer is painted.
- **The name: masked where it is shown, and a backstop that drops.** Every
  spot a recorded page shows the child's name is an element of class
  `ph-name` (`#micName`, `#achName`, `#intName`, `#emName`, `#gamesName`,
  the plan screen's headline span), recorded as "[child]" whatever it holds
  (`maskTextSelector: ".ph-name"`). Before a piece of recording is sent,
  `before_send` checks the words a person reads in it (text, and the
  attributes in `READ_ATTR`; never tag names, classes, styles or
  stylesheets) for every child's name (as a whole word) and grown-up email
  this phone knows (profiles, the kids list, setup's draft), and a piece
  that holds one is **not sent at all**. Never word swapping: taking "Will"
  out of "Echo will listen", or "max" out of "max-width", reads the name
  straight back (the review of 15 Oct 2026 caught exactly that). Only
  `$snapshot` is checked: ordinary events go out exactly as PostHog wrote
  them. A name that is also a word on the page ("Echo", "Rachel", "Will")
  costs that family its recordings, never its privacy.
- **Blocked whole (`ph-no-capture`):** setup's therapy, ready, clinician and
  clinician-email steps and its build overlay; the plan screen's practice
  line (`#offerPill`) and recap card. Every box (`input, textarea, select,
  [contenteditable]`) is blocked: an empty shape, no value, no keystrokes.
- **The recorder is ours, pinned.** On speaksona.com, `analytics.js` loads
  posthog-js from `public/vendor/posthog/static/<PH_VERSION>/` (array.js and
  lazy-recorder.js, 1.438.12) with `asset_host` pointing there, so what
  records a family is exactly the build `replaytest` plays, and no other
  PostHog extension (surveys, toolbar, logs) can load. Upgrading PostHog is
  a reviewed change: replace both files, bump `PH_VERSION`, run `replaytest`.
  Off speaksona.com it is PostHog's own latest copy, and nothing records.
- **Nothing else rides along:** no console, network, canvas, heatmaps, dead
  clicks, exceptions, surveys or web vitals (forced off in the client
  config, which PostHog's project settings cannot loosen); the page address
  keeps only `setup`/`first`/`from`.
- **The hard rule still holds:** a child's name never reaches PostHog.
  `replaytest` plays the real recorder against a fake PostHog whose project
  settings are as loose as they go, and fails on a name (also one that is a
  word on the page, or inside one), an address, anything typed, a pointer on
  the therapy, ready or hand-off screens or a double-tapped answer, a
  recording after the hand-off or anywhere else, or a touched ordinary
  event. **For Travis:** the privacy page and the parents'
  "What's stored" answer say so; App Store Connect's App Privacy answers owe
  a line (NATIVE.md). What a recording may show of a child (the age group,
  what they love, the sounds and the minutes a day picked in setup) is
  Rachel's to know.

Leads from inside the app (`app-setup`, `app-trial`, `app-paid`:
`IN_APP_SOURCES` in `lib/nurture.ts`) skip the welcome series' first email
("Here's Sona", the App Store link) and start at "The 5-minute trick"; days 1,
3 and 5 are unchanged (`nurturetest`). **The series is day 0 (two emails),
day 1, day 3 and day 5** (Travis, 17 Oct 2026: "just move day two to day
one"); someone already waiting for the old day-2 email keeps that day. **A parent whose phone reports a
purchase leaves the series** (`stopSeries`, 16 Oct 2026): the plan post takes
the rest off the schedule, so days 3 and 5 no longer sell free days they
started; a purchase the phone never reports (no email on it) still gets them.
A known gap, for Travis: `parents.html` uses an ad's `utm_source` as the
source, so an ad tagged `utm_source=app-setup` would skip the download email
too.

**The plan** (Travis, 5 Oct 2026: "yeah build it", to "when a family with
an email starts their free days, the app tells our server, and the server tags
them"; in Kit until 16 Oct 2026, in Resend since). Apple never tells Sona who bought, so the phone says it: once
`Sona.buyPlan()` has gone through (never a restore, a cancel or a failure), it
posts the household's parent email (`parentEmail()`: setup's optional email
step, which since 13 Oct 2026 comes before the price, so a new family's
address is on the phone before they buy; on any child's profile) to
`/api/lead` with `plan: "trial"`
(Apple's entitlement says TRIAL, or, when Apple's answer says nothing, the card
sold free days) or `"paid"`. The route keeps those two words, and only those
(`planWord` in `lib/contacts.ts`): the contact's `plan` property and the
Started Premium segment, and the welcome series stops; the ledger keeps the
plan too. Once per kind and address on that phone (`sona.plantold.v1`); no
email, nothing sent; nobody is asked for one at that moment. The privacy page
says the email list holds this. The note before the free days end
is RevenueCat's (RCHOOK1, below), not a broadcast; the app's
own words promise only the phone's own reminder, in one line and only where
it is set (NOTIFY1; see "TRIAL FIRST"). Not built: App Store Connect's App Privacy answers, which should now list purchases
linked to the parent's email (Travis's task, no review). `planwordstest` plays
the phone side ("the list hears"), `slpapi` the route and `contactstest` the
list. Wherever an email joins the list, the page says
so first, in Travis's words: "We'll also send occasional tips from Rachel.
Unsubscribe anytime." **Except the landing pages**, where Travis took the line
out (25 Sep 2026: "get rid of this text"); their "What's stored" answers
still say the email is on the list at Resend. Meta's `Lead` fires only when an email was given.

**REVENUECAT TELLS SONA (RCHOOK1, 16 Oct 2026)** (Travis: "build the revcat
webhook"; then, asked: show the parent's email in RevenueCat, stop the sales
emails for buyers, a note before the free days end, and "we miss you too"). Apple never tells an app who bought; RevenueCat does know when
a purchase starts, renews, is cancelled or ends.
- **The phone hands RevenueCat the parent's email** (`_rcEmail` in sona.js,
  once the store is set up on a page: `setEmail` with `parentEmail()`).
  RevenueCat's dashboard then shows the parent instead of ANONYMOUS, and
  every message it sends carries the email (`subscriber_attributes.$email`).
  That address only, never a child's name; nothing when no email was given
  (that family stays anonymous and gets none of this). Optional like every
  new native call: missing, throwing or refusing changes nothing, and nothing
  waits on it (`planwordstest` "RevenueCat hears the email").
- **The webhook** (`/api/revenuecat`, `lib/revenuecat.ts`): RevenueCat's own
  `Authorization` header (`REVENUECAT_WEBHOOK_AUTH`, 16+ characters, `_PREV`
  for a change; constant-time), 64 KB, JSON. A TEST, a type Sona has no use
  for, Apple's sandbox (unless `REVENUECAT_SANDBOX=1`) and a message with no
  email: 200, nothing kept. Otherwise once per message id (`rc:evt:<id>`, 14
  days, written LAST: every write before it is safe to repeat, so a
  delivery cut off part-way leaves no mark and RevenueCat's retry redoes
  it): the state in `rc:plans` (email to {s, exp, ts, at}: trial, paid,
  cancelled, billing, ended, moved; an older message never overwrites a
  newer one, one Lua step), `stopSeries` (the welcome series stops, as the
  phone's plan post already does; its mark now has no time limit, and
  `enroll` reads it, so a family who gives their email again years later
  gets day 0's tip alone, never "Here's Sona" selling free days Apple will
  not give twice), a new year for `nurture:0:<email>` (EXPIRE, which never creates it), the
  RevenueCat customer each address came with (`rc:uid:<id>`, 400 days), and
  the two queues. Never the price, the country or a transaction id.
  **TRANSFER** (the subscription moved to another device's customer, which
  may have no email) carries no email: the customers it left are looked up
  in `rc:uid:`, each address found is marked "moved" and loses its queued
  reminder, so a parent who then cancels on the iPad is never told "your
  plan carries on". Its time is also kept against the customers it left
  (`rc:moved:<id>`, 400 days, the latest only): a purchase message from
  before the move that arrives after it (a retry) records the address as
  "moved", never on its free days. Set-up steps for Travis: NATIVE.md
  (the webhook URL is `https://www.speaksona.com/api/revenuecat`: the bare
  domain answers a 308 that RevenueCat does not follow).
- **What it sends** (Resend, from Rachel; her words to change, `MAILS`):
  "Your free days end soon" (`rc:remind`, 50 hours before the free days end;
  the daily run at 16:00 UTC, which Vercel may start up to an hour late,
  sends it only while the plan is still on its free days and more than 24
  hours remain, Apple's line for a cancel to count, so 24 to 50 hours
  ahead, once per end; that 26-hour window always holds one run, which sends
  these notes right after the unsubscribe check and before the welcome
  emails, with its start time as "now", and a send Resend
  turns away for a moment is tried twice more in it; a note leaves its queue
  only once it is settled, and only if nobody queued it again meanwhile, so a
  store that stops answering part-way never loses one), and "We miss you at Sona"
  (`rc:miss`, a day after a plan ends, only if still ended, once a year an
  address). Only to an address that joined Sona's list (`nurture:0:<email>`)
  and is not in `email:unsub` (exact or plain mailbox): RevenueCat's
  attributes can be set by anyone holding the app's public key, so an email
  there proves nothing. No price, no number of free days (both the App
  Store's), no child. The price screen never promises this email; its one
  reminder line is the phone's own notification (NOTIFY1), shown only where
  that is set.
- **/leads.html** shows a Premium column and counts (free days, paying,
  cancelled, payment problem, ended, moved to another device), from
  `rc:plans`.
- **Not done here:** RevenueCat's word does not put anyone in Resend's
  Started Premium segment (the phone's plan post still does that), so a
  broadcast to that segment misses a buyer whose phone never reported.
- **Defaults Travis did not pick:** a cancelled-then-ended trial also gets
  "We miss you"; no email for a payment problem (he did not pick it); the
  welcome series stops for good once a family started Premium, even after
  it ends. **For Rachel:** both emails' words. **For Travis:** NATIVE.md's three
  set-up steps, and the App Privacy line (the email now also goes to
  RevenueCat).
`rcwebhooktest` plays the route, the store, both emails and the words.

**THE TRIAL REMINDER (NOTIFY1, 22 Oct 2026, iOS 1.0.9)** (Travis: "can we
add push notifications and have that be a step in the onboarding where we
ask them to turn it on to notify them a day before their trial ends"). One
notification on the parent's phone the day before the free trial ends
(about 30 hours before, so cancelling then still counts: Apple's line is 24
hours): "Sona" / "Your free trial ends tomorrow." It is LOCAL, not a push: the phone
sets it and shows it, so it reaches a family who gave no email too, and
nothing leaves the phone for it. (The price screen's one line about it is in
the pricing section: "THE TRIAL REMINDER ON THE PRICE SCREEN".)
- **Native:** Sona's own plugin (SonaSpeech) gained `notifyStatus`,
  `notifyAsk` (iOS's own Allow box: alerts and a sound, no badge),
  `notifySchedule({ id, at, title, body })` (one calendar trigger that never
  repeats; the same id replaces the one waiting; past or 400+ days away
  refused) and `notifyCancel({ id })`, with UNUserNotificationCenter. No
  device token, no APNs, no Push capability, no Info.plist text:
  `scripts/install-ios-speech.py` carries it like the mic. It answers
  Capacitor's `localNotificationHandler` so a "sona-" notification also shows
  while Sona is open (it comes 30 hours before the trial ends, six hours
  before the time of day it started, often when the family plays), **as a banner and in the list, WITHOUT its sound**
  (review, 22 Oct 2026): a game's mic may be open, and iOS's chime through
  the speaker would play into Sona's own mic, against "nothing plays while
  the mic listens". With Sona closed it keeps its sound. Optional: a build
  without the four methods (1.0.8 and before) offers no reminder anywhere.
  `heartest` pins the Swift.
- **sona.js, block NOTIFY1:** `Sona.notifyAvailable()` (all four methods
  there, and none of them answered "not implemented" on this page: a
  Capacitor proxy in front of an older build answers every name, so that
  answer marks the plugin broken for the page, as the mic's `_nm.broken`
  does), `notifyState()` ("granted" / "denied" / "prompt" / "unavailable",
  iOS's last answer, read again as each app page opens; "provisional" reads
  "prompt"; on a page iOS has not answered yet it is a guess, "prompt"),
  **`notifyRefresh()`** (a Promise of the state once iOS has really
  answered, 3 s at most: setup waits on it before it decides whether to show
  its reminder screen, so a phone iOS already asked never sees it),
  `notifyAsk()` (never rejects; a bridge that never answers lets the screen
  go on after a minute, its late answer still kept), `trialReminderOn(plan?)`
  (allowed on a build that can; with a price row, also a free trial the
  store is sure of, `plan.sure === true`, whose reminder moment is more than
  an hour away), `trialReminderArm(endMs)` (id `sona-trial-end` at end −
  30 h, `TRIAL_REMIND_LEAD_MS`, only when that is more than an hour away:
  Apple's cancel line is end − 24 h, so the reminder leaves six hours to act),
  `trialReminderSync(force)` and **`trialReminderSold(plan)`** (the
  purchase step for a sale `buyPlan`'s answer did not carry: an Ask to Buy
  approved later, or Restore after "not-entitled". `subscribe.html` calls it,
  feature-checked, before it leaves: counted, the day's mark cleared, armed
  from the plan only for a sure free row, else RevenueCat asked).
- **When it is set: at once, from the purchase** (one hook on `buyPlan`'s
  success path, after `_tellPlan`): the price page leaves 1.2 s after a
  sale, and RevenueCat's record can take 8 s, so a reminder that waited for
  it could be lost with the page. A purchase that started a free trial
  (Apple's period TRIAL, or, when Apple's answer names no period, a card SURE
  it sold free days: the list's plan post decides "trial" on the card alone,
  but this states it as fact) is set for the end in the purchase's own
  record (`iapPurchase` returns it, `end`), else the store's own free time
  from now; only when the purchase named no end is RevenueCat asked, once,
  to correct it. Never waited on. **Every purchase also clears the day's
  check mark and counts one**, so the next page asks the store again and no
  check still waiting from before the sale (the price page's own, which
  heard "no Premium") can take the new reminder back ("stale").
- **And checked once a day** on an app page (and when the app comes back to
  the front), **never on Home** (Home only reads: it neither asks iOS nor
  the store for this, and writes nothing of it): RevenueCat's `full`
  entitlement on TRIAL with an end sets it afresh; a paid period, no
  Premium, or a trial the parent already cancelled (`willRenew` false) takes
  it back; a store that does not answer changes nothing and is asked again
  an hour later at the soonest, not on every page; a family who did not
  allow notifications is not looked up at all. A reminder already set for
  (within an hour of) the end stays to be shown in its last day; one set for
  an end that moved goes.
- **Never a child's name, never a price, never an event or a request:** the
  words are one fixed pair, and `notifytest` holds the block to no fetch, no
  track, no profile. `sona.notify.v1` (`state`, `asked`, `arm`, `end`,
  `sync`, `tried`) is this phone's, on `NO_EXPORT` and `NO_IMPORT`.
- **Setup's reminder screen and the price screen's one line** ("We'll remind
  you the day before it ends.") read this block: the screen shows only when
  `notifyAvailable()`, `notifyState() === "prompt"` (after
  `notifyRefresh()`) and the price follows; the line only when
  `trialReminderOn(picked row)`.
- **Defaults Travis did not pick:** the words; the time of day (30 hours
  before the end, six hours before the trial's own time of day, so a cancel
  then still counts; the line and the notification still say "the day
  before" and "tomorrow"); shown over the app when it is open (silently), where a
  child mid-game may see it; taken back when the parent cancelled the trial
  (as RCHOOK1's "Your free days end soon" email is not sent then); the
  minute setup waits on an Allow box that never answers; a store that does
  not answer asked again after an hour. **Travis's to know:** a parent with
  an email may now hear twice before the free days end (this, and RCHOOK1's
  email). Nothing here is Rachel's: the reminder says nothing about a child
  or practice. `notifytest` plays it on a fake phone; NATIVE.md and
  SPEECH_PLUGIN.md hold the Mac steps and the phone checklist for 1.0.9.

`/leads.html` (private, behind `FOUNDER_KEY`) lists every captured email and
every clinician account, counts everyone since the "I'm a…" landing page
(25 Sep 2026) by what they chose, and says what the list answered for each
(a lead saved before 16 Oct 2026 shows Kit's answer), and each parent's
Premium in the app as RevenueCat last told it (RCHOOK1). It has no button: the
list fills itself, and the old "Send everyone to Kit" catch-up
(`/api/founders/kit-sync`) is gone with Kit.

## Daily story (STORY1): Home's big card
**Home leads with today's story** (22 Oct 2026; Travis chose both age
groups, today's painted clay look, and that the story is Premium). A story
day is one to two minutes of painted pictures Echo reads aloud, a new game
that fixes the story's problem, then a short happy ending and a sticker:
Pelly's letter (Pelly the pelican always pulls the wrong thing out of her
beak pouch first: a fish, a rubber duck, a banana; never "Penny", who is
the penguin of *Penny's Pebble Party*) → the problem → "Let's
go!" → the game → "See what happens!" → the ending → the sticker → a gold
star on Echo's helper map. Fourteen days are built, one a day, in order:
- **Day 1, "The Lighthouse Sneeze":** Captain Wally the walrus sneezes the
  lamp out; the child is the light and finds seven lost boats in the fog
  (**Light the Way**, key `lighthouse`).
- **Day 2, "Grandpa Bear's Sleepy Toys":** the toys partied all night and ran
  out of wind; the child winds each one just right for the Toy Parade
  (**Wind-Up Toys**, key `windup`).
- **Day 3, "The Puzzle Bridge":** the storm broke the bridge to Blossom
  Island; the child fits the stones back for Grandma Tortoise's 100th
  birthday (**Puzzle Bridge**, key `bridge`).
- **Days 4-14 (22 Oct 2026), each around one of Codex's physical games**
  (Travis: "connect these adventures to the shared daily player and Days
  1-3"; then, of Codex's painted art, "this is way too ai", and he chose
  new story pictures in this clay look, with Echo, the games' own pictures
  kept): Day 4 "The Thirsty Waterwheel Garden" (`waterwheel`), 5 "The Little
  Island Postboat" (`postboat`), 6 "Breakfast at the Moonberry Bakery"
  (`bakery`), 7 "Tortoise's New Front Door" (`frontdoor`), 8 "The Glowworm
  Lantern Walk" (`lantern`), 9 "All Aboard for Snowdrop Valley"
  (`trainline`), 10 "The Hilltop Patchwork Kite" (`kite`), 11 "The Sandstone
  Nest Lift" (`nestlift`), 12 "The Lily-Pad Concert" (`concert`), 13 "Seeds
  Across the Rooftops" (`rooftops`), 14 "The Moving-Star Observatory"
  (`observatory`). See "Days 4-14: Codex's games in the story" below.

Each has a version for ages 3-4 (`Sona.playStyle() === "simple"`: the scenes
marked for both ages, the short lines, a six-word game on Days 1-3, five words
on Days 4-14) and one for 5-8 (eight scenes, four ending scenes, an eight-word
game; Days 1-3's has a twist at word 5, Days 4-14's no fixed one). The buddy a
child picked is in Days 1-3's games (Codex's eleven place none) and in 121 of
the 168 pictures (the others, a view out of a window, a letter, a chart, a
crowd's back, have no spot for it), laid over the painting in a pose that
already exists, never painted in and never under a finger.
- **Files.** (Days 4-14's own are under "Days 4-14: Codex's games in the
  story" below.) The day list is ONE copy in `sona.js`, `STORY_DAYS` (inside the
  QUEST1 block): id, game, page, hero, Home's title and line. (The same tag,
  STORY1, also marks the older episode engine: `sona.js`'s "the daily run is
  an EPISODE" block, `storytest` and the parked `story.html`; they are not
  this.) The scenes are
  `public/adventures.js` (`window.SonaAdventures`, loaded by the player
  alone). The player is `public/adventure.html` with
  `public/crafted-adventure.css`. Each game is a Say & Play game on the play
  hook: `public/<key>.js`, `public/<key>.css`, a hand-written
  `public/arcade-<key>.html`. Pictures: `public/assets/adventure/<id>/
  s01-s08.webp, e01-e04.webp` (800×1200), `public/assets/crafted/game/
  <key>-*.webp`, Home's `home-<hero>.webp` and the Arcade door's
  `home-arcade.webp`; made by `tools/art/gen-adventure.mjs` and
  `cut-adventure.py` from `adventure-prompts.json`. Every number a game or
  the player reads off a picture is in `design/adventure/art-notes.md`, and
  `design/adventure/review.html` shows every page with its line for Travis
  and Rachel. **Adding a story:** its line in `STORY_DAYS`, its scenes in
  `adventures.js` with the same buddy boxes in art-notes section 2
  (`adventuretest` holds them equal), its card colour in `crafted-home.css`
  (`homestorytest`), its game and pictures, and for a game on
  `story-game.html` its words in `daily-adventures/pages.js`; every child
  who finished the others meets it the next day.
- **THE STORY IS PREMIUM, BY THE BOOKS' RULE** (`Sona.storyOpen()`: Sona
  free, Premium from any source, or a trial; never the three-day
  demonstration window `gated()` honours; in the founders' preview, its
  "trial" plan). Where Sona can sell (`offerOnLock()`), a family without it
  still SEES the story (`storyShown()`) with a small "Premium" tag, and a tap
  opens the price at once, as a grey game's does: `/subscribe.html?from=
  adventure` ("Unlock today's story, and every game", today's story picture
  with Echo, no grown-ups check, never recorded, the X back Home; with every
  story finished, the plain offer). That includes a family who keeps the free
  version on a phone that can buy. **A phone that cannot buy, without
  Premium, never sees a locked story:** its card is the old game of the day
  (QUEST1), which borrows a game it can open. A wall nobody can pass is a
  broken app. Entitlement is read again on every page, never from an
  address: `gameAccess("adventure")` and `gameAccess` of any
  `STORY_DAYS` game (`lighthouse`, `windup`, `bridge`, `waterwheel`…) answer
  `storyOpen()` (tier `premium`), the engine's own check sends a
  locked story game to `/today.html` (`gameBounce`) before any mic or sound,
  and the player checks before any picture, sound or fetch.
- **One scheduler, QUEST1's.** `sona.quest.v1` (per child, in backups) keeps
  `i`, `last` and `done` and gains `s` (stories finished), `ls` (the last
  one), `lk` ("story" or "game"), `got` (the stickers its finish gave) and
  `seen` ("<date>|<id>": today's intro reached "Let's go!"). Every save
  MERGES (a game day's write used to replace the record, and would wipe `s`).
  `questToday()` answers `kind: "story"` while a story is left and
  `storyShown()`, else the game of the day (`kind: "game"`). **Every child
  starts at Day 1**, new or partway through the 14 days, and goes back to
  the day they were on after the last story: a story never moves `i`.
  Still one item a calendar day: a game day finished today keeps the story
  for tomorrow, and a missed day loses nothing.
- **The day is finished when the game's round ends** (the engine's end card,
  `questEnd(<key>)`), so the sticker is given before the ending is watched
  and closing the app in between loses nothing: ONE sticker
  (`awardNextSticker`), no coins, no banner (the ending's sticker card shows
  it, read from `storyEnding(id).got`), the event "adventure day done"
  `{ game }`. `storyEnding(id).ok` opens an ending only once that story is
  finished.
- **The game hands back to the story** (`sayplay.js`, `G.exit` and
  `G.again`): its end card's one teal button is "See what happens!" to
  `/adventure.html?part=end&story=<id>` (only an address of exactly that
  shape is taken), with no Play again. The ✕ during play still goes Home.
- **The player** (`adventure.html`). On the website it opens on a card (the
  story's picture, "Day N", its title, a teal "Tap to start"), because a page
  plays nothing until a tap; in the iPhone app the intro starts at once. Seen
  today: a teal "Keep going" (straight to the game) and a cream "Watch the
  story again". Each scene: the picture whole, a caption card over its foot
  (Echo, the line, a cream "Hear it", a teal Next). Echo starts the line as
  soon as it is ready and waits at most 2.5 s; Next glows when he is done;
  Next or a tap on the picture turns the page; taps wait 600 ms after a
  scene appears, so a double tap never skips one; nothing turns by itself.
  The right-arrow key turns a page too, but never leaves the last intro scene
  (only "Let's go!" does), so it cannot cut Echo off there.
  The last intro scene's big teal "Let's go!" stops the sound, writes
  `storySeen(id)` (the ONE thing the page writes) and opens the game. The
  ending opens on "Tap to see what happens", plays its scenes, then the
  sticker card ("You got 🐚 Shell!", one reward chime, no confetti under
  Reduce Motion) and "Back home". A cream Skip, top right, is for grown-ups
  and not behind the grown-ups check, as the books' is: to "Let's go!" in the
  intro, to the sticker card in the ending. Its events, "adventure opened"
  and "adventure ending watched", carry `{ game }` alone.
- **Echo's voice, one line at a time:** a recorded file when
  `/assets/adventure/voice/manifest.js` lists exactly that line (the file is
  named by FNV-1a of `TTS_CACHE_VERSION + "|" + line`, so a re-worded line has
  no file), else the live voice through the phone's shared cache
  (`SayIt.line`, `arcade-sayit.js`), else the browser's own voice, cut at
  9 s; in the app every one plays as media. **No line is recorded yet** (no
  manifest): every line plays in the live voice. `shiptest` checks a
  manifest when there is one. Sound off (a volume of 0): captions only,
  nothing fetched, Next live at once. Going to the background stops the line;
  coming back plays nothing until a tap.
- **Every story line keeps the rules** (`adventuretest`, and voicedoc's B9
  lists all 260): 120 characters at most, plain punctuation, no child's name,
  no speech sound named, nothing about how to talk (never louder, slowly,
  strong, stretch, "say it"), none of score, points, correct, wrong, miss,
  fail, charge, and the same line on every phone. **No story scene asks the
  child to speak:** that happens only in the game's word turn. "Ah-choo!",
  "Honk-shoo" and "Whoosh!" are story words, never targets.
- **The buddy's spot** on each picture is a box in `adventures.js`, copied
  from `design/adventure/art-notes.md` section 2; `adventuretest` holds the
  two equal, so a redrawn page's new box changes both. The player keeps it
  clear of the caption card, Echo's face and every button, and leaves it out
  where that would lift it more than half its height (on a 320×568 phone,
  Day 3's s04). The fox, every new family's buddy, has a peek drawn for the
  stories' thirteen peek spots (`buddy-fox-peek.webp`); Fruit Slice never asks
  for it, so a fox child's market is unchanged.
- **What a story day earns:** the scenes nothing; the game one game rep for
  each saying Echo hears (16 for ages 5-8, 12 for 3-4 on Days 1-3 and 10 on
  Days 4-14, two more for each help pill), toward the daily goal and trophies like every game, never practice
  data; the day one sticker.
- **Not in the catalog, on purpose.** The story games are not in `GAME_ACTS`
  or `ACTIVITY_KEYS` (`Sona.gameKey("lighthouse") === ""`): on no shelf, in
  no picks row, in no setup grid, in no website game count, with no level
  and no Best. A finished story is not on Home again (its ending still opens
  by address), but **its game is** (FOUND1, below): Home's "Your games" row
  plays it again.
- **Departures from the spec, kept:** the player does not load `saycheck.js`
  (`SayCheck.say` cannot say when a line starts, which the 2.5 s rule needs,
  so the page plays `SayIt.line`'s bytes itself); Day 3's e02 is ages 5-8
  only; Skip lands on the "Let's go!" scene and plays its line; a tap on the
  last intro picture does nothing (only "Let's go!" starts the game); Day 1's
  s01 has the buddy left of Echo; Day 1's e01 is the game's own seven boats
  on an empty harbor, and Day 2's s07 is cut to the chart alone. Six pages
  were touched up after drawing (art-notes lists them): the parade's
  crocodile and jack-in-the-box laid in from their cast drawings, the helper
  map's stars moved onto the places helped, and the bridge painted out behind
  Day 3's first two pages (the storm broke it the night before).

**Light the Way** (Day 1, `lighthouse.js`, `LIGHTHOUSE1`). A night sea under
a soft veil; the word, said two times, lights the lamp; the finger moves a
pool of light (drawn 56 px above a fingertip, or 0.8 of its radius if that is
less, so the finger never covers it; on a mouse pointer) and HOLDS it on the
lost boat: the boat's lantern blazes, it toots and chugs home. Ages 5-8:
tugboat, rowboat, sailboat (a barrel decoy), banana boat (a sleepy whale),
the teacup boat behind the cove rocks as a cloud covers the moon (the twist),
bathtub (a rubber duck), the ferry behind fog banks (a buoy), then a sweep
over the town lights twelve windows. Ages 3-4: five boats on a still, lighter
sea with no decoys and a big pool, then six windows. A decoy lit is a funny
reaction, a kind banner and one rung on the help ladder, nothing else. The
ladder climbs with seconds of the finger SEARCHING (4, 8, 12; ages 3-4: 2, 4,
6) or decoys lit (1, 2, 3), never with waiting, and at its top nearly any
sweep finds the boat; nothing is ever found without a finger. Help pill:
"Bright beam" (the pool doubles and the fog clears for 10 s). End card:
"Every boat is home!" / "You lit the way through the fog." The lit windows
are cut from `lighthouse-town-lit.webp`, identical to the sea outside them,
and `lighthousetest`'s art part reads the pictures' own pixels.

**Wind-Up Toys** (Day 2, `windup.js`, `WINDUP1`). The word pops the next
toy's key out; the finger draws circles round the brass dial, either way
(the winding is the angle swept round its centre, so a scribble does not
wind), and LETS GO at the star on the spring meter: under 30% is no try; too
little, the toy yawns and sits ("A little more winding!"); in the star it
wakes with its trick and marches to the parade line; too much, a dizzy spin
and the needle drops just under the star. Ages 5-8: bunny, frog, top,
crocodile, then the cuckoo pops (the twist) and the top shelf's elephant,
jack-in-the-box and hippo need more turns and a narrower star, then the
giant music box's crank (about four circles, no star). Ages 3-4: no star and
nothing to overdo; the meter only fills, and the toy wakes when it rings.
Two ladders climb side by side: misses (a wider star, then the key catches in
it, then any let-go past 30% wakes the toy) and seconds without a quarter
turn (arrows and a moving dot, then rubbing winds, then any drag winds).
Help pill: "Oil can" (every circle counts double and the star is wide for
10 s). One finger owns the dial: a circling finger keeps it, but a touch that
has not moved for 0.3 s gives way to a new one, with no try (a resting thumb
used to own it for as long as it stayed down), and the dial losing focus
drops an arrow-key hold. End card: "The parade is on!" / "You woke up every toy."

**Puzzle Bridge** (Day 3, `bridge.js`, `BRIDGE1`). The bridge is drawn by
the canvas, one sandstone body from the near bank to Blossom Island on
`bridge-canyon-wide.webp`, so a stone always fits its own hole. The word
calls a stone up out of the river, turned the wrong way; a tap (under 12 px
and 300 ms) turns it a quarter turn, anything else slides it, and a round
turn button does the same. The finger holding the stone keeps it: a second
finger or a palm is ignored until it lets go (it used to take the stone's
finger and leave the stone held for good, so the round could never end). On its hole the right way up it drops in and
glows; the wrong way up it bobs back ("Almost! Give it a turn."), a miss; a
drop anywhere else is not a miss. Ages 5-8: L, T, boot, arrow, step, hook,
half-moon, then the heart keystone at the top; from word 5 the river rises
and each stone swims a slow loop in the water. The camera follows the gap (a
hole at least 30% of the board's width) and pulls back to the whole bridge
for the finale. Ages 3-4: circle, square, triangle, star, moon, heart, the
right way round, two holes open at a time, a bounce back from the wrong one.
Ladder: misses or seconds of trying (a ghost of the stone in the hole, then
the hole glows and an arrow says which way and how many taps, then a drop
near the hole turns it into place). Help pill: "Calm river" (the river goes
glassy, the stone still, the ghost shows, 10 s). End card: "The bridge is
whole again!" / "Every stone is back where it belongs."

**What the three games keep** (each its own suite, and every Say & Play
rule): the word, said two times, earns each step and the finger makes it;
silence earns nothing; the step counts 1.15 s after the cheer, on a live page
only; the help ladder resets with each word and never finishes a move by
itself; Echo's directions go through `api.instruct` from `STEP_LINES` (ages
5-8) and `LITTLE_LINES` (ages 3-4), with "Hear what to do"; the optional help
pill asks the word again through `api.practice()`, and silence or "Back to
the game" gives the move back with no power; every painted picture has a
drawn stand-in; Reduce Motion cuts or fades; keyboard play works; the game
file never touches storage, reps, coins or stickers; the game's own sounds
are media in the app. Words that fit the story (`GAME_WORDS`: boat, moon,
key, toy, rock…) are asked on words 1, 4 and 7 (1 and 4 for ages 3-4) when
the child's sound has one; homework words win.

**For Rachel** (built on defaults until she answers; the PR body lists every
line a child hears):
- What a story game asks: the child's own sound at the start of a word, said
  on its own, homework first; the story words on words 1, 4 and 7 (the
  `GAME_WORDS` table for `lighthouse`, `windup`, `bridge`; "river" left out on
  purpose).
- Two sayings a word for both ages (16 a day for 5-8, 12 for 3-4; Bubble Pop
  asks the littles once). One line per game page (`sayTimes: 1`) would change
  it.
- The day is light on speaking: 16 sayings (12 for ages 3-4, 10 on Days
  4-14) against a daily goal of 30 (setup's 5 minutes, the default; 60 or
  90 for 10 or 15 minutes); the story pictures ask for nothing.
- The games do not check the age a sound is usually learned: a four-year-old
  whose family picked R gets R words, as in Bubble Pop.
- A child the phone cannot hear cannot finish the day: only a heard voice
  moves the game, and there is no skip to the ending.
- "Heard" means a voice of the right kind, not the right word; nothing here
  is practice data or a grade.
- Day 3's "When they hear a word, up they float!" frames the word as calling
  the stones; every story line, each game's 14 directions and its two
  start-card lines are hers to read.
- What the pictures show a child: a sneeze and a walrus with a cold, toys
  asleep after a party, a bridge broken by a storm.

**For Travis** (defaults he did not pick, to judge on his phone):
- Day 2's finger move (the spec's alternative was cloud-sheep herding).
- A phone that cannot buy gets the game of the day; a family who keeps the
  free version on a phone that can buy sees the story locked.
- After Day 14 the card is the game of the day again, "Today's adventure"
  with no day number; every child starts at Day 1. The stories are told once:
  a "two-week rotation" that starts again at Day 1 after Day 14 would be one
  change in `questToday()`, and is his call (today a finished story is never
  on Home again, and the game of the day goes on for good).
- A finished story is not on Home again; its game is, in "Your games"
  (FOUND1).
- Under Reduce Motion both games hold still: Light the Way's boats stay on
  their spots (the teacup's peek is a cut) and Puzzle Bridge's stones do not
  swim.
- Every speed, hold time, pool and star size, help timing and sound level
  (`MEDIA_PEAK` 0.4 in each game, set without a phone to listen on); Light the
  Way's moon (moved low so the top bar never covers it) and its brass rail
  across a phone; Wind-Up Toys' Grandpa Bear half hidden behind a wide toy,
  the buddy's small drawn shelf and the cuckoo's drawn doors; Puzzle Bridge's
  hump, the ages 3-4 stones floating over the rail, the friends' size and the
  flood's darkness.
- Two pages to redraw first if anyone minds: Day 1's e02 (the rowboat's crew
  reads as bunnies) and Day 2's e01 (a bear in the crowd could be Grandpa
  Bear); and the night pages on a real phone in a dark room.
- Before "merge": play all three games on his phone, look at
  `design/adventure/review.html`, and listen to the recorded lines with Rachel
  once they exist.

**Days 4-14: Codex's games in the story** (22 Oct 2026). Codex built eleven
physical games (`public/daily-adventures/<key>.js` and `.css`,
`window.DailyAdventureGames[key]`, each with its own suite `daily-<key>test`
on its test host `tests/fixtures/daily-adventure.html`; Codex's record of
them is `design/daily-adventures/INTEGRATION.md`, the plan `STORY-PLAN.md`).
Claude joined them to the story:
- **One page for all eleven games, `public/story-game.html?story=<id>`.**
  `STORY_DAYS` gives each of Days 4-14 a `controller` (its key in
  `DailyAdventureGames`) and that page. Day 7's id is `frontdoor`, because
  Day 3 owns `bridge`; its controller is still Codex's `bridge`. The page asks
  `gameAccess()` before it puts the game's files on the page, so a family
  without the story, an unknown id or anything after `?story=<id>` goes Home
  before any file, mic or sound; it hands the game five moves for ages 3-4
  and eight for 5-8 (the games' contract: ages 3-4 say FIVE words a day here,
  six on Days 1-3); its end card's one button is "See what happens!" to the
  story's ending, with no Play again; the engine's end card finishes the day
  (`questEnd`). It writes nothing of its own.
- **One shell, one copy of the words.** The page's body is the test host's,
  element for element, and both load `public/daily-adventures/host.css`
  after the game's own sheet (the order every fit was measured in); every
  game's words (title, start card, help pill, banner, canvas label, end card)
  are `public/daily-adventures/pages.js`, which the page and the test host
  both read. `storygametest` holds the two bodies equal. The test host serves
  `sona.js` without any story day whose game is its key, so a game is still
  tested alone through the catalog gate it was verified on. A game relabels
  its own help pill while playing (pages.js's `helpText` is only its first
  paint).
- **The story around each game is Days 1-3's format, in `adventures.js`:**
  Pelly's letter (a new wrong thing every day: a striped sock, a teapot, a
  pinecone, a toothbrush, a carrot, a mitten, an umbrella, a wooden spoon, a
  sandwich, a pancake, a fluffy slipper), the problem, "Let's go!", the game,
  the ending, and a gold star ("Four gold stars on our helper map!" up to
  fourteen; on Days 5-14 the model draws the whole map with the one star Echo
  presses (Day 4's was drawn with its four),
  and `cut-adventure.py`'s `STARS` lays the days before's stars on its
  places, the game's own glossy star, so a child can count them, as Days
  1-3's maps got theirs). Eight scenes and four endings for 5-8, six
  and three for 3-4, every line under the story-line rules. Pictures in
  `public/assets/adventure/<id>/`, Home's `home-<id>.webp`, drawn by
  `tools/art/gen-adventure.mjs` from `adventure-prompts.json` (a later story
  names its own `lineups` and `who`; every opening page is told it shows
  the problem, not the fix) and checked page by page before cutting.
  One cast across the run: Day 9's Frog is Day 12's drummer, Day 9's Badger
  is Day 6's Baker Badger off duty; Gardener Mouse (Day 4) and Mouse (Day 5)
  look different; Day 7's Tortoise is not Day 3's Grandma Tortoise.
- **Not used in the app:** Codex's three acts and endings in `stories.js`
  (its planning record, now `ready: true`) and the narration adapter
  `narration.js` (story cards that would stop a game at its 2nd and 6th
  word): no app page loads either; their suites still run. No story card
  interrupts a game.
- **For Rachel:** every line a child hears, in the PR body; the eleven games'
  directions (`voicedoc` B7-B8, 124 lines: 11 in B7,
  113 in B8), among them a few to look at:
  Rooftops' "The gutter brings every missed seed back", Postboat's "Steer
  beside the right dock", Concert's "Your sounds are safe" (in a speech app),
  Nest Lift's "Hold Up to lift"; ages 3-4 say five words, not six; the games
  ask the child's own sound like every Say & Play game (no story words in
  `GAME_WORDS` for Days 4-14).
- **For Travis:** the two-week rotation (above); repeats only the games could
  change (two bridge days, 3 and 7; two new front doors, 5 and 7; "too big
  for the stairs" on 11 and 13); the games' own pictures stay Codex's painted
  look beside the clay story pages; every new character and joke the stories
  invented (each story's notes, in the PR).

**FOUND1: every story leaves its game behind** (23 Oct 2026; Travis asked
for "things to unlock so that kids want to be coming back every single day
... I want to unlock like games, like a mystery game", then "you can make
the executive decision and start going"). Four reviewers (kid pull,
simplicity, fairness to kids, reuse) each came back with this one idea:
- **Your games.** Under Home's two doors, once a story is finished: the
  games the child's finished stories left, newest first, each its story's
  Home picture and its game's `name` (`STORY_DAYS`, short: "Light the Way",
  "Waterwheel", "Bridge Builder"…); the one found today wears a teal "New!".
  A tap plays it again: `again`, the story's page with `?again=1` (Days 1-3's
  own pages) or `&again=1` (`story-game.html`). `Sona.storyFound()` is the
  list (read only; nothing new stored: finished stories are `s`, per child,
  in backups); `Sona.storyReplay(id)` says whether one may be played, by the
  story's rule (`storyOpen()`). Without it there is no row at all, never a
  grey tile (a tap on one would open the price in front of a child).
- **A replay is a game like any other:** Play again and Back home, no
  hand-back to the story, and its round finishes nothing (`questEnd` answers
  only today's open story). Its page sends "story game replayed" `{ game }`
  in place of "game opened". A replay address for a story not finished yet
  goes Home before anything is put on the page: that game is still the
  story's surprise. A replay page brought back from the browser's cache
  reloads, so the checks run again for whichever child is on the phone now
  (its Play again would otherwise finish another child's story day). Still
  not in the catalog: no shelf, picks row, setup
  grid, website count, level or Best.
- **Tomorrow's game is the mystery:** a finished day's card still shows
  tomorrow's story picture dark, and now says "Come back tomorrow for Day N
  and a new game!" (only while `storyOpen()`: a story shown locked tomorrow
  brings no game, so that card says "Come back tomorrow for Day N!"). The
  same order for every child, never random, never bought.
- **The ending says where the game went:** the sticker card adds the game's
  Home picture and "New game on Home: <name>!" (read only).
- **The gift button** took the place of the reps count in the top corner and
  the Trophy Road card (see "Trophies, coins and the Trophy Road").
- **Executive calls, Travis's to change:** story games stay on Home; the
  reps count left Home for the ring (grown-ups lost a one-tap path to
  Progress: it is Grown-ups, then the Progress tab, where today's count now
  sits under the daily goal); the doors stay (the
  plan's one row with "All games" and "Books" as tiles was not built).
  **Not built yet:** new stories after Day 14 (about one a week, and holiday
  stories that show only in their month, whose games stay once found: a
  holiday-only game needs a line in the Terms, which promise Premium "every
  new game"), and the Arcade's own-age-first shelf with "More games".
- **For Rachel:** replaying a story game means more sayings of the child's
  sound (play, never practice data); whether that wants a limit is hers. A
  child the phone cannot hear can never finish a story, so never finds its
  game; whether a grown-up may finish it for them is hers too.
`homestorytest` (the row), `storycoretest` (the list and the replay rule),
`storygametest` (every replay page), `lighthousefittest`, `bridgefittest`
and `windupreplaytest` (a Days 1-3 replay played to its end card twice:
Play again starts a clean round and finishes nothing), `adventuretest` (the
ending's line), `roadtest` and `repweektest` (the gift button, and today's
count on Progress) play it.

`storycoretest` (the rules in `sona.js`, the offer, the hand-back),
`homestorytest` (Home), `adventuretest` (the player; run as
`adventureplaytest` and `adventurespotstest`, the buddy's spots at an iPad),
`storygametest` (Days
4-14's page and Day 4 played through), `lighthousetest` (run as
`lighthouseplaytest`, `lighthousehelptest`, `lighthousefittest`),
`winduptest` (and `windupreplaytest`) and `bridgetest` (run as
`bridgeplaytest`, `bridgelittletest`, `bridgefittest`) play it; `shiptest` checks every picture and the voice
manifest, `loadtest` the colours, and `node tools/voicedoc.mjs --check` every
line (B7-B9).

## Home: today's story, the Arcade and the Books
**Home leads with today's story; every game is one tap away in the Arcade**
(STORY1, 22 Oct 2026; Home was the silent Play library from 24 Sep 2026).
`today.html` is one page with two views, `#libraryApp[data-view="home" |
"arcade"]`: every block is built once on load, as before, and the view only
decides what shows (hidden on the view's wrapper, never by a block's own
`hidden`, which `paintQuest`, `paintFound` and the preview notice set
themselves), so there is still one copy of the game card, `launch()`, the
offer, the level sheet, the grown-ups check and "Home opens the offer once".
- **Home** (`/today.html`): "Today's adventure" (its first h1), the story card
  (`#questCard`, see "Daily story (STORY1)": a 16:9 picture, "Day N", the
  title, the hook line, a 64 px teal play button, a "Premium" tag without
  it; done: tomorrow's picture dark, "Day 1 done!" and "Come back tomorrow for
  Day 2 and a new game!" ("…for Day 2!" when tomorrow's story is shown
  locked), or "Come back tomorrow for a new adventure!"), two
  doors (`#homeDoors`: **Arcade**, `home-arcade.webp` and "All the games";
  **Books**, `home-books.webp` and the Books card's own tag, one handler for
  both), then "Your games" (FOUND1, below; only once a story is finished).
  The top bar is the buddy, the gift button and Grown-ups. On a phone the doors are tiles with the
  picture as a 2:1 band on top (the Arcade picture's game things sit at its
  edges, so it is never cut to a square); on an iPad, rows with a 3:2
  picture. The card's tap stays exactly
  `card.onclick=function(){if(done)return;launch(game);}`; on a story day
  `game` is `{ kind: "story", key: "adventure", go: "/adventure.html", tier:
  "premium" }`, so `launch()` opens it, or opens the price where Sona sells.
- **The Arcade** (`/today.html?view=arcade`): "‹ Home", then "Pick a game!"
  and everything Home was: Today's picks, Limited time, both shelves, the
  Books card, the age note, Best tags, level badges, the locked note and the
  price on a grey tap.
- **Moving between them.** The Arcade door pushes `?view=arcade` and switches
  at once, and for 500 ms after the Arcade door or "‹ Home" no tap on the
  page does anything (a double tap's second tap used to open whatever the new
  view put under the finger: a book in Today's picks, or the price); "‹ Home" goes back if it was pushed, else replaces the address;
  Back and Forward read the address again. `?locked=` opens the Arcade with
  its note. `activities.html` (old links) adds `view=arcade` unless the
  address has `view=` or `locked=`, keeping the rest of it. Titles: "Sona" on
  Home, "Sona — Play library" in the Arcade. **Every game's exit, the price's
  X, setup's end and `firstGameEnd` still go to plain `/today.html`, which is
  Home:** after any game a child lands on Home, not back in the Arcade
  (Travis's to change: a tab-only marker could return them).
- **The fit is measured, never guessed** (`fitHome`, `fit1`…`fit5`: the story
  picture to 2:1, tighter type, a phone's door pictures to 5:2, the story
  picture to 5:2, then 3:1): the play button and both doors are on the first
  screen at 320×568, 375×667, 390×844, 430×932 and 768×1024, every button at
  least 44 px. "Your games" may fall below on the smallest, but on the day
  a story is finished its New! tile is measured too, so the dark tomorrow
  picture gives way for it: the tile's picture and its New! are on the
  first screen at all five sizes (on 320×568 that takes all five steps, on
  375×667 two), and on an iPhone SE on the website (375×553) too, its name
  just below. Not under the founding banner (a browser only): on 320×568
  only the tile's top, its New!, peeks above the fold, and on 375×553 none
  of it (a sixth step would flatten tomorrow's picture to a strip and still
  not fit it; Travis's to change). With the real pictures an open day takes
  at most four steps (the founding banner on 320×568: the story picture at
  5:2); only a finished day, or the banner on 375×553, reaches the fifth
  (3:1).

Setup finishes in the first game (Feed Echo for 3-4, Fruit Slice from 5; see
"The ask happens after the product proves itself"), and every visit after
that opens on Home. **Home is silent and only reads:** on load, on coming back
to the front and between the views it writes nothing, sends nothing and
speaks nothing, and its source never says `questEnd`, comments included.
There is no old adventure-map Home or menu narration. Voice remains inside
deliberate game/practice sessions (and setup's "Hear Echo", a grown-up's
one tap on the reel, since 22 Oct 2026). Parent settings, progress, profiles,
earned coins (now visible on the Trophy Road, and spent in the Buddy Shop),
homework and entitlement sync remain available. Home's way to the Trophy
Road is the gift button in the top bar (read-only, FOUND1); the Arcade's cards carry a level badge on
their picture, and a level sheet opens only from a tap (see "Trophies, coins
and the Trophy Road" and "Levels inside games"). `homestorytest` pins Home;
`activitytest`, `fittest`, `homepickstest` and the rest play the Arcade.

**The fuller books** (Travis, 26 Sep 2026: "do one for each letter"): one
twelve-page story per sound, first on each sound's shelf in `library.html`.
Each puts its sound at the start of a word, before a vowel, on every page, and
nowhere else in the book (not mid-word, not at the end, not in a blend).
Spelling can't check that, so `readtest` checks every line against
`tests/booklex.json` (pronouncing-dictionary entries); a new word needs its
entry there (so does a six-page book's key word). The reader tints only the start of each book's listed `words`.
Every page is a picture in the crafted style: **all 19 fuller books were
redrawn on 1 Oct 2026** (Travis: "every design done by claude we will be done
with") as `cover.webp` + `p01..p12.webp` in `public/assets/books/<slug>/`.
They are made by `tools/art/` (README in each script's header):
`book-prompts.json` holds each book's character bible and one description per
page, built around that page's key word; `gen-books.mjs` draws a cover, a
character lineup, then every page as its own picture with the cover and lineup
attached (six pages on one sheet put 5-9 of 12 in the wrong place);
`cut-books.py` trims and sizes them; `wire-books.mjs` swaps a book in.
Every page was checked by eye against its line and key word; the pages the
check still questioned are listed on the review page (`tools/art/review/`)
for Travis and Rachel. **What a picture shows the child is Rachel's call**:
redraw a page through `gen-books.mjs --redo <slug>:pNN`, never by hand-editing
a prompt into a different word.
`tools/bookart/` (the old SVG builder) now builds no book — `handmade.mjs`
lists all 19 and `books1.mjs`/`books2.mjs` are empty — but stays because
`tools/gameart/` draws the parked games from its kit. The builder still never
draws over hand-made art and refuses a book name it doesn't build;
`tests/arttooltest.mjs` pins the lists against the shelf and every
book-picture path any page uses.
**The books are on** (Travis, 26 Sep 2026: "yes turn them on"), and **one is
free** (30 Sep 2026: "one book uh so like the letter r book ... to be free and
the rest is grayed out"). Home's Books card always opens `library.html` and
says "1 free book" to a family without Premium. On the shelf each book asks
`Sona.bookLocked(title)`: the books in `FREE_BOOKS` (Rory and the Rainbow) are
open in every pricing state, marked "Free" while others are locked; every
other book that is out is Premium and opens exactly when a Premium game does
(`booksOpen()`: Sona free, Premium from any source, or a trial; never the
three-day demonstration window `gated()` honours, or a new family would watch
the shelf lock under them), greyed and marked "Premium", and a tap opens the
plan screen at once where Sona can sell (4 Oct 2026, see "TRIAL FIRST"), or
elsewhere shows the grown-up message ("Ask a
grown-up to help open …", naming the free one) with the button to
`premium.html`, behind the grown-ups gate. `openBook()` refuses a locked book
too. A child whose own books are all locked or coming sees the free book first.
Rename Rory and the Rainbow and `FREE_BOOKS` must follow (`readtest` pins it).

**Every book that is made is live** (Travis, 1 Oct 2026: "if anything is
made ... let's just make it live", replacing the 9 Oct opening day). No book
in `STORIES` carries `opens`; the shelf's `opens` support stays, so a future
book can still wait for a day ("Coming Oct 9"). The six-page books (painted,
see below) sit after every twelve-page one in `STORIES`: they put the sound
anywhere in a word and are last in line to be redone. A limited-time book
carries `season` instead and is on the shelf, and Home's Limited time row,
only inside its window. **Halloween (October 2026) has one for six sounds**
(Travis, 2 Oct 2026: "take a popular book like the halloween and make a
version for other letter even just the popular ones like r s l z f"): Boo the
Bat (B, `anySound`), Rory the Rabbit (R), Sid the Seagull (S), Leon's
Trick-or-Treat Night (L), Zoe the Zebra (Z) and Finn the Fish (F), each
starring that sound's own hero under the same sound rule. A child sees the
one in their own sound; a child whose sounds have none sees Boo
(`Sona.seasonPick`, which the shelf and Home both ask); play mode and a child
with no sounds yet see them all. Home's card,
the website and the Premium page say "new ones on the way", never "every
week", "a book for every sound" or a weekday. `readtest` pins that nothing
waits; `landingtest` the website's count.

**The other sounds' books wait behind "More books"** (Travis, 1 Oct 2026: "it
displays the ones that are selected for the target letter and sound ... and
the other ones ... they're still there, but like closed up ... there's like a
button you can press to like drop down and then it shows the books for the
other letters ... a kid, like they might be like wanting to just do the
Halloween one"). They are closed, not gone, so a child meets their own first
(Travis, the same day: "less easy to find or less in your face ... the kids
just seeing books based on their letter/s"). The top shelf is chosen as
before: the child's own sounds' books, plus the limited-time book(s)
`Sona.seasonPick` gives them (in October the Halloween book in their own
sound, or Boo the Bat when their sounds have none; see "Every book that is
made is live"), and the free book first when their own have nothing to read.
**With more than one sound, the one practice is on now leads** (main's #184,
1 Oct 2026): a child on R and S whose practice is on S today
(`Sona.rotSound()`) sees the S books first, then the R ones. Only the order
moves, inside "readable, then Premium", so without Premium the free book
still leads; a homework sound that is not one of the child's own brings no
books up. Home's What's new row
follows the same rule: books in the child's own sounds only, that sound's
first (`HOME_BOOKS` in sona.js names each book's sound; play mode and a child
with no sounds yet see them all). Under the shelf sits one cream pill, "More
books (N)", N being how many books are behind it for this child, closed on every
load with nothing remembered; a tap opens "Books for other sounds", every
in-season book the top shelf left off, and a second tap closes it. **The other
sounds' Halloween books are behind it too**, so the Halloween one a child
"might be wanting to just do" is always one tap away, and the two shelves
together are the whole in-season list, each book once: 48 books in October
(42 and the six Halloween ones), so a child on R has 9 on top and 39 behind,
a child on K 3 on top (their two and Boo) and 45 behind; 42 the rest of the
year (8 and 34 for R). Play mode, or a child with no sounds picked, already
has the whole shelf, so the pill is not there. Behind it: readable first, then
Premium (nothing is "coming" since every book that is made is live), each
sound's books together in the order `STORIES` names the sounds. Both shelves
are built by one function (`addBook` in `library.html`), so a book there
opens, locks and asks for its word exactly as it would on top; never a second
copy of the button. **And never a second More books:** two sessions each built
one on 1 Oct 2026 (this pill, and a `<details>` drop-down under the same
shelf), and with both on the page every other book was there twice. The pill
is the one that stayed; `readtest` fails if a second control comes back.
The second shelf's buttons are made on the first open, because a cover on the
page is downloaded whether or not it shows. Menus stay silent: the page's tap
chime, no voice. **A double tap opens it once, and opens no book:** opening
slides the pill to the top of the screen and closing lets the page spring
back, so a second quick tap used to land on whatever had moved under the
finger: a book the child never picked or, without Premium, "Ask a grown-up to
help open …" for one, a push toward the plan screen nobody asked for. So for
700 ms after either tap nothing on the page takes a tap, the pill included
(`.wrap.settling`, lifted by a timer; scrolling and the keyboard still work).
The pill's colours are action.css's cream pill and nothing else: the page's
own rules for `#moreBtn` set its size and place only, and `readtest` fails on
a colour, border or shadow there. **What this changes for a child is Rachel's
to know:** a child on R can now open an S book, and it asks them to say that
book's words if they are old enough for that sound (`Sona.soundNorm` of the
BOOK's sound, not the child's). Still play, never practice data. `readtest`
pins both shelves; `booktest` the word moment from the second one.

**The six-page books are painted** (Codex, 28 Sep 2026, with ChatGPT's image
tool; brought over 29 Sep): one picture per book in `public/assets/books/painted/`
holding its six scenes, three across and two down, in reading order, plus a
small `-cover` copy of scene 1 that the shelf shows like any drawn cover, so a
book that isn't open yet never pulls the big picture. The full-screen reader
cuts page i's scene out of that picture on the phone (a canvas, once per book,
one book kept at a time, still one download) and shows it exactly as it shows
a drawn page: whole at full width, its own top and bottom rows carried out to
the screen's edges, the cream card over its foot. The title page is scene 1
(the small copy until the full-size cut is ready). While the picture is on its
way a page shows its wash and fills in; if it never comes, the old emoji
sticker, never a blank page. The art was drawn for those exact 78 sentences,
so `readtest` pins them (change a sentence and redraw its scene) and checks,
by comparing pixels, that each page shows its own scene. Codex's own
say-a-word-to-turn-the-page prototype was not brought over; the books
branch's version below was, and it is ON for the twelve-page books (Travis,
29 Sep 2026: "On now", after being told it changes what a child is asked to
say) **and, since 1 Oct 2026, for these thirteen too** (Travis: "It's doing
it on some of the books. But we want to make that something that is happening
on every book"). Each carries six `keys`, one a page, and no `words`. They
put the sound anywhere in a word and their sentences can't change, but a key
is the one word the child is asked to say, so the keys keep the twelve-page
rule: a whole word on its own page, lower-case, that starts with the book's
sound before a vowel by its `tests/booklex.json` entry. Where a page had such
a word it is the key ("she", not "milkshake"; "ruby", not "rooster"). Two
words can't, and `readtest` lists them by name so the next one is a decision:
**"bath"** on the TH book's fifth page, where no word starts with that sound
(the one key in the app that isn't start-of-word, while Settings tells parents
"Sona practices each sound at the beginning of a word"; true of practice, and
a book word is play), and **"rory"**, an R on both sides of "or", on a page
with nothing easier. A key the reader can't find fails silently (Echo asks,
nothing glows), so `readtest` runs every key of every book through the
reader's own highlighter. Nothing about the moment changed for them, the age
rule least of all: a child of 6 is not asked on the five R books, and a child
of 4 only on the K, G and F ones. **On a six-page line only the key word has
orange letters**, the same ones Echo's bubble shows (`tintKey`, through
`Sona.soundMark`): those lines used to colour every letter equal to the
sound's first letter, which on 21 of the 78 words put the orange on the wrong
letters ("[s]heep", "[c]hi[c]k", "ba[t]h", "ca[k]e", a plain "cow") beside a
bubble marking the right ones. `readtest` holds the lit word and the bubble to
the same letters in every book. **Rachel's review is still owed**: the
twelve-page words, Echo's lines and what counts as a try are listed in that
PR's body, and these 78 words, the two named ones and the line's colouring in
this one's.

**The app's look is the crafted world** (Codex, 28 Sep 2026: Travis's five
concept boards, in `design/crafted-world/references/`). Painted scenes and game
objects live in `public/assets/crafted/`, each surface's styles in
`public/crafted-*.css`, and `design/crafted-world/README.md` is the handoff.
Real controls and game objects stay HTML and canvas; a picture is never the
interface. New art in this style comes from an image model (Travis generates
it in ChatGPT); the twelve-page books are still the simpler drawings.

**Setup's game reel is real play, filmed (SETUPREEL1, 22 Oct 2026)** (Travis:
"Do like a little clip of a few games so that parents can see it"). The clips
on setup's "They practice by playing." screen are
`public/assets/setup/reel/<key>.mp4`, each with a poster `<key>.webp` (its
first frame), one per playable game: slice, tiles, hoops, soccer, dino,
stack, run, glide, rise, feed, bubbles. Nothing in them is drawn or edited:
`tools/setupreel/record.mjs` (run by hand, never in the battery; its header
says how) opens each game page as it is on `tools/appstore/capture.mjs`'s fake
phone, plays it with the page's own controls and the fake microphone (a word
or sound counts only the way a child's does, by the page's own check), and
films one 1/30 s frame at a time on Playwright's virtual clock, cropped to the
game at 3:4. A clip is 3 to 4 seconds, 540×720 H.264 High, no audio track (it
can never make a sound), moov first, tagged BT.709, at most 300 KB, its
poster at most 60 KB. The tool stops on a clip or poster over budget, a crop
that leaves the screen, or the child's name in the page's text in any frame
(a word drawn on a canvas it cannot see: check the sheets). `setupreeltest`
holds the files, and that every game on the list is a playable game, never a
Coming soon one. **The reel is its own fixed demo list** (`REEL_ORDER`, the
eleven with a clip), never every open game: the 18 games opened on 22 Oct
2026 have no clip, so setup's reel leaves them out (it used to append any
playable game without a clip, as its Home card). **A new game on the reel** is a scene in `record.mjs`, its
key in `KEYS` and in the test's `REEL`, and setup's own list
(`onboarding.html`); run the tool alone (it is CPU heavy, port 9303) and look
at every contact sheet in `tools/setupreel/out/sheets/` before committing a
clip. **Travis's calls:** which moment each clip shows (Fruit Slice in Super
Slice, a Hoops basket, Soccer Goal ending on GOAL!, Dino Dig ending as a bone
lands, Feed Echo feeding two pictures, Piano Tiles a song's opening, a tile
or two at a time), the crops, the 3–4 s, Rise Up's calm clip (one key drops
it), and the strict budgets. **Rachel's:** every clip is on R (setup says
"Example: the R sound"), the little kids' games (Feed Echo, Bubble Pop) too,
so a parent of a 2–4 year old sees R played, a sound not asked of that age;
and the clips show the rewards a child earns by saying the sound (Super
Slice, the ball, the brush, the bubbles).

**A book page fills the screen, and the child says one word to turn it** (the
family's redesign brief, 28 Sep 2026). The picture fills the screen and the
page's words sit on a cream card over its bottom; the shelf shows each fuller
book's drawn cover. Pictures pick their fit once loaded: portrait art (taller
than 1.2x its width, the designer's coming 1024x1536 pages) covers the screen;
today's wide SVGs are shown whole at full width, their own top and bottom rows
stretched to the edges. `#bkStage .bkart.scene img` stays the only picture
`<img>`. On a short phone the picture makes room for Echo's question
(`roomForAsk`): it slides up under the top bar first, then shrinks only by
what is still missing; its box must never animate, because sona.css makes
transitions near-instant under Reduce Motion and a box mid-transition reports
where it WAS (that once collapsed the picture to nothing).
Every book has `keys`, one word per page (Travis, 1 Oct 2026: "we want to
make that something that is happening on every book"). A twelve-page book's
are the brief's list, and readtest holds each to that book's rule: the sound
starts the word, before a vowel. A six-page book's keep the same rule but for
two words listed by name (see "The six-page books are painted"). After Echo
reads a page the key word glows, Echo asks "Can you say... <word>." and the teal mic listens:
- **The check is Say & Play's**, copied into `public/saycheck.js`
  (`window.SayCheck`) because `sayplaytest` pins `sayplay.js`'s source as it
  stands. `tests/booktest.mjs` fails if a timing, the loudness bar or the
  sound-type test drifts between them: change one, change both.
- **Heard means "a voice of the right kind"**, never "the word was right" (the
  phone can't tell words on the web), so Echo says "I heard you!", never
  "correct". Then a small celebration, and the page turns itself.
- **Silence never turns the page and is never a try.** A quiet window closes
  the mic and waits for a tap on it; the tap only listens again. A try is a
  loud sound of the wrong kind for the book; after 3, Echo says a kind line and
  the page turns. A grown-up's small Skip turns it any time.
- **A book word is play, not practice.** No logAttempt, bumpReps, coins or
  stickers, and no clinical practice key changes. Each accepted key word adds
  one `gameRep` toward the daily goal, once per page. Skips, silence and the
  third-shape retry turn add none. It never means the word was pronounced right.
- **The phone is asked for the mic only from the grown-up's "Yes, use the
  mic" tap inside the book.** "Not now", or a refused or missing mic, means
  the book reads with Next for the rest of that visit; never a dead end.
- **No word moment for a child younger than `Sona.soundNorm(book.sound)`**
  (setup stores the top of the age band: 2-4 is 4, 5-6 is 6, 7+ is 8).
- **Every way off the moment closes the mic first**, and nothing plays while
  it is on, while it is being asked for, or within 200 ms of its close,
  including the book's own reading voice. Stopping speech ends the line in
  flight at once, so a page turned mid-load never holds the next page's mic.

**Say & Play** (Travis, 26 Sep 2026: "10 more games for ages 3-4 and 10
more games for ages 5-8 ... incorporating practice into it"): twenty games
where every word the child says moves the game one step, five words for 3-4
(Simple play) and eight for 5-8 (Arcade). One engine, `public/sayplay.js`;
each `arcade-<key>.html` is written by `node tools/gameart/build.mjs` from
`tools/gameart/little.mjs` and `big.mjs` (edit there and rebuild:
`sayplaytest` and `arttooltest` fail if a page drifts). The builder overwrites
only pages that carry its marker (`MARK` in `tools/gameart/page.mjs`); if any
target page lacks it, it writes nothing, so a key that collides with Hoops or
an older hand-written arcade page can't overwrite it. The start card's button
is a teal pill, "Let's play" beside the play triangle (the triangle stays for
a three-year-old who can't read). `node tools/gameart/cards.mjs` draws their
Home cards, except the hand-drawn ones listed in `PLAYED` in
`tools/gameart/games.mjs`; if a new card picture (say `balloon.webp`) lands for
a game it still draws, it refuses and writes nothing until that game is added
to `PLAYED`. Only a voice moves a game: no tap stands in for
talking, and the mic button only listens again (in a play game like Hoops
a finger plays the move, but only a move a word has earned). The mic keeps every quiet
rule the other games keep. A spoken move is play, never practice data (no
pass rate, no clinician sees it), but each saying Echo hears is one rep on the
week's count (Travis, 29 Sep 2026; see "The week's reps"). They open straight
from Home and never join the daily adventure.

**All twenty were parked as Coming soon** (Travis, 26 Sep 2026: "these games
are not good. they are essentially all the exact same but with a different
look ... if its basketball, we want them shooting a hoop", then "put the 20
games as coming soon. so show them but greyed out. except for old ones like
fruit slice and piano tiles that actually work. leave those"). The child only
talked and watched; nothing let them *play*. Each comes back **one at a
time**, rebuilt as a real game — what the child sees, what their finger does
and what saying the word does, agreed with Travis in plain words first, then
played by him on his phone — by taking `comingSoon` off its own line in
`GAME_ACTS`. Hoops, Soccer Goal and Dino Dig came back first; the other
seventeen, with Peekaboo, are the eighteen below, all open since 22 Oct 2026. Home lists
playable games before parked ones. `sayplaytest`
still plays the engine, on a copy of `sona.js` with the parking lifted, and
checks every parked page sends a typed address home before any mic or sound.

**The eighteen rebuilt by Codex, open since 22 Oct 2026** (Travis, 16 Oct 2026, to
Codex: build the Coming soon games one at a time, each with its own finger
play and a real reason to talk; then, to Claude: "i jsut want you to finihs
rhe job"). Race Car, Treasure Map, Robot Builder, Castle Builder, Space Trip,
Pizza Chef and Monster Makeover (5-8), and Balloon Party, Grow a Flower,
Rocket Blast, Build a Snowman, Choo-Choo Train, Puppy Bath, Bedtime Stars,
Birthday Cake, Surprise Boxes, Fish Tank and Peekaboo (3-4) are each a real
played game on `sayplay.js`'s play hook (`public/<game>.js`, a hand-written
`arcade-<key>.html`, its own suite `tests/<game>test.mjs`). **All eighteen
opened at once** (Travis, 22 Oct 2026: "turn on all 18 games and email about
them at 8am"), all Premium, on Home and on `parents.html`'s strip (29 games),
instead of one at a time after he played each. No game is parked now; the
parking still works (`freetest` parks one in the page to prove it). What every one holds:
- **The word (said two times) earns each step; the finger makes it.** No
  progress before the word, silence earns nothing, `api.done()` once a step.
- **Every round ends without speaking again** (the Hoops rule). Misses make
  the move easier, per step: ages 5-8 slower after one, still and glowing
  with a pointer after two, nearly anything works from the third; ages 3-4
  glow from the first miss and nearly anything works from the second. A long
  task (rubbing, stirring, tracing) steps up by time spent actively trying.
  No help ever finishes a move by itself.
- **An optional help word** (the teal pill: "Slow road", "Steady rope",
  "Calmer fish"…) asks for the same word again through `api.practice()` and
  earns a power on top. **It can always be left:** silence, a pause, or the
  "Back to the game" pill gives the earned move straight back with no power
  (`endHelp` in `sayplay.js`, added because Codex's version froze the game
  until the child spoke). `sayplaytest`'s "help ask" scenario pins it. The
  pill and "Back to the game" sit in the same place, so a tap within half a
  second of either switch on the very spot the switching tap touched does
  nothing (22 Oct 2026: a double tap on the pill asked and cancelled at
  once; `helpDoubleTap`): a tap elsewhere, a key and silence are never held
  back. `lighthousetest`'s help part plays it.
- **A cheer before the next word:** the step counts about 1.15 s after the
  success, so its chime is heard (a step finished mid-direction stops only
  Echo's voice, `stopVoice`).
- **Echo speaks short directions** through `api.instruct()` (only in play,
  never over the mic); `tools/voicedoc.mjs` lists every one.
- **Peekaboo moved off `simple-play.js`**, where a child could finish all
  five finds in silence: the word hides the picture, the doors swap, a tap
  finds it; a wrong door glows the right one.
- **For Rachel:** all eleven ages 3-4 games ask each word two times (Bubble
  Pop asks once; one setting, `sayTimes: 1`, changes it), and the help pill
  asks two more sayings, as often as the child likes; every direction
  Echo speaks; what counts as a miss. **For Travis:** the help timings, each
  game's pace, and that Fish Tank, Surprise Boxes and Peekaboo share Monster
  Makeover's painted room. The review and Codex's notes are in
  `design/coming-soon-games-2026-10-16.md` and
  `design/coming-soon-games/*-art-notes.txt`.

**Coming soon games are hidden** (Travis, 19 Oct 2026, "yes", to a funnel
expert's review: eighteen greyed cards cluttered Home and pushed parents
away). Home draws no parked game at all: no card, no "Coming soon" label, no
grey slot, on any shelf, in Today's picks, the daily adventure card or the
level sheet. A parked game's card comes back by itself the day its
`comingSoon` comes off. A typed address to one still bounces home with
"<Game> is coming soon" (and a `comingOn` day still labels that note). The
shelves count cards, never names (`crafted-home.css`): the little kids'
shelf is all wide rows; on a phone the last card of an odd count is a wide
row; on an iPad one card left over is a wide row and two share it.
`activitytest` and `sayplaytest` pin it. The paragraph just below is the
history before it.

**Every unfinished game says "Coming soon", with no day** (Travis, 15 Oct
2026: "put coming soon", the day before the first three were due). From 30
Sep to 15 Oct each parked game carried a day (`comingOn`; from 9 Oct three
games a Friday, 16 Oct to 20 Nov), and Home said "Coming Oct 16" until that
day. Now no parked game carries one: every card says "Coming soon", and each
shelf's parked games sit in catalog order. Bubble Pop, Soccer Goal and Dino
Dig came back early and are open. The day support stays, as the bookshelf
keeps `opens`: `comingOn: "2026-11-06"` on one game's line shows "Coming Nov
6" until that day on the family's calendar, then "Coming soon" again, and
sorts it first on its row. **A day is a label, never a switch:** `gameAccess`
never reads it, and only taking `comingSoon` off (after Travis has played the
rebuilt game) opens one. Putting days back is Travis's call. `activitytest`
pins that no parked game carries a day, the labels, the order, and that the
support still works.

**Hoops is the first one back, rebuilt to be played** (Travis, 26 Sep 2026:
"yes build hoops", to the plan: the hoop slides slowly side to side; say the
word and get a basketball; swipe it up to shoot; a miss bounces off and you
shoot again; eight words, eight baskets). `public/hoops.js` draws the court
on a canvas and flies the ball; `public/arcade-hoops.html` is written by
hand (the generator no longer makes it), and every word turn, the mic and
its quiet rules stay `sayplay.js`'s. What it keeps:
- **The word earns the ball; the finger shoots it.** No ball before the
  word, a swipe (or a tap) with no ball does nothing, and a miss never costs
  a word: the ball comes back. The step, and the dot, count on the basket.
  This is the engine's **play game** hook (`game.play`: `init`, `onWord`,
  `pause`, `resume`, `reset`, `finale`, calling back `api.done()`), so the
  next rebuilt game can use it too.
- **Every ball ends in a basket.** A swipe toward the hoop (where the child
  sees it; the ball is sent where it will be) with about the right strength
  goes in. After one miss the hoop slows and the window widens; after two it
  stops, glows, and an arrow points the way; from the third, any swipe up
  goes in. The hoop is still for the first two baskets and holds still while
  a word is said and while a basket is cheered.
- **Its sounds go through the engine** (`game.sounds`: swish, whoosh, clank,
  bounce, made on the phone), so each waits for a closed mic like a chime.
- **Nothing is practice data**, as in every Say & Play game.
Its gym wall, ball and (since 4 Oct 2026) backboard are painted
(`public/assets/crafted/game/`); the rim, net and floor stay drawn.
Its Home card, `public/assets/games/hoops.webp`, is a frame of the court
itself; its `PLAYED` entry in `tools/gameart/games.mjs` makes
`tools/gameart/cards.mjs` point `sp-hoops` at it and never draw a card over it.

**Soccer Goal is the second one back** (Travis, 1 Oct 2026: "go finish
soccer"), on the same play-game hook: `public/soccer.js` draws a little
stadium and flies the ball; `public/arcade-soccer.html` is written by hand.
Say the word and a ball rolls to the spot; swipe up to kick it past Bo, the
bear in goal, who slides along the goal line. Where the swipe points is where
the ball goes. What it keeps, as Hoops does:
- **The word earns the ball; the finger kicks it.** No ball before the word,
  a tap is not a kick, and a save or a wide kick never costs a word: the ball
  rolls back. The step counts on the goal.
- **Every ball ends in a goal.** Bo stands to one side for the first two
  balls (straight up scores), then slides from post to post. A kick just
  past a post is pulled in. After one miss he slows and reaches less, and the
  pull reaches further; after two he dozes off by one post, the open side glows and an arrow points
  to it; from the third, any swipe up goes in while he dives the wrong way.
  A really hard flick can go over the bar; a soft one still rolls in.
- **Its sounds** (kick, net, save, bounce, whoosh, roll) go through the
  engine, and **nothing is practice data**.
Home's wide card is the painted one (`public/assets/crafted/home-soccer.webp`,
from main's covers, 1 Oct 2026), and the website tile is cut from it; the
sticker is still a frame of the pitch (`public/assets/games/soccer.webp`,
through `PLAYED`), and painted art drops in at that name. Inside the game the stadium, Bo and the ball are
painted (4 Oct 2026, `tools/art/game-sprites.json`, cut to
`public/assets/crafted/game/soccer-*.webp`); the pitch, goal and net stay
drawn, because they move and carry the perspective. On Home eight of the nine
big-kid games fill four even rows of two and Rise Up, the ninth, is a
full-width row on a phone, so neither Flappy Glide nor Hoops is full-width any
more. `sayplaytest` plays a
whole game.

**Dino Dig is the third one back** (Travis, 1 Oct 2026: "go to the next game"),
on the same hook: `public/dino.js` draws a cliff with a dinosaur skeleton's
outline and a sand pit below it; `public/arcade-dino.html` is written by hand.
Say the word and a brush comes out; rub the sand in the pit with a finger to
uncover the bone; once most of it shows it pops out and flies onto the
skeleton. Eight words, eight bones, then the dinosaur's body fills in and it
roars. What it keeps:
- **The word earns the brush; the finger digs.** Rubbing before the word moves
  no sand, a tap alone digs up nothing, and the step counts when the bone lands.
- **Every bone comes out.** The brush is wide; after about four seconds the
  bone's spot glows, and after about eight, rubbing anywhere in the pit wears
  the sand over the bone away. It never digs by itself: the help needs a
  rubbing finger.
- **Its sounds** (brush, pop, whoosh, clack, roar) go through the engine, and
  **nothing is practice data**.
Home's wide card is the painted one (`public/assets/crafted/home-dino.webp`,
from main's covers), and the website tile is cut from it; the sticker is still
a frame of the woken dinosaur (`public/assets/games/dino.webp`), replaced by
painted art at that name. `sayplaytest` plays a whole dig.

**Dino Dig has four dinosaurs** (Travis, 1 Oct 2026: "i want to build different
types of dinosaurs to look for not just one"): T. rex, Triceratops,
Stegosaurus, Brontosaurus, dug in that order, a new one each finished round,
round again after the last. Each has its own skeleton outline, its own eight
bones and places in the pit, and its own body and colour when it wakes (data in
`DINOS` in `dino.js`, drawn from one small kit). Since 4 Oct 2026 the dig
site, the sand, the earth and each woken dinosaur are painted (`ART`,
`public/assets/crafted/game/dino-*.webp`); a painted dinosaur is fitted to its
skeleton's outline and its bones fade as it wakes, since a painting never
lines up bone for bone. The skeleton, its outline and the bones stay drawn.
The round is the child's (`sona.dino.v1`, one of `PER_KID`, kept by the page
through `Sona.kkey`; `dino.js` never touches storage): a brother or sister
starts at the T. rex, and one left half dug waits, from its first bone. The
start card shows the one to look for as a dashed outline ("Today: T. rex"),
the end card says "You found a T. rex!", and both show the row of four, found
ones filled in. **No count is ever shown** ("2 of 4" would read as a grade).
A collection, never practice data. `tests/dinotest.mjs` digs all four.

**The word is said two times** (Travis, 1 Oct 2026: "ask them to say it two
times. and if they say it once to have it say '1 more time'"). In the Say &
Play word games (`sayplay.js`: Hoops, Soccer Goal, Dino Dig and the parked
ones) a turn needs two sayings. It is one setting a game, `game.sayTimes`, and
two unless the game's page says otherwise. **Bubble Pop asks once**
(`sayTimes: 1` in `arcade-bubbles.html`): it is the littles' game, built on
main to be said once, and whether a three-year-old should say a word twice is
Rachel's call, so it stays at one until she says. With one there are no dots,
no "Say it 2 times" and no "1 more time!": one saying earns the bubbles, one
rep. `sayplaytest` pins which game asks how many times. With two:
- **Echo still says the word alone** ("Say... rabbit."). Hoops, Soccer Goal
  and Dino Dig first say a separate instruction: "Say each word two times
  to get a ball" (a brush in Dino Dig). It plays once per visit, before the
  first isolated word, never between the first and second saying. The start
  card and the two dots also explain it. Interrupted instructions cancel
  with the existing audio generation and replay before a resumed target.
- **Words that fit the game** are selected from existing painted bank
  entries (`GAME_WORDS`/`gameWords`), before a vowel with no blend, at turns
  1, 4 and 7 when available, without repeating a themed word. Other turns
  use the existing beginning-position pool. Named clinician homework always
  overrides themes. No new word, speech gate or practice outcome is added.
  `soundmarktest`, `soundmap`, `hwtest` and `sayplaytest` check the words,
  artwork and precedence; Rachel reviews the exact table in the PR.
- **The first saying only paints**: its dot is ticked and "1 more time!" shows
  in the same frame, with no voice and no chime, because the mic is still open.
  Only the second saying earns the move.
- **One word is one saying.** The second counts only after 200 ms under the
  loudness bar (`GAP_MS`) and never sooner than 450 ms after the first
  (`APART_MS`): "rock...et" has a hard stop in its middle.
- **A saying already heard belongs to the word**: the mic button, "Hear it" and
  a pause keep it. After one saying and 12 quiet seconds the mic closes and
  says "1 more time! Tap the mic". Silence never earns the move.
- **Each saying heard is one rep** on the week's count (two a word); still
  never practice data. Whether two is right, whether the littles should say it
  twice too (Bubble Pop asks once; the other ten ages 3-4 games and Peekaboo
  ask twice as built), whether Echo should model the word again before the
  second, and whether both count as reps are Rachel's calls. **They opened
  asking twice on 22 Oct 2026, before she answered** (Travis: "turn on all 18
  games"); her answer is one setting a game (`sayTimes: 1`, as Bubble Pop's).
- **The wait a child feels is before the mic can hear, not after the word**
  (Echo's word, 250 ms of quiet, the mic opening, and on a game's first word
  450 ms to measure the room). Each is a guard: do not shorten them.

**Bubble Pop is rebuilt to be played** (Travis, 1 Oct 2026: "more like the
feed echo vibe ... we want to have more bubbles to pop", then "yeah B", the
plan called "Say it, and Echo blows bubbles"). It was one bubble at a time,
five taps a round, and a child never had to say anything. Now, for ages 3-4:
Echo holds a bubble wand; say the word and Echo blows six to eight bubbles;
pop them all; the gold one has the word's picture inside and drops it into
the basket; five words fill the basket, then Echo floats up inside one giant
bubble, and popping it ends the round (about 37 pops, where there were 5).
`public/bubbles.js` draws the sky on a canvas; `public/arcade-bubbles.html` is
written by hand; the word turn, the mic and its quiet rules are `sayplay.js`'s,
on the same play-game hook as Hoops. What it keeps:
- **The word blows the bubbles; the finger pops them.** No bubble before the
  word, so a tap on the empty sky pops nothing, and the step counts only when
  every bubble is popped and the picture is in the basket. A finger dragged
  across the sky pops what it crosses.
- **Every round ends.** Bubbles bob in place and never float away; a touch
  near one counts; left alone for about eight seconds the ones left glow and
  take a wider touch; after about fifteen, a touch anywhere pops the nearest,
  and once that help is on it stays on for that word (a beat between pops, so
  one dragged finger cannot empty the sky). A bubble never pops by itself. The
  giant one is the fifth step: the end card waits for its pop, and after six
  seconds a touch anywhere pops it.
- **One picture, not three.** The plan said "three picture cards, like Feed
  Echo's choices"; the child never picks a card here, so the two extra ones
  had no job. The asked word's picture is in the word panel, inside the gold
  bubble, then in the basket.
- **It is NOT a catalog `say` game.** It stays on the little kids' shelf with
  its own Home card, and stays in their old five-round adventure
  (`charge.html?daily=1`): the page banks a finished round and sends the end
  card's button back to it, as Feed Echo does. Adding `say: true` would list
  it twice on Home and point its sticker at one that does not exist.
- **In the iPhone app the pops are media**, as Piano Tiles' notes are: each
  sound is built once on the phone and played as a media element, because a
  pop comes seconds after the mic closes, when an iPhone plays Web Audio as a
  quiet phone call (and not at all with the ringer off). A browser keeps Web
  Audio. How loud they are on a real phone is `MEDIA_PEAK` in the page: it was
  set without a phone to listen on. A muted Sona (volume 0) plays none.
- **Its sky, wand, bubble and basket are painted** (4 Oct 2026,
  `public/assets/crafted/game/bubbles-*.webp`; the basket is
  `crafted-bubbles.css`'s background); the word pictures are Feed Echo's.
- **Nothing is practice data**; each heard word is one rep on the week's
  count, a pop is nothing. **For Rachel:** the ask is the engine's "Say...
  <word>." with start-of-word words for the child's sound, and "heard" is a
  voice of the right broad kind, exactly as in Hoops.
`simple-play.js` now runs only its test fixture (Peekaboo moved to
`sayplay.js` on 16 Oct 2026), and the old engine's tests stay on it. `bubblestest` (its own suite: the three other played games already fill
most of a suite's five minutes) plays a whole round, the smallest phone, the
app's sounds, a slow microphone and a page hidden at the wrong moment.
**That last one was an engine bug every played game had:** a page hidden in
the quarter second after a move finished came back to no next word and no way
on. `sayplay.js` now calls that moment `step`, which `resume()` reads as "the
next word".

**Arcade lives and a real ending** (Travis, 4 Oct 2026, in the 5 Oct handoff:
"They need to be able to actually die or lose in the game ... say their target
sound to get a new life ... start easier and get progressively a little trickier").
This replaces the five round games' earlier promise of an automatic win. It
changes finger play, never what passes the speech check:
- Fruit Slice, Piano Tiles, Block Stacker, Sound Sprint, Flappy Glide and Rise
  Up start with three hearts. A real gameplay miss costs one. No miss opens the
  between-round say-it card. At zero hearts the round ends on a kind card,
  with Play again and Back home; it does not claim the finale was completed.
  A retry goes through the existing five-tries practice page.
- One accepted sound-power turn restores one heart, up to three, as well as
  earning that game's power. Tapping Echo, silence, an unrelated word and a
  cancelled ask restore nothing and count no rep. The Apple isolation verdict
  and the existing sound-shape fallback are unchanged. A heard power is one
  game rep; a heart or gameplay miss is never speech practice data.
- No heart is lost while Echo asks or listens, while the earned power is on,
  in a finale, or on a hidden page. Nearby misses are protected from emptying
  all three hearts at once. Losing a heart brings the next ask forward by
  about 1.5 seconds of eligible play, while respecting the longer quiet
  back-off after two unanswered asks; it never opens an always-on microphone.
- Echo explains the reward before the recorded sound and Go! The ordinary
  and heart-restoring reasons are each spoken once per visit, only marked
  said after a line finishes. Both download as the page loads. A slow or
  failed voice uses the existing bounded fallback, so play never freezes.
- The pace starts at the existing easy speed and rises within a capped range;
  a miss eases it. The sound power still slows motion to 55%. Exact pacing,
  grace windows and the heart lines are play defaults for Travis to hear and
  play on his phone. Rachel should review the frequency and wording of asks,
  and the effect on children the phone hears poorly.

**A new life only on a loss** (Travis, 8 Oct 2026: "lets only have the kiddo
say the sound to get a new life if they die or lose. it kept popping up in
piano tiles too much ... during the game they only say the sound to make the
game easier or slower ... i still want them to say the sound beforehand to
charge up"). This replaces two lines above and in "Echo asks, then listens":
a heard sound power no longer gives a heart back, and a lost heart no longer
brings Echo's next ask forward (that was what made him ask so often). In all
six round games (Rise Up since 14 Oct 2026):
- **Mid-round, Echo's ask earns the power only** (slow keys, Super Slice, the
  slow help), on its own clock: about six seconds in, then every 20 seconds
  of play, 40 after two quiet asks. He never mentions a heart mid-round.
- **At the last heart the round stops on the say-it card:** "Say “rrrr” for a
  new life!", three empty hearts, Echo's "For a new life, say", Rachel's
  take, "Go!", then the mic. Heard: all three hearts are back and play goes
  on from where it stopped (one rep, as any card; no confetti; it does not
  use up a between-round card). "I'm done playing", or a phone with no
  microphone: the kind end card, as before. Silence brings nothing back: the
  card waits. A child can earn a new life as often as they lose.
- **The charge-up is unchanged:** the "Say it 5 times" page still comes
  before every game, and the cards between rounds are as they were.
- One copy, `lifeOrEnd()` / `lifeTaken()` in `arcade-speech-help.js`. The
  line is fetched once a heart is gone, not at page load. All three hearts
  back (not one) and no limit on new lives are defaults Travis did not pick.
  **Rachel's to rule on:** a child who keeps losing is asked for the bare
  sound each time, and a child the phone hears poorly cannot get back in.
`tilestest`, `slicetest`, `stacktest`, `runtest`, `glidetest`, `risetest` play
the card; `arcadespeechhelptest` that a lost heart moves nothing and a power
gives none.

**The clinical success rule below still applies to speech-practice rounds:**
step the target down rather than end on failed speech. An arcade round may
end because of finger play; that is not a grade of the child's sound.

**Fruit Slice is a round now** (Travis, 27 Sep 2026, yes to: "three waves of
fruit, then one giant watermelon to finish. It always ends in a win. Missing is
OK... The talking moves to between waves"). The six first games are being made
solid one at a time, and this is the first:
- **A wave ends** when its fruit are sliced (6, 8, then 10; a golden fruit
  counts three) or after 45 seconds of play, whatever the count.
- **A missed ordinary fruit costs a heart** during active play, outside an
  ask or earned Super Slice. Misses ease the pace; Super Slice extras cost
  nothing. The board keeps moving until the last heart is gone.
- **The say-it card shows only between waves** ("Say “rrrr” for wave 2!";
  for a child on R it may ask a syllable or a short word, see "Games ask for
  more than the sound"), never after a miss. Its listening and quiet rules are the ones every arcade
  card shares (`micquietgamestest`); `crash()` is kept as the card's old name
  because those suites open it through it.
- **The fruit are thrown from the stand** at the bottom of the screen. The first
  five are the five the "Say it 5 times" page filled, in its order, and on that
  page each heard try now drops its fruit onto the counter.
- **Reaching the end of wave 3 opens the giant watermelon:** five swipes
  across it and it bursts. Its finale costs no hearts; a round that runs out
  earlier ends without claiming that win.
`tests/slicetest.mjs` plays a whole round.
The market has more open sky, with a smaller fox and Echo behind a low counter.

**Block Stacker is the same round, as a tower** (27 Sep 2026): it stands on the
five blocks the "Say it 5 times" page built; three floors of 5, 6 and 7 go on
top, with the say-it card between floors ("Say “rrrr” for floor 2!"). A missed
block tumbles off and a fresh one slides in, slower (and after two misses the
landing zone widens); a close drop snaps into place; no block is ever narrower
than 60% of the first (the old tower cut kids down to a sliver, and the card
handed the sliver back); a golden block makes the tower full width again. A
rocket on the top ends it: any tap launches it, and it goes by itself after a
few seconds. `tests/stacktest.mjs` plays a whole round.

**Piano Tiles is the same round, as songs** (27 Sep 2026): Twinkle Twinkle,
Mary Had a Little Lamb and Row, Row, Row Your Boat, each tile one note of the
tune in a lane by pitch, so tapping the tiles plays the song; the say-it card
between songs; then Ode to Joy as a grand finale whose tiles all wait on the
keys, so reaching it ends in a win. A tile that slips by costs a heart
outside an ask or earned slow keys; remaining tiles get a safe landing after
a miss so one fumble cannot empty the hearts. The first three tiles wait
on the keys until tapped; and a tile takes the song's fall time on every
screen (it was 2.2 s on a small iPhone and 0.5 s on a big iPad). One tap, one
note: `micquietgamestest` pins it: sound on plays at the one normal level, muted is silent.
**The notes are the music, and in the iPhone app they are media** (Travis, 1
Oct 2026: "there's no music with the tiles game. We want it to like play
little songs while you're playing"). Each tile was a thin beep through Web
Audio, which an iPhone's ring/silent switch silences and which a page that has
had the mic open plays as a quiet phone call, so on the phone the songs were
not there. Each note is now a piano note built on the phone (0.55 s, so the
mic's quiet window still holds), and the app plays it as a media element, one
kept per key, with the level in the samples (`MEDIA_PEAK`: an iPhone gives a
media element no volume). A refused element falls back to Web Audio, never to
silence. A browser keeps Web Audio at the level it had, so iPhone Safari with
the ringer off is still silent. The loudness in the app was set without a
phone to listen on: it is that one number.
`tests/tilestest.mjs` plays a whole round.
The painted notes are wide, rounded tiles that fill most of each lane.

**Every sound is Rachel's own voice** (Travis, 1 Oct 2026, of the L on Fruit
Slice's practice page: "it said the weirdest sound. But it didn't say the
actual one ... we need to either insert her voice right there or re-record";
R went first that morning, "use number 4"). The one-take sound that plays in
the letter's place ("…and make your [lll] sound, five times."), on every
say-it card and in every sound power (`/coach/say-echo/<S>-sound.wav`) is cut
by `tools/soundclips.mjs` from her July recordings in `/coach/say/`: her short
demo of the sound where it is clean, else the same sound inside her whole July
line ("… — p! p! p!"), whose room noise is 20–30 dB lower. They used to be her
takes re-voiced into Echo's voice, and the voice changer bent the very cue a
child copies: her L became an "ee", her R moved toward W (the "wabbit" error),
her N and Z took a vowel's shape and Z lost its hiss; v4 Turbo's F (used for
the voiceless sounds) came out voiced. All 19 now come from her, R still the
take Travis picked, levelled to Echo's words to the ear. `storytest` holds
every take to her recordings and checks each still sounds like its sound:
voiced sounds voiced, hisses hissing, the L not an "ee". A new take is a new
window in the tool's `TAKES`, read off a spectrogram; which take is the model
is Rachel's call. Piano Tiles plays the same one take (it played the
three-take re-voiced demo). Her whole lines stay re-voiced: practice plays
one only when the voice service is down.

**Piano slow keys** (Travis, 28 Sep 2026: “inside the game ... they say the sound to slow down the keys”). Since 3 Oct 2026 Echo asks for it by himself mid-song, and the song keeps going while he asks and listens (see "Echo asks, then listens"); a tap on Echo still asks at once. Its notes are silent from his first word until the mic closes. A voiced, family-checked attempt earns eight active gameplay seconds at 55% speed, including the arrival of new tiles. Native Apple recognition, when available, uses the existing isolation verdict to reject a clear unrelated word; unknown keeps the existing sound-shape fallback. Tapping, silence and timeout earn nothing. No ask in the Ode to Joy finale. Both microphone owners must close before music or navigation resumes. The between-song prompts remain. These in-game attempts are play, not SLP practice data. It runs on the shared helper (`arcade-speech-help.js`) since that day; `tests/tilesspeechtest.mjs` checks the mechanic and interruption cleanup.

**Sound-powered help across live games** (28 Sep 2026): Fruit Slice slows fruit motion and spawning, Block Stacker slows the moving block, Sound Sprint slows its course and progress, Flappy Glide slows hedges and their arrival while preserving balloon control, and Rise Up slows its falling blocks, its climb and its breeze, never the shield. Each uses `arcade-speech-help.js`/`.css`: Echo asks (by himself since 3 Oct 2026, see "Echo asks, then listens"; a tap still asks at once), the child hears the existing target recording, then a qualifying attempt earns eight active seconds at 55% speed. The scene keeps going during speech; only its sounds hold. Between-round prompts remain. Permission/native cleanup completes before resuming audio or navigating. No gameplay attempts enter practice records. Hoops already requires a word to earn each shot. `arcadespeechhelptest` drives the four new helpers. Books and parked games are outside this change.

**Echo asks, then listens: nobody taps for a sound power** (Travis, 3 Oct
2026: "I don't want them to have to tap echo to then say the sound ... I want
them to be able to just be playing the game and at any given point say the
sound to slow the game ... have 11 Labs voice maybe say that like mid game").
All six round games (Fruit Slice, Piano Tiles, Block Stacker, Sound Sprint,
Flappy Glide, Rise Up), from one copy in `arcade-speech-help.js`:
- **Echo asks by himself, mid-round:** all six pages first ask after about
  six seconds of play (`SLOW_HELP.first`); the shared fallback remains ten. Later asks wait 20 seconds of eligible
  play (`SLOW_ASK`), with a heart loss bringing the next forward by 1.5
  seconds. The first ask for each distinct reason in a visit is the game's
  line ("Super Slice! Say", "To slow the keys, say", or its heart reason),
  then Rachel's one take, then "Go!"; later asks for that same reason are her
  take and "Go!". Each reason is preloaded through `SayIt.line`. It is the
  say-it card's voice (`SayIt.voice`, through its `ask` hook): media in the
  app, Web Audio on the website, the mic only after "Go!" and its tail.
- **The game keeps going.** Nothing holds, dims or waits, and the game's
  banners still show; Echo's button breathes while he asks and listens. Only
  the game's own sounds (its chimes, Piano Tiles' notes) stop, from his first
  word until the mic has closed, so nothing plays over him or into the mic.
- **He listens 8 seconds** (`SLOW_ASK.listen`). One heard sound earns the
  power at once, exactly as before (Super Slice ten seconds, the others eight
  at 55%), restores one missing heart up to three, and is one rep. Nothing
  heard: the mic closes quietly and play goes on. Two quiet asks in a row and the next waits 40 seconds
  (`SLOW_ASK.quiet`), so a child who isn't playing along isn't asked every
  20 seconds; a heard one goes back to 20.
- **Play time only.** No ask during a say-it card, a break, a finale, while
  the power is on, on a hidden page, or once the phone has refused the mic
  (then not again that visit). A round that ends while he asks ends his turn
  first, and that turn is not counted as a quiet one.
- **A tap on Echo still asks at once**, the same way: a shortcut, never
  needed. "Keep playing" is gone: there is nothing to cancel.
- **What Travis chose, and its cost.** A mic left open the whole game would
  make an iPhone play everything like a phone call (quieter, the side buttons
  moving call volume), so he chose this over that. The cost is about eleven
  quiet seconds (his ask and his listening) in every half minute or so of
  play: no swish, no piano notes. The timings are the numbers in `SLOW_ASK`,
  plus each page's earlier first ask.
- **Rachel's to rule on:** a child is now asked for the bare sound about
  every 20 seconds inside these games, on top of the cards between rounds;
  whether that is too often, and whether "Go!" belongs there. What counts is
  unchanged ("a voice of the right kind", Apple's check where it can; "taco"
  and "wow" still fail), and it is still play, never practice data.
`arcadespeechhelptest` plays the ask in all six games, with
`tilesspeechtest`, `superslicetest` and `micquietgamestest`; the six round
suites, `sayitcardtest` and `micquietgamestest` hold it so each plays just its
round (`micquietgamestest` then makes one ask due on purpose).

**Feed Echo needs the word** (Travis, 1 Oct 2026: "all that it does is ask you to click. we need to get the kid to have to say it!"). "Let's play" starts the round (so the first ask is heard on an iPhone), and a grown-up says yes to the mic first, the Say & Play way; "Not now" goes home, because Echo needs to hear the word to eat. Each turn the pictures wait, locked, until a voice burst of the right broad sound family is heard ("Echo heard you!", never "correct"); then the asked picture glows and a tap feeds it. A tap before the word wobbles and says "Say it first!"; silence never unlocks anything: after 8 seconds the mic closes and a mic button waits, which says the word again and listens again. The mic now opens straight after Echo's ask (and, since 2 Oct 2026, his "Go!"): it used to wait for `navigator.permissions` to say "granted", which the iPhone app's web view does not reliably say, so on the phone it never listened; a permissions question that has not answered within a second now means "ask the grown-up" (Say & Play too), never a Let's play that does nothing. Still play, never practice data: one rep per heard word. `feedtest` and `micquietgamestest` play it.

**Echo says the say-it card out loud, and "Go!" hands over the turn** (Travis,
2 Oct 2026: "when a game will pause and ask them to say the target sound, I
want the 11 Labs voice to say out loud ... to keep playing ... Most of these
kids can't read", and "i also wanna try to have the 11 labs voice say
"Go!""). Only Fruit Slice spoke its card; now all six round games do, from
one copy, `public/arcade-sayit.js` (`SayIt.voice`): "To keep playing, say",
Rachel's one take of the sound, then "Go!", and only then the mic, 250 ms
after his last word (`VOICE_TAIL_MS`, the tail every listening page keeps),
never into a sound. It can never look frozen: the two lines are asked for as
the page loads and kept in the phone's voice cache; a line still on its way
gets 2.5 s, a media element that never starts 4 s, her take 3 s, then the card
goes on without it; on the website the lines play through the page's own Web
Audio (a browser refuses an `<audio>` started between rounds), in the app as
media; a mic the phone has refused gets no ask at all. Fruit Slice's cards
that ask a syllable or a word (see "Games ask for more than the sound") say
Echo's one line for it in place of the first two, through the helper's
`ask` hook, then "Go!"; its step-back says "I have an idea. Let's try this
one.", her take, then "Go!". "Go!" also follows
every ask that hands a child the turn: the practice page's prompt, a tap on
Echo, the turtle and its two retry lines ("… five times. Go!", joined on as
one clip after the words, so the quiet before the mic still starts at its
end), every Say & Play word (Bubble Pop, Hoops, Soccer Goal, Dino Dig) and
Feed Echo's ask. Not the books (their ask is pinned); Peekaboo, open since 22
Oct 2026, asks through `sayplay.js` like the other Say & Play games.
"Go!" is ONE clip, `Sona.goClip`: this page's copy or the phone's saved one,
asked for on its own so every saved ask stays valid, never a wait on the
network after a visit's first ask (that one waits `GO_WAIT_MS`, 1.5 s, at
most), and never the browser's robot voice (no clip, no "Go!"). Known and
kept: the mic opens after "Go!", so a child who answers the instant they hear
it can be talking before the mic listens (`micquietgamestest` pins that a
word said over "Go!" is not heard; on the practice page the next of their
five tries is). The 24 Sep 2026 calm rule took "Go!" out for sounding jumpy;
it is back as Travis's try, and whether it stays is his ear and Rachel's
call (a turn cue): taking it out is one line in each place. What counts as
the child is unchanged by any of this. `sayitcardtest` plays the card in all
six games, `voicetest3`, `chargepacingtest`, `sayplaytest`, `feedtest`,
`micquietgamestest` and `iphonepolishtest` the "Go!".

**Hearing a child from further away: paused, numbers first** (Travis, 2 Oct
2026: "I have to say the word super close to the phone or else it won't seem
to hear it ... Sock.", then, about 13 hours of helper work later, stop and
ship only the safe parts). Every bar is as it was. What the work found: every
way of hearing a quieter voice also let quieter noise count (a fan, a tap or
shower, a clap, a machine's hum, Echo's own ring after "Go!"), because the
web pages hear loudness and rough sound shape only. A likely cause, still
unchecked on a phone, is not a bar at all: in the iPhone app, Apple's
listening check (SonaSpeech) sets the audio session to `.measurement` mode,
which turns off the phone's automatic gain (`SPEECH_PLUGIN.md` lists the
audio session as the known risk; a fix there needs an App Store build). So
measure before changing anything: say "sock" at arm's length on speaksona.com in
Safari, then in the app, then in the app with Speech Recognition off for Sona
(iPhone Settings, Privacy & Security; quit the app first). **The mic numbers**
show what the phone hears: five quick taps on "Account" in Settings (behind
the grown-ups check, because the app keeps its own storage) switch on a box
at the top of the practice page with the level now, the loudest moment of the
last two seconds, the bar, the room, each sound that cleared the bar (how loud,
counted or not), the frame rate and what the phone says it does to the mic.
It changes nothing that counts, never takes a tap, and nothing it shows is
saved or sent (`micquietpracticetest`, `familynavtest`).

**Super Slice: Fruit Slice's sound power** (Travis, 29 Sep 2026: "give them an
option to say the sound to slow the game down ... they go into some frenzy
mode or easy mode or beast mode when they say their target sounds ... one at
a time", then "1 time to get it slow mode is fine ... or just to say it and
hold"). Fruit Slice's help became a mode a child wants to earn, and the other
games copy it one at a time:
- **Echo asks mid-wave and the child says the sound once**, quick or held
  (since 3 Oct 2026 nobody taps: see "Echo asks, then listens"; a tap on
  him still asks at once). The fruit keep flying; the page's own sounds stop
  while he asks and listens (the mic may only open while nothing plays). The
  first ask in a visit Echo says "Super Slice! Say", then one take of
  Rachel's recorded sound (`{SND}-sound.wav`, as the say-it card does), then
  "Go!"; later asks play only the sound and "Go!". A heard try shows "Got
  it!" and ends the turn after the 550 ms Apple's recognizer gets. Silence
  and (on the iPhone) a clearly different word earn nothing. **"wow" for "rrrr" does not count**
  (Travis, 29 Sep 2026: "no wow should not count"): `hearVerdict` keeps
  failing it.
- **Ten seconds of Super Slice:** the fruit slow to 55%, the stand throws
  five at once (one golden), every toss after is two or three (it outranks
  the two-miss help), the swipe becomes a wide rainbow blade (it slices 34 px
  past a fruit's edge, not 16), and the screen edge glows gold. Its fruit are
  extras: they add to the row of fruit but never to the wave, and nothing
  dropped while it lasts breaks the row (see "Beat Your Best"). Time left
  when a wave ends waits through the break and carries into the next wave
  (a wave can still end while it is on: its 45 seconds, or the last ordinary
  fruit in the air); the giant watermelon ends it.
- **Every earned turn is a rep** on the week's count (see "The week's reps");
  still never practice data. The round still ends on the giant watermelon
  whether or not a child ever says a word. The retired names (STAR MODE,
  FRUIT FRENZY, SLOW-MO…) stay banned. `tests/superslicetest.mjs` plays it;
  Block Stacker, Sound Sprint, Flappy Glide and Rise Up keep the eight-second
  slow help (now with the same one-take sound) until each gets its own mode.

**Games ask for more than the sound: Fruit Slice first, R first** (Travis, 1
Oct 2026, by voice: "we need to add back the increase of complexity to the
sounds in the games and start with isolation then ree rah roh then rot. and
maybe have that be something to update in settings"). "Add back": in June the
old speech games asked for the level a child had earned; they were deleted in
August, and since then only the "Say it 5 times" page climbed. Every say-it
card between rounds said the bare sound. What is built is the first slice:
- **One reader, `Sona.gameAsk(sound, card)`** (and `gameTop`). Card 0 is the
  bare sound; cards 1 and 2 are the two cards between rounds. The steps: the
  sound alone ("rrrr"), then **one syllable a card** ("ree", "rah" or "roh",
  moving on one each calendar day, so nothing is stored; never three in a
  breath, which confused children in July), then **a short word** ("rot",
  Travis's word: it is in no word bank and has no picture, so only a text
  card may ask it).
- **How far a child's cards go:** one step past what they have earned on the
  practice page (so a new child gets a syllable on both cards, and the word
  after two clean practice rounds). (A grown-up could pick it in Settings
  until 22 Oct 2026; see "The game-card picker is gone" below.) Never below what the "Say it 5 times" page just asked: that page hands over
  the step it ended on and its item (`sona.boost.level`, `sona.boost.ask`),
  and a card repeats that syllable or word instead of adding a new target.
- **Two kinds of child never get the harder cards** (`Sona.gameHold` says
  which): **a child aged 2 to 4**, whatever was earned (Home shows a
  four-year-old Fruit Slice too), and **any child while Sona's sound is off**
  (only Echo's voice can model a syllable).
- **Switched on one sound at a time.** `gamecontent.js` holds three lists
  Rachel can read: `GAME_SYL_ON` (today `["R"]`), `GAME_SKIP` (never asked:
  "pee"; "gee", which Echo's voice reads "jee"; the quiet th's "thee", which
  it reads as the loud th) and `GAME_SHORT` (today `R: "rot"`). A sound goes
  into `GAME_SYL_ON` only after someone has **listened** to its lines on a
  phone. A sound that is not in it asks the bare sound exactly as before, so
  nothing changed for any child who is not on R.
- **An SLP's homework wins.** Its own words are the word card's words. When
  its position is not the start of a word (end of word, "er, ar, or") there
  is no syllable step, because "ree" is a start-of-word R, not her target:
  the sound, then one of the homework's words if it names any.
- **Fruit Slice's card is the only one that does it.** It shows the ask with
  only the sound's letters orange and says it in ONE line of Echo's own voice
  ("To keep playing, say... ree."), because nothing past the bare sound is
  recorded. **A harder ask is never shown unless Echo says it.** His line
  starts downloading as the wave ends (about 2.6 seconds before the card),
  and the syllable is painted only once the line is in hand, just before it
  plays. Until then the card shows the bare sound; if the line has not come
  about three seconds after the card opens, or will not play, it stays on
  the bare sound and plays Rachel's recording. (The first cut painted "ree"
  and then waited up to seven seconds for a voice.) **A card nobody
  answers** for about eight seconds closes its mic and steps back to the bare
  sound ("I have an idea. Let's try this one.", then her recording), **and
  the next card that round does not climb**: it asks that same syllable or
  word again, never the next step. Echo's power button (Super Slice) still
  asks the bare sound: Travis wanted it quick, and Apple's listener would
  turn away a good "ree" it wrote down as "we".
- **Honest limits.** A card hears only "a voice of the right kind". It cannot
  tell "ree" from "rrrr" or "rot", so harder means what Echo asks, never what
  is checked, and Echo never says "correct". Nothing said in a game moves the
  earned level, and a heard card is exactly one game rep, never practice data.
- **The game-card picker is gone** (Travis, 22 Oct 2026: "simplify settings
  ... get rid of as much as we possibly can"). From 2 to 22 Oct Settings had
  "Between rounds in a game, Echo asks for" (Sona decides · Just the sound ·
  Sound, then syllables · Sound, syllables, word), saved per child as
  `profile.gameLevel`, a ceiling for the cards. Now every child's cards
  follow what they earned, and `getProfile()` drops a saved pick (the parent
  code's way), because a pick nobody can change would hold that child's
  cards at that step for good. **For Rachel:** a child
  aged 5 or more on R whose grown-up had picked "Just the sound" is asked a
  syllable ("ree") on Fruit Slice's cards at once (a new child's cards start
  one step past what they earned, which is a syllable), and one whose
  grown-up picked the word drops to syllables until the word is earned.
  Whether a grown-up should set the step by hand is still her open call
  (below); this build has no control for it.
- **Not built yet:** the other five round games (Piano Tiles, Block Stacker,
  Sound Sprint, Flappy Glide, Rise Up: Echo says their cards out loud, but
  they ask only the bare sound; each needs Fruit Slice's one line for the
  syllable or word, through the say-it helper's `ask` hook); the other 18 sounds; the
  picture games, which keep whole words. Travis plays Fruit Slice on his phone and
  hears "ree", "rah", "roh" and "rot" before any of that starts.
- **Rachel's calls, built on defaults until she answers:** which syllables
  and in what order; whether "rot" is the word (and the list for the other
  sounds); the pace (syllables from day one, the word once earned, the
  eight-second step back, and whether the card after a step back should
  repeat the same ask, as built, or go lower); Echo's computer voice
  modelling "ree" and "rot" rather than her own recordings; that a card asks
  for "rot" but cannot check it; whether a grown-up may set the step by hand
  (the picker went on 22 Oct 2026 with the Settings simplification; the
  question is still hers);
  what the cards ask under end-of-word homework; and whether a child aged 2
  to 4 should ever be asked a syllable (today: never).
`tests/gameasktest.mjs` holds the reader to these rules; `slicetest`,
`micquietgamestest` and `iphonepolishtest` play the card; `soundmap` pins the
three lists and `kidtest` that Settings has no picker and an old pick is
dropped.

**The week's reps** (Travis, 28-29 Sep 2026). Home's top corner showed today toward the daily goal, and a
tap on it opened the grown-ups check, then Progress, until 23 Oct 2026: it is the gift button's ring now
(FOUND1), with the number in its spoken label, and grown-ups read it on Progress (Grown-ups, then the
Progress tab: "Today: 12 of 30 reps." under the daily goal, "Today: 45 reps. Goal met." past it, every rep
counted, practice, games and books, as the goal counts them); Progress keeps sound practice apart from play. (Settings
kept an eight-week chart and the best week until 22 Oct 2026, when the
Settings simplification took the card out; the rep line and the daily goal
moved to Progress.) One count, `Sona.repWeeks`/`weekReps`:
the practice page's voiced tries (`outcomes().days[].tries`, only days since
tries were counted, 22 Sep 2026) **plus every sound a game asked for and
heard** (`Sona.gameRep`, Travis: "yeah count as reps"): the say-it card
between rounds, Echo's sound powers, each saying of a Hoops, Soccer Goal or
Dino Dig word (two a word), a Bubble Pop word (said once), Feed Echo's heard
word and each accepted book key word (one a page).
Game reps live in their own per-child ledger (`sona.gamereps.v1`) and never
enter `outcomes()`, so no pass rate, clinician's note or shared progress
sees them: the hard rule "voice boosts never logged as SLP data" holds. Since
11 Oct 2026 they earn trophies and goal days (TROPHY1), a play currency that
never enters `outcomes()`.
Only a voiced try that passed the game's own check counts, once per ask;
silence never does. **Progress keeps practice apart:** its "tries" and
everything it hands a clinician (the summary, the card, "Free-play games are
not included") are the practice page's alone (`weekReps(offset, sound,
true)`), with a "Plus N said out loud in games and books" line so the week still adds
up to the week's whole count (`Sona.weekReps(0)`). `tests/repweektest.mjs` pins it.


**Sound Sprint is the same round, as a race** (27 Sep 2026): the park, the
beach and the forest, a checkpoint between each with the say-it card ("Say
“rrrr” to run to the beach!"), and a finish line that ends a completed race in a win; three lost hearts
can end it earlier. A rock is a tumble (a second off the road, ten metres back), never the
card; after two tumbles in a stretch the rocks thin out and the road slows.
The child taps the lane they want or swipes (a tap used to count only as the
left or right half of the screen). A golden coin is a coin magnet. The top
bar shows coins and the stretch; the end card counts metres (it said
"treats"). `tests/runtest.mjs` runs a whole race.

**Sound Sprint opens on Echo's how-to-play** (Travis, 1 Oct 2026: "when a kid
is about to start playing sound sprint, we want the voice ... to say
instructions ... so that they have instruction on what to do"). A child's
first three races open on a start card: Echo waving, three pictures from the
race itself (the runner in the lanes, a rock and a cactus, a gold coin) and one
teal button, "Let's run!". An iPhone plays nothing on a new page until a tap,
so the tap is the button: Echo says "Tap a lane to move side to side. Dodge
the rocks and the cactus, and grab the gold coins!" (true to the race: there
is no gold star), the button becomes a cream "Skip", and the race starts the
moment he stops. The race is held behind the card (nothing moves, spawns or
counts; both clocks start with the race). Three races, counted per child
(`sona.sprintintro.v1`); a suite that needs the race running seeds it to 3.
The line plays as media inside the tap (`Sona.mediaPCM`), with the browser
voice as the fallback, and never leaves a dead end: sound off starts the race
at once, a voice that never comes starts it within seven seconds, and locking
the phone mid-line stops Echo and keeps the race held. No microphone, no rep,
no practice data. `tests/runtest.mjs` plays all of it.

**Flappy Glide is the same round, as a flight** (27 Sep 2026): three legs of
6, 7 and 8 gaps, a rest on a cloud between each with the say-it card ("Say
“rrrr” to fly on!"), and a fireworks landing for a completed flight; three lost hearts can
end it earlier. The review found it the hardest of the six (a steady tap every
half-second, hedges nearly back to back), so the balloon floats and sinks
slowly (a tap about every second holds it level), the gaps are wider and
further apart, and a hedge is a soft bounce back into the gap, never the card;
after two bumps in a leg the gaps open wider and the hedges slow. Stars in the
gaps can be caught. **Hold-to-rise**, the review's other idea, changes the
control, so it waits for Travis. `tests/glidetest.mjs` flies a whole flight.

**Rise Up is the sixth round game** (Travis, 9 Oct 2026: "lets build the game
rise up", after the hit phone game). A balloon floats up through the garden,
the clouds and the stars; toy blocks fall toward it, and the child drags a
round shield to push them out of the way. `public/rise.js` is the board (the
balloon, the shield, the blocks, their pushes and pictures; it never touches
storage, the mic or a sound) and `public/arcade-rise.html` is the round, its
hearts, the say-it card and the sound power, the way Flappy Glide's page is.
It is entered through its practice page (`/charge.html?game=arcade-rise.html`,
which fills Flappy Glide's balloon), is Premium, and is the ninth card on the
big kids' shelf (a full-width row on a phone). It is **not** in the old
five-game run (`adventure: false`, which `adventureGames()` skips) and not a
Say & Play game; it is day 11 of the daily adventure (QUEST1). What it keeps:
- **The finger only moves the shield, by as much as it moves**, from wherever
  it lands on the screen (an iPad's margins too); the shield never jumps to
  the finger, stays above the balloon so it can never cover it, and can never
  cost a heart: a block it pushed in the last 0.6 seconds bounces off the
  balloon for free. The newest finger down drives it, and a finger held down
  through the say-it card steers again the moment the card closes.
- **A round nobody steers never wins** (review, 9 Oct 2026: a shield left where it
  started kept the balloon safe through the garden and the clouds, and a
  round nobody touched reached the top, thanked for 70 pushes). The shield
  starts beside the balloon, not over it, so left alone it shelters nothing;
  a push is the shield moving INTO a block, and a block that only lands on a
  still shield slides off it, uncounted and with no grace. A round nobody
  touches runs out of hearts in the garden or the clouds; on the new-life
  card "I'm done playing" ends it on "What a climb!" with no count line. (A
  child who never steers but says the sound for every new life can still
  reach the top, as in every round game: the new lives have no limit.)
- **The round:** three stretches of play (Garden 28 s, Clouds 32 s, Stars
  36 s), the say-it card between them ("Say “rrrr” to rise higher!"), then the
  top: five clouds to push away, which drift off by themselves after ten
  seconds; then the shield glides aside and the balloon floats up to a big
  star. Reaching the top is a win.
- **Hearts are the shared rules:** a block on the balloon costs one, and it
  wobbles, never pops; none is lost while Echo asks or listens, while the
  power is on, in a rest, at the top, on a hidden page or within 1.5 seconds
  of the last, nor for 1.5 seconds after the screen turns (a turned iPad
  moves the balloon to the new board's height). The last heart stops the
  climb on the new-life card ("A new life only on a loss"): heard, all three
  hearts are back and the stretch goes on; "I'm done playing" ends on the
  kind card, which never claims the top. The first two groups of a round
  always miss, and so does the next after a lost heart.
- **The pace:** a block takes 3.4 seconds to cross the open sky at the start,
  and gets faster by stretch and by play, to at most 1.4 times that; a lost
  heart eases it, two in a stretch make the rest of it easier. From the clouds
  on, a slow breeze sways the balloon side to side (to 0.16 of the width in
  the clouds, 0.22 in the stars, every 8 seconds), and the blocks fall toward
  where it will be when they get there, so a shield parked over it isn't
  enough on its own: parked, it runs out of hearts in the clouds or the stars,
  while a child who follows the balloon can keep all three.
- **The sound power is the other round games'** (`arcade-speech-help.js`):
  Echo asks after about six seconds of play, then every twenty, "To slow the
  falling blocks, say", Rachel's take, "Go!". One heard sound: eight seconds
  at 55% (the shield never slows) and one rep, never a heart. Never practice
  data. In the iPhone app it listens through Sona's own microphone, as the
  other round games do.
- **The end card counts blocks pushed** ("You pushed 23 blocks out of the
  way!"): a block counts the first time the moving shield pushes it, or a
  block a push set moving knocks it, never one that only met a still shield.
  "Whoosh!" is three different blocks counted within 0.8 s of one push. It
  pays no coins (coins come from the chest and the road only). **Each
  child's best is blocks pushed** (Beat Your Best: "Your best: 23!", "A new
  best!", "3 away!" within 10, "New best!" once in play, Home's "Best" tag).
- **One level, and no buddy, for now.** Levels inside games and play as
  your buddy came after Rise Up was built: it plays Level 1 only (it is not
  in `PLAY_LEVEL_LINES`) until Travis has played it, and the balloon has no
  basket for a buddy to ride in. Both are his to ask for.
- **Its pictures are painted** (`tools/art/game-sprites.json`, cut by
  `tools/art/cut-rise.py`): three skies, the balloon, the shield, four blocks
  and Home's card; each has a drawn stand-in if it fails to load. Its sounds
  are Sona's chimes only, so in the app they play as media.
- **Travis plays it before it ships**; the speeds, the breeze, the finale and
  the words are his to change, and a spoken how-to (Sound Sprint has one) is
  his call. `tests/risetest.mjs` plays a whole climb, the new-life card, the
  best, a turned screen, and on a fake clock a round nobody touches and one
  with the shield parked over the balloon.

**Beat Your Best: each child's own best in a game** (Travis, 1-2 Oct 2026:
"whatever you think is best for kids you can do"). A game counts ONE real
thing the child's finger did and remembers that child's best. The win card
still says they won, then adds one line; the top button is "Play again"; and
Home's picture of the game carries a small "Best 17". All six round games
keep one (Fruit Slice and Piano Tiles a row, Block Stacker, Sound Sprint and
Flappy Glide their own counts, Rise Up blocks pushed); Hoops and Soccer Goal have none yet, and Dino
Dig gets no number. Level 1's best is `sona.bests.v1`; a game's Level 2 and 3
bests live in `sona.playlevel.v1` (see "Levels inside games"), so a best is
never measured against a level whose top it cannot reach.
- **What binds every game that gets one.** Every ending remains kind; a
  completed finale celebrates a win, and zero hearts ends the round without
  claiming completion. The number on screen never goes
  down during play. It counts the finger, never the voice: nothing grades
  speech, nothing is practice data, and nothing reaches Progress, the week's
  reps, coins, a clinician or the server. No child sees another child's.
  Never "score", "points" or "high score" to a child, and never "you
  missed": under the best is an invitation ("3 away!"). A game never played
  shows nothing. Saying the sound is the best way to go higher, because it
  earns the help (slow keys, Super Slice); the sound itself is never counted.
- **The store** is `Sona.gameBest(key)` and `Sona.gameBestOffer(key, n)` in
  `sona.js` (block `BESTS1`). `gameBest` answers a whole number from 1, or 0
  for a game never played. `gameBestOffer` keeps `n` only when it beats the
  best and answers `{ best, prev, isNew }`: `prev` 0 is a first ever round,
  matching the best is not new, and `best` is never below a valid `n` even
  when the phone cannot save. Only whole numbers 1 to 99,999 and real game
  keys count. One record per child, `sona.bests.v1` in `PER_KID` (`{ tiles:
  { n: 38, at: "2026-10-02" } }`): a brother or sister starts with none, it
  goes when the child is removed, and it rides in a backup. The old
  one-per-phone keys (`sona.best.<game>`) counted the hidden score: they are
  never read and not carried over. Pages ask for the store first
  (`CAN_BEST`), so an older cached `sona.js` still plays the game.
- **Home's tag** (`paintBest` in `today.html`, `.game-best` in
  `crafted-home.css`): a game the child can open shows "Best 17" with the
  app's small star, top left of its picture; the Free / Included badge keeps
  the bottom right. No tag for a game never played, a greyed Premium game or
  a Coming soon game. The card's spoken label adds "Your best: 17." Home
  reads the tags again when it comes back to the front.
- **In the game.** The top-left number is the longest row of this round
  (`rowBest`), not the row they are on, so it never drops; a broken row just
  starts again underneath it. "New best!" pops once a round, the moment the
  row passes the best the child came in with, never on a first ever round;
  the round's own banners wait for it. The best is kept the moment it is
  passed, at each wave or song end, when the phone is locked, on the ✕ and
  at the end.
- **The win card's line** (`bestLine()` in each page): first ever "14 fruit
  in a row. Your best: 14!"; beaten "17 fruit in a row. A new best!"; close
  under "14 fruit in a row. Your best: 17. 3 away!"; more than `AWAY_NEAR`
  (10) under, "5 fruit in a row. Your best: 38." with no gap (a big gap is a
  measure, not a dare); level "The same as your best!". One thing is "1
  fruit", never a row. A round that counted nothing keeps "Good try! Wanna go
  again?" and shows no line. The title carries no number, so the row is the
  only count on the card (Fruit Slice's early-stop title is "I saw the fruit
  fly! So fun!", no longer "I saw 12 fruits fly!").
- **"Play again" on top, "Back home" under it.** Another go is earned the
  way every turn is, back through that game's say-it-five-times page
  (`charge.html?game=…`). The game-to-game "WOOHOO! Next →" is gone from
  all six round games; `micquietgamestest` lists them in `PLAYS_AGAIN`. Fruit Slice
  still calls `Sona.firstGameEnd("slice")`, because asking spends the
  first-game mark.
- **Piano Tiles: notes in a row.** Tiles tapped with none slipping past and
  no wrong key (a tap on a key with no tile there). The row carries on from
  song to song; the top is every note of the four songs (`ROW_TOP`, 52), and
  a child there again is told "That is every note!". A second tap on the key
  just played, within `DOUBLE_MS` (300 ms), is a bounce and does nothing; any
  other empty key still ends the row, so mashing the keys can't build one.
  The row flash is "8 in a row!" and the gold one "GOLDEN NOTE!" with no
  "+3".
- **Fruit Slice: fruit in a row.** Fruit sliced without one hitting the
  ground. A golden fruit is one, the giant watermelon is one, and the row
  carries on from wave to wave. **Super Slice's fruit are extras** (the two
  rules Travis left to us): a fruit thrown while the power lasts adds to the
  row when sliced but never to the wave, so saying the sound no longer ends
  the wave sooner; and nothing that lands while the power lasts, and no
  extra ever, breaks the row or feeds the two-miss help. A wave's 45 seconds
  now count real seconds of play (`wavePlay`), not the clock Super Slice
  slows, so no round runs on: three waves of at most 45 seconds, then the
  giant. Every fifth fruit flashes the row ("5 in a row!"); the quick-slice
  "N COMBO!" and the "+3" are gone.
- **The old five-game run's card** (`?daily=1`; Home never opens it, a saved
  run or a typed address still can) banks the round and moves on as before;
  it says "Great round!" and "On to the next game…", never "+N points!".
- **Rachel's to rule on:** children will say the bare sound more often in a
  round, alone and quickly, because it is the best helper; whether that
  wants a limit. And a child the phone hears poorly earns less help, so
  their number may sit lower.
`tests/besttest.mjs` pins the store, the leaks and Home's tag; `tilestest`
and `slicetest` play each game's row and every line; `superslicetest` plays
the extras through the real earned turn.

**Trophies, coins and the Trophy Road (Travis, 9–11 Oct 2026: "a currency so
they can buy stuff like characters"; "motivated over weeks and months like
Clash Royale").** A child's practice now fills a road of gifts they can see.
- **Trophies follow the honest rep** (TROPHY1, `sona.trophy.v1`, per child):
  a practice try (a miss the same as a pass), an accepted game ask or an
  accepted book word. **A day at the goal is always 30 trophies, whatever the
  goal**: a family goal of 100 earns no more, a speech therapist's 10 a day no
  less (at the default goal of 30, one trophy a rep). They are never spent and
  never lost; the ledger pays only the difference from what today already
  paid, so nothing pays twice (a goal lowered on Progress that fills today
  pays the day at once, from reps already said). "Reset progress" leaves
  them. A child already on Sona started with what their reps since 21 Sep
  2026 earned; a restore that brings history but no trophy record counts
  them again from the history then on the phone. Silence, a
  tap, a page load, a best, a heart or an arcade score earns nothing.
- **Coins come from two places only** (COIN3, CHEST1): the **daily chest**
  (`sona.chest.v1`: once, on a day the daily goal is met; 10 coins, every
  fifth a Big Chest of 25 and a sticker; a skipped day piles up nothing) and
  **gifts on the road and the month's path**. The arcade end cards, the daily
  run, Coach Call, the story and the reps mint no longer pay coins; balances
  from before are kept (and now show). **Coins are never sold**: no coin
  product, ever, in `IAP_PRODUCTS`. The wallet refuses junk amounts.
- **The road** (ROAD1, `sona.road.v1`): numbered stops by lifetime trophies
  across five lands (Sunny Meadow, Beach Bay, Snowy Peak, Under the Sea,
  Starry Sky, then the Champion Trail's bonus stops every 150). The table is
  `ROAD_STOPS` in `sona.js`; stop 3 (150) and stop 10 (750) celebrate Level 2
  and Level 3, which the trophy count itself opens. An item a child already
  owns pays coins instead (`ROAD_ALT`: a buddy 100, a hat 50, a place 80).
  **The road's own items** (four buddies, Hops the frog at 750, Pebble the
  penguin at 1,350, Sunny the lion at 2,100, Luna the unicorn at 3,000; three
  hats, the Sun hat, the Star clip and Headphones; two places, Snow and Under
  the sea) are on their stops since their painted art landed (11 Oct 2026),
  and only there: never for coins. A road item joins a stop only with its art
  on disk. Before it landed, stops 6, 12, 15, 19 and 25 paid their item's
  worth in coins; **an item listed on a stop after a child opened it is still
  given, once** (`roadSettle`), and the coins already paid stay, with no
  coins a second time.
- **"October path"** (MONTH1): eight steps by this calendar month's trophies,
  named for the month, coins kept small and four stickers. **Only the road
  page settles a month** (`roadSettle()` on its load and when it comes back
  to the front, never Home): every
  ended month since `MONTH_SINCE` ("2026-10") hands its reached, unopened
  steps to the wallet once, and the page says so in one line ("Your October
  gifts are in your wallet!"), shown once. Nothing says "missed".
- **Nothing random, no timers, every gift shown before it opens.** A chest
  takes three taps ("Tap, tap!", "One more tap!") and shows each gift in turn.
  No countdown, no "ends in", no rarity word, and no money price (no $ or
  other currency) on any kid page; coin costs appear only in the Buddy Shop.
- **The road page** (`road.html`, `crafted-road.css`): the land and the
  child's buddy, the next gift filling up, "Open next" when gifts wait,
  today's chest, the month's path, the stops (from the lowest one waiting, so
  a child whose history passed twenty stops sees them all), "Game levels",
  and links to the Buddy Shop and the sticker book (which now shows no count:
  "Your stickers"). Silent but the tap and reward chimes. Its events ("chest
  opened", "road gift opened", "month gift opened") are sent by `sona.js` and
  carry nothing: no stop or step number (a stop is a lifetime trophy count),
  no coins.
- **Home's gift button** (`#giftBtn`, in the top bar since 23 Oct 2026,
  FOUND1; it replaced the Trophy Road card under the doors and the reps count
  in the corner): a ring filling toward today's goal (the goal is what opens
  today's chest) and a teal dot when the chest is ready or a gift waits; the
  words are in its label ("Trophy Road. 12 of 30 reps today. A gift is
  waiting."). Its picture is the road's own painted chest
  (`road-chest.webp`), never the drawn kit's orange gift: orange on a
  child's screen means only the practice sound's letters. It only reads
  `Sona.dayGoal()` and `Sona.roadState()`; a tap goes to the road, with no
  grown-ups check.
- **Test seeds may set `sona.trophy.v1` directly** (`{v:1, t, d, dn, m, mn}`)
  rather than replay weeks of reps. `trophytest` pins the economy (no browser);
  `roadtest` plays Home's gift button, the road page and the sticker book.
- **For Rachel:** a try counts toward the goal, and so earns trophies, even
  when Apple's listener heard a clearly different word ("taco"); whether it
  should is hers. **For Travis and Rachel:** a little one who only plays Feed
  Echo and Bubble Pop needs six rounds to open the chest at the default goal.

**The daily adventure (QUEST1, 13 Oct 2026)** (Travis: "go build the daily
adventure", a 14-day run of one game a day with a little story). **Since 22
Oct 2026 the stories come first** (STORY1, above): the same scheduler shows
Home's big card a story while one is left, for every child, and this game of
the day after the last one, or on a phone that cannot buy without Premium.
On a game day the card (`#questCard`, under "Today's adventure") shows the
game's name, one line from Echo's world ("The wind blew Echo's tower down.
Help him build it back up!"), the game's own painted Home picture and the
teal play button. **The "Day N of 14" counter is gone**, so that after Day 3
of the story no child sees "Day 1 of 14"; the child's place in the 14 days
(`i`) is never moved by a story. A tap is that game card's own tap (`launch`:
access, the price, "Pick a level").
- **One list per age group** (`QUEST_DAYS` in `sona.js`): ages 5-8 the nine
  big-kid games (Rise Up on day 11 since 14 Oct 2026), never the same game
  two days running; ages 3-4 Feed Echo
  and Bubble Pop in turn (`playStyle()`). After day 14 it starts at day 1.
- **A round of today's game finishes the day**, won or lost, from the game's
  end card (`Sona.questEnd(key)`, in the six round games' `endRound`, Feed
  Echo's end and `sayplay.js`'s `showEnd`; `questtest` fails if a game on the
  list has no way to finish its day). Another game finishes nothing, and a
  day finishes once. The game is played exactly as it always is: the
  adventure only picks the game and says why.
- **The gift is a sticker, the next one** (`awardNextSticker`; two on days 7
  and 14), never coins (COIN3), with a quiet note for five seconds, no voice.
- **A missed day loses nothing**: the adventure waits on its day, moves on
  once a quest is done and never twice in a calendar day. A done game day
  shows "All done for today!" and "Come back tomorrow for a new adventure!"
  ("…for Day N and a new game!" when tomorrow is a story the child can
  open, "…for Day N!" when it is shown locked) with tomorrow's picture dark,
  never playable early. No timer, no countdown, nothing random.
- **A family without Premium is never sent to a locked game**: a day whose
  game this phone cannot open borrows the next open game in the list, with
  that game's own line (`QUEST_LINE`). A story is the one exception, on
  purpose: where Sona can sell, it is shown locked and its tap opens the
  price (STORY1).
- **Home only reads** (`questToday()`, which always answers a `kind`,
  "story" or "game"), as roadtest and trophytest require. Per child
  (`sona.quest.v1`, `PER_KID`); every save merges into the record, which also
  holds the stories' fields (STORY1). The event "adventure day done" carries
  the game key only.
- **Defaults Travis did not pick:** stickers rather than coins, waiting on a
  missed day, restarting after 14, a lost round counting, and the games'
  Home pictures rather than new art. **For Rachel:** the 28 lines say
  nothing about how to talk; whether a story should ever name a sound is hers.
`tests/questtest.mjs` plays the game days, `storycoretest` the stories in
front of them.

**Levels inside games (LEVELS1, Travis, 9 Oct 2026: "kids see games and
levels but have to unlock them"; he chose levels inside games, not locked
games).** Every game opens exactly as before (access, Premium, the trial and
Coming soon are untouched); inside nine of them Level 2 opens at **150
trophies** (five goal days) and Level 3 at **750**, for every game at once,
per child (`sona.playlevel.v1`). Feed Echo keeps one level until Rachel says;
a parked game has none.
- **One tap still plays.** The first tap on a game after a new level opens
  shows "Pick a level" for that game, once (`playLevelAsk`); every tap after
  plays the level last picked. The road page's "Game levels" changes it. A
  card playing Level 2 or 3 carries a small numeral and pips. (A grown-up's
  "Level 1 only" in Settings went on 22 Oct 2026 with the Settings
  simplification; a cap saved before is ignored on read, since it rides in
  backups, and `setPlayLevelCap` is gone.)
- **Level 1 is today's game, byte for byte:** each page keeps its Level 1
  tables and best lines on their own lines and overrides after them.
- **Finger play only.** A level never changes what a child says or how often,
  the say-it card, the hearts, the sound powers, `CHARGE_NEED`, `ROT_LEN`,
  `SOUND_NORM` or the speech ladder. **Every help path reads Level 1's
  numbers**: once a help starts (the two-miss help, "every ball ends in a
  basket", where the hoop and Bo move as at Level 1 from the first miss, Dino
  Dig's glow and crumble, Bubble Pop's touch-anywhere, the safe landing), the
  game is no harder than Level 1. `levelstest` and
  `levelsplaytest` hold each help value equal at all three levels.
- **Bests per level:** Level 1's stays Beat Your Best's; Level 2 and 3 keep
  their own, so a best is never measured against a level whose top it cannot
  reach.
- **Never sold, never on a grey card:** Premium opens every game, not the
  levels inside them (the Terms say so). "level played" is sent by the game
  page, once a load at Level 2 or 3, never by Home.

**The Buddy Shop and the kept buddies (SHOP1, OWN1, 11 Oct 2026)** (Travis,
9 Oct 2026: "a currency so they can buy stuff like characters"). The buddy
screen (`customize.html`, reached from Home's buddy and the Trophy Road's
Buddy Shop link; Settings' Buddy & world card went on 22 Oct 2026) is the
Buddy Shop: buddies, hats and places.
- **Who keeps what.** `_keepBuddies()`, a one-shot sweep in
  `_keepFreeVersion`'s shape, runs right after it on load: a device already
  set up on its first load of this build is stamped `sona.buddyset.v1`
  "kept" **and every set-up child's `profile.owned` gets the whole legacy
  set** (`LEGACY_SET`: the eight buddies, seven hats and six places every
  family could pick on 11 Oct 2026); a device not set up yet is stamped
  "post" and a new family starts with the starters (Pip the fox, Miso the
  bunny, Bao the panda, no hat, the sky). The stamp is on `NO_IMPORT` (true of
  the device); the list rides in the profile, so a backup carries it to a new
  phone or into the iPhone app, which stamps "post" on its own first load.
  `importData` also writes the legacy set into every set-up child's profile
  when the backup says "kept" or carries no stamp at all (made before the
  shop): the Terms promise a backup never takes away an item a child already
  has. A backup stamped "post" brings only its own list. `addKid` writes
  the legacy set into a new child's profile on a kept device, as it copies
  `earlyAdopter`. It reads no other sweep's stamp. **Preserve it
  like the free-era sweeps: never clean it up, never re-run it.**
- **Ownership** is `Sona.owns(kind, id)`: a starter, what the child is
  wearing, the kept household's promise, or the child's own list. Every
  catalog entry carries `source` ("starter", "shop" or "road") and `cost`;
  the prices are the catalog's (buddies 100–150, hats 40–150, places 80–250,
  `sona.js`), never a page's. New items join only with their painted art; a
  kept household can buy only what came after the sweep (today the Flower
  crown, 150, and Candy land, 250). Every hat is painted (`OUTFITS[i].art`,
  `hat-<id>.webp`), each with its own place on the preview's badge
  (`#heroOutfit.painted` in `crafted-customize.css`); the page's drawn hats
  stay only for a phone holding an older `sona.js`.
- **Getting one.** A tap on anything not owned tries it on the preview;
  only "Get it", held for a second (a keyboard or switch press confirms at
  once), spends the coins (`Sona.buyItem`: the coins first, then the item,
  then it is worn), with "Oops? Give it back" for ten seconds
  (`Sona.undoBuy`, never more than the catalog price). A child without enough
  coins sees "Open chests to earn coins!"; a Trophy Road item shows its
  trophies and "Find it on the Trophy Road!". No dialogs, no voice, no price
  sign and no "buy" in a child's words; no confetti under Reduce Motion.
  `sona.js` sends "shop item got" (the kind, the item and its coin price,
  never a balance). "Reset progress" in Settings says it keeps trophies,
  buddies and stickers (it resets the practice steps and the coins).
- **Setup's hidden buddy step** offers only the buddies the family has (the
  starters on a new phone).
`trophytest` pins the sweep, the prices, buying and giving back (no
browser); `shoptest` plays the shop for a kept and a new family.

**Play as your buddy (BUDDY2, 11 Oct 2026)** (Travis, 9 Oct 2026: "a
currency so they can buy stuff like characters, and they actually BE the
character in the game"). The buddy a child picked is in eight of the ten
games, in painted poses, and every placement keeps that game's rules.
- **One list of pictures:** `BUDDY_ART` in `sona.js` (block BUDDY2, beside
  `CHARACTERS`), read through `Sona.buddySprite(id, pose)` and
  `Sona.buddyId()` ("leo" or anything unknown is the fox). The poses: **run**
  (seen from behind, Sound Sprint; the fox's is the crop of
  `fox-runner.webp` at 390, 205, 480, 840, every other buddy's a file already
  cut to that 480x840 frame), **rest** and **cheer** (standing, like Echo's
  welcome and cheer, swapped the way his are), **peek** (over Fruit Slice's
  counter) and **sit** (on Block Stacker's bench). How each was drawn, cut and
  checked, and the placement numbers, are in
  `design/crafted-world/buddies-v3.md`. A buddy, or a pose, ships only with
  its painted art (no stand-ins).
- **The fallback order:** the pose, then its fallback pose (cheer and sit
  fall back to rest), then the round badge clipped to a circle, then the flat
  sticker (with `xmlns` added), then a plain dot. `crafted-buddies.js` holds
  the page helpers: `image`, `drawCircle`, `svgSrc`, and `stand` for a buddy
  beside Echo (it fetches and holds the cheer picture as the page opens; a
  cheer that won't load leaves the buddy standing, never its badge). A
  picture that won't load falls to the next: a runner to the badge (on the
  start card too), a peek to the badge on the same ledge, a badge for the
  rocket's porthole to the old rocket. Every caller checks a helper exists
  first, so a phone holding an older file still plays.
- **Where it is:** Sound Sprint runs as the buddy's runner (and the start
  card's lane shows it); Flappy Glide carries its badge in the basket,
  clipped round, the fox's too; Fruit Slice: it peeks over the counter where
  the fox did; Block Stacker: it sits on the bench where the fox sat and rides
  in the finale rocket, its badge clipped into the porthole; Hoops, Soccer
  Goal and Dino Dig: it stands opposite Echo and hops with him; Feed Echo: it
  watches beside Echo, behind the plate, and hops on each right feed (Echo is
  still the one fed). Every buddy picture is decoration: `alt=""`,
  `aria-hidden`, no finger, never on a playable part.
- **A fox child keeps today's Fruit Slice and Block Stacker pictures.** The
  fox is painted into `fruit-stand.webp` and `stack-workshop-v2.webp`, and
  Echo into `stack-rocket-v2.webp`: for the fox nothing changes, not a picture
  and not a rule that applies. Any other buddy gets the same scene without the
  fox (`fruit-stand-v2.webp`, `stack-workshop-v3.webp`, `stack-rocket-v3.webp`
  with an empty porthole: identical outside the fox's box, so the ledge and
  the fruit wells hold) through `body.buddy-scene`; a scene that will not load
  puts the old one back.
- **The engines' Echo cheer block never runs on the buddy.** `hoops.js`,
  `soccer.js` and `dino.js` swap Echo's own pictures on a basket, goal or
  bone; the buddy has its own `cheerBuddy`, with the pictures the page hands
  over through `setBuddy({rest, cheer})` (paths only; the engines still read
  no storage).
- **Bubble Pop and Piano Tiles are unchanged:** Echo floats up in Bubble
  Pop's giant bubble, and nothing may sit on the piano's lanes. Hats in games,
  places as game skies and buddies in the parked games are later.
`tests/buddyplaytest.mjs` plays every placement for a fox and a dragon child,
the fallbacks, the cheer swap, and the fit at 320 and 390 px.

**The Practice Board (BOARD1, BOARD2; Travis, 9 Oct 2026: "a board of every
kid in Sona … days practiced"). DARK UNTIL TRAVIS'S GO.** Built in full on 11
Oct 2026 and switched off: the server is `lib/board.ts` and nine routes under
`app/api/board/`, the phone's half is block BOARD2 in `sona.js`, the Settings
card and `board.html`. **`BOARD_LIVE = false` in `public/sona.js` and in
`lib/board.ts`**, pinned equal by `boardapitest`. While it is off a family
sees nothing new and the phone sends nothing but a deletion still owed: the
Settings card is hidden (except "Remove {Name} from the Practice Board" while
an entry is still on the phone), the road's board link is hidden, `board.html`
says "The Practice Board is off.", and every route but `leave`, `remove` and
`admin` answers 503 (`{off:true}`; the email's confirm link, a page saying
it is off right now). It was built before a lawyer looked (the
lead's call; the spec asked for one first): the lawyer's answer on the consent
method still comes before the go, and a stronger method than the email (a
card check, say) changes the request shapes, the keys, the privacy text and
the tests first. Whether to switch it on is Travis's, after that.
- **What it is.** One monthly board of the Sona kids whose grown-up turned it
  on, counting **goal days**: a day with the daily goal's stamp
  (`sona.goaldays.v1`) and at least `BOARD_MIN_REPS` (10) reps, so practice,
  games and books all count, as Progress already tells parents (the 10 is
  Rachel's to confirm). The top ten places and the child's own entry; ties
  share a place, and a tie too long to list is one line ("+38 more kids with
  11 days"). Other children's counts are a snapshot taken once a UTC day, so
  nobody can watch when another child practiced; the child's own count is
  live. A sun a day on the child's own card, medals for 1-3; never totals,
  arrows, "behind", streaks or red. **Nicknames are the server's**
  ("Brave Fox 42": 32 adjectives, 32 animals, 86 numbers; `NICK_BLOCK` for
  any pair a reviewer rejects). A child never types anything, and a nickname
  is never shown beside a real name.
- **Turning it on: one email for the household, with a code.** Settings ›
  Practice Board › Learn more (Settings is behind the grown-ups check) asks
  once per phone "Did a speech therapist or a school send you to Sona?" (the
  answer stays on the phone, `sona.boardask.v1`; "Yes" keeps the board off),
  then a sheet with a box per child who may join and an email box. The server
  keeps a pending request (48 hours) and a hash of a confirm secret that only
  the email carries; it hands the address to Resend once and keeps only a
  one-day scrambled form (an HMAC with the day inside), at most two emails an
  address a day (a "+tag", and Gmail's dots, are the same address; one past
  its two never counts toward the rest) and 300 a day in all. The email's
  confirm link needs a button
  press (a mail scanner's GET confirms nothing), the phone's own `pend` can
  never confirm, and the email's **remove link** deletes the entries from any
  device, even after the phone is lost. "Finish" (also tried when Settings
  comes back to the front) claims the members: one atomic script, safe to
  repeat. Nothing on the phone says "on" before the server has answered.
  **It does not prove a parent:** a child who can read, on an iPad with the
  grown-up's Mail open, could tap the button. It raises the bar above the four
  number words; that is all.
- **Who can't** (`boardAllowed(slot)`, read for the child the line is about):
  "off"; "clinic" (a clinician's link on the phone, `sona.slp`, `sona.slpok`,
  `sona.slpunlock` or `sona.slpticket`; an SLP profile; this child sharing
  progress; or "Yes" to the therapist question); "many" (more than four
  children on the phone); "young" (not a whole age of 5 or more: ages 3 and 4
  never see it, Rachel's to confirm). Checked at join, at every send and at
  every view; a child who stops being allowed leaves by themselves.
- **The server counts, never the phone.** The phone says only "this child met
  the goal so many seconds ago" (`{token, ago, tz, buddy}`); the server works
  out the day by its own clock, in the time zone the family joined from, and
  counts it once (a `SET NX` inside the day script). **The server can't prove
  a child spoke (no audio ever leaves the phone); it can promise each day
  once, a day late at most, never early.** Only today and yesterday, nothing
  before joining, and never more days this month than have passed since
  joining (the ceiling). The time zone moves at most 2 hours from where the
  family joined, at most once in 20 hours, and only on a counted day. A phone
  clock change, a pasted backup or backdating adds nothing; someone scripting
  the routes could mark one day per real day, which at most ties a child who
  met the goal every day; a forged backup can make one real rep finish
  today's goal day on that phone.
- **Keys.** On the phone: `sona.board.v1` and `sona.boardcache.v1` per child
  (`PER_KID`); `sona.boardpend.v1`, `sona.boardleave.v1` (deletions still to
  send) and `sona.boardask.v1` for the phone. All five are on `NO_EXPORT` and
  `NO_IMPORT`: a backup never carries a board entry (the Move box says to turn
  it off on the old phone first). On the server, the prefix is `board:` in
  production and `board-pv:` everywhere else (`boardEnv()` fails closed to
  production), so a preview sharing production's Upstash never touches the
  real board: `pend:` 48 hours; `mem:`, `nick:` and `rid:` (the remove link's
  record) 100 days from joining, started again only by a counted day;
  `m:<month>` until 8 days after the month ends; snapshots and per-day
  counters 2 days; ticks 3 days; the scrambled address 1 day; the daily join
  count 15 days (no one in it). The board's rate-limit buckets hold an HMAC
  of the address, never the address, for an hour at most. Every write is one Lua
  script that first checks its key still exists and sets its own time limit;
  a KV error answers 503 `{retry}`, never "already done", and the phone keeps
  what it owes. Nothing stores a name, age, sound, audio, fid, childId,
  clinician code, address or raw IP, and no key starts with `reps:`.
- **Deleting always works, live, paused or off:** "Turn off" in Settings,
  removing the child, a restore that changes which child sits in a slot,
  becoming ineligible, the email's remove link, and founder removal
  (`/api/board/admin`, behind `FOUNDER_KEY`, for an email to
  privacy@speaksona.com). The phone queues a deletion first, then sends it
  from Settings, the road page, the board page and (at most once a minute)
  every rep on a practice or game page; never from Home, which calls nothing
  of the board. `BOARD_PAUSE=1` stops only `start`, `claim`, `view` and
  `nick`: days still count and deletions still happen. "Reset progress" does
  not touch the board.
- **Never the clinician side.** `slp.html`, `app/api/slp/**`, `sendProgress`,
  `/api/homework`, `/api/pilot` and `reps:<week>` gain nothing, and
  `/api/reps` stays 410 (the dashboard rule above: no leaderboard there).
  Events: "board turned on", "board turned off", "board viewed", with no
  props; never a token, nickname, days or place.
- **The words already true in both states:** the privacy page's "The Practice
  Board (only if a grown-up turns it on)" ("Sona may offer…"), Progress's
  line under the sharing buttons (kept out of "How scoring works", whose
  "Reviewed by Rachel" covers only what she reviewed), the parents' "What's
  stored" answer and the clinician setup step all speak of it as something
  Sona may offer, never as something a family can turn on today
  (`boardapitest` holds them to that). The
  clinician's step says only that it stays off on any phone holding their
  link: none of their families can be on it.
- **How to turn it on** (its own PR, only on Travis's go, after a lawyer has
  named the consent method):
  1. flip `BOARD_LIVE` to `true` in **both** `public/sona.js` and
     `lib/board.ts` (`boardapitest` fails if they differ);
  2. set `BOARD_SECRET` in Vercel (a long random value; without it every
     route answers 503). To rotate it later, move the old value to
     `BOARD_SECRET_PREV`, so no phone's token stops working;
  3. add the Terms' "Practice Board" section and the for-slps "What's stored"
     board line ("…You never see the board and it never appears in your
     dashboard…"), both written in the spec (§14.4, §14.5);
  4. NATIVE.md and App Store Connect: App Privacy *Identifiers → User ID*
     (the random board number) and *Usage Data → Product Interaction* (goal
     days, board on only), purpose App Functionality, not tracking ("linked to
     the user" is Travis's call; the careful answer is yes); re-answer the
     age-rating questions (no user-generated content, no chat: the server
     makes the nicknames); the review note "Off by default; a grown-up
     confirms by email; server-assigned nicknames; no free text";
  5. check that Resend's open and click tracking are off for the sending
     domain (the email promises no tracking pixel; a Resend setting, not
     code), and note "Resend open and click tracking" in NATIVE.md;
  6. run `boardapitest` (its go-live pin then requires the privacy, Terms,
     for-slps and NATIVE.md copy), `boardtest` and the full battery.
  To try it before then: on localhost, `sessionStorage` `sona.boardpreview.v1`
  = "1" turns the phone's half on, and `BOARD_FORCE_LIVE=1` turns a local or
  preview server's on (never production's, and only under `board-pv:`).
`boardapitest` plays every route against an in-memory Upstash (or a real
Redis, with `BOARD_REDIS_SERVER`); `boardtest` plays the phone's half, the
Settings card and `board.html`.

Peekaboo is open since 22 Oct 2026, a Premium game on Home with the other
seventeen rebuilt games (it had no card from 19 Oct); since 16 Oct 2026 it is
a played game on `sayplay.js` (see "The eighteen rebuilt by Codex"), and
`simple-play.js` remains in the repo for its tests. **Bubble Pop is back** (Travis, 30 Sep
2026), free, the second game for ages 3-4 beside Feed Echo (rebuilt on 1 Oct
2026; see "Bubble Pop is rebuilt to be played"): a full-width Home card like
Feed Echo's
(`crafted-home.css`), no release date so no New shelf, and a website tile
cut from that painted card (`/assets/site/games/bubbles.webp`). The adventure
(`story.html`) and chapter readers are still parked: their engines and tests
stay, but no public menu opens them, and the bookshelf hides its adventure tile.
The existing practice, honest-rep, rotation and earned arcade-turn rules
still apply after a child chooses an available game.

## The look: the family's redesign brief (28 Sep 2026)
The family sent a brief for a designer (ChatGPT) to redraw the whole app as
"a crafted little world" of soft clay toys. **The new art has not arrived.**
Build behaviour and layout so each picture drops in later; never invent art
to stand in for it. What was buildable was built on 28 Sep:
- **Teal, cream and orange.** Main buttons and the mic are teal; second
  choices are cream pills; no bright green button anywhere (the family named
  the green GO). The tokens live once, in `public/action.css`; `sona.css`,
  `sayplay.css` and `simple-play.css` `@import` it first, and the books,
  chapter/story pages, Feed Echo, Hoops and the Say & Play pages link it. The
  crafted pages (the six round games and the practice page `charge.html`)
  take their colours from `public/crafted-*.css` instead (see "The app's look
  is the crafted world"); where a crafted sheet repaints one of our rules, the
  crafted one wins, and our rule must add nothing that shows through (a teal
  text-shadow under the crafted cream "Share this week" button once did). Never paste the hex values into a page: a page that loses
  the tokens shows white text on nothing, and the values will change when the
  designer's STYLE.md arrives. `tests/loadtest.mjs` section 5 accepts either
  teal and bans, over both, Duolingo green and orange on a kid button or mic,
  pressed or not. It judges teal by hue and cream as a light warm colour, so a
  new value from the designer needs no test edit; for a crafted page it asks
  the browser what a child sees, at rest and pressed.
- **Orange means only the practice sound's letters** (the r in "rabbit").
  Show a practice word through `Sona.soundMark(text, sound, pos)`: escaped
  HTML with the letters that make the sound in `<b class="snd">`. When it
  can't prove which letters make the sound it colours the whole word, because
  a cue on the wrong letter is worse than none; a doubled letter is one sound.
  Which letters count is Rachel's call. `tests/soundmarktest.mjs` runs every
  bank word; `SOUNDMARK_TABLE=<file>` writes her review table.
- **The practice page is the crafted one** (`crafted-games.css` /
  `crafted-practice.css`). The target in Echo's bubble (`#bTarget`) marks only
  the practice sound's letters through `Sona.soundMark`, in the crafted
  practice orange, the rest of the word in the bubble's ink; a bare sound like
  "rrrr" is orange whole, and in a sentence only the practice word is marked.
  `paintCard()` stays self-contained (`voicetest3` runs its source), and the
  mic stays a status (`role=img` DIV).
- **The six round games wear the crafted cards.** The say-it card keeps the
  round's own title ("Say “rrrr” for wave 2!"); only its quoted sound's
  letters are orange (`Sona.soundMark`). A miss never opens it
  (`micquietgamestest`). The end card's count names real things, never the
  score (a golden fruit or tile scores 3 and the giant's cuts score 5): Fruit
  Slice counts fruit in a row and Piano Tiles notes in a row, each beside the
  child's own best in that same thing (see "Beat Your Best"; the old "Best"
  was the hidden score, which is why it was taken off). Block Stacker (blocks
  in a row), Sound Sprint (metres) and Flappy Glide (gaps in a row) count
  their own thing beside that child's best too.
- **Say & Play and Feed Echo** show the word with only the sound's letters
  orange (`Sona.soundMark`) beside the crafted picture. Feed's ask keeps ONE
  `<b>`, the word itself, with the letters in a `<span class="snd">` inside it,
  because `craftedarttest` reads the asked word by `#bMain b`.

- **Echo's clay poses** (Travis's ChatGPT art, 29 Sep 2026; originals in
  `design/crafted-world/echo-2026-09-29/`). Six 512px transparent WebPs in
  `public/assets/crafted/`, one per thing Echo is doing: `echo-welcome`
  (resting, headers, brand marks), `echo-talk` (he is speaking: reading a
  page, modelling the word, an instruction), `echo-wave` (asking the child to
  have a go: "Can you say…?"), `echo-listen` (the mic is open), `echo-think`
  ("Almost!", a gentle try-again, can't hear you, paused) and `echo-cheer` (a
  heard word, a page turned, every end card). A page that swaps poses keeps
  its preloads in a variable (an unheld `new Image()` is thrown away and the
  swap loads late) and falls back to `echo-welcome.webp` on error. The old
  flat `/coach/echo/*.svg` remain only on parked or clinician pages.

## Talking to Sona: messages, never calls
**No call requests** (Travis, 30 Sep 2026: "I don't want request to call to be
an option. Rachel doesn't want to talk to people on the phone"). "Talk to us"
(`talk.html`, the grown-ups' tab) and "Talk to Rachel" (the clinician
dashboard) take written feedback only: no call tab, no "I'd love to talk"
link, no time or time zone asked. Both routes (`/api/family/feedback`,
`/api/slp/feedback`) refuse `kind: "call"` in words ("We don't take call
requests. Send us a message, and we'll reply by email.") and keep nothing, so
a page left open from before can't book one either. Old call requests still
show on `/leads.html`. A limited "ask Rachel" chat (WhatsApp, or messages in
the app) is a later idea, not built; it is Rachel's to shape.

## Hard rules
- Merges to main/prod only on Travis's explicit go ("merge").
- **No audio ever leaves the device.** There is no cloud scorer: every verdict
  is decided on the phone from the spectral shape of what was said. One clip a
  day may be kept in local IndexedDB so a parent can listen back — it is never
  uploaded. The consent copy says exactly this, and it is true because there is
  no mechanism to break it, not because a checkbox is off. Its short form, the
  grown-ups line on every mic ask (`MIC_PROMISE`), is "audio is never
  uploaded. One try a day is saved on this phone so you can listen back."
  (Travis, 2 Oct 2026, asked for "audio is never recorded or uploaded"):
  never "never recorded", which that one saved try would make false. `mictest` pins the
  mechanism's absence: no route but the two founder clip tools (`isolate`,
  `voice-change`, behind `FOUNDER_KEY`) accepts a file, and no family page
  posts to one. `/api/stt` was deleted on 25 Sep 2026 for exactly this.
  **Nor the browser's own speech-to-text** (22 Oct 2026): the Web Speech
  API's `SpeechRecognition` looks local and is not (Chrome sends the audio
  to Google, Safari to Apple). The Speech Check and the parked story reader
  used it, so in a browser a child's words left the phone; both now judge
  from voicing alone, `lib/speech.ts` is gone, and `mictest` fails if any
  page uses it again. The iPhone app's on-device check is SonaSpeech, which
  never uses Apple's servers. **For Rachel:** without it the Speech Check
  hears only whether each word was said, never how, so its results now say
  "Heard it" per word and "We heard <Name> say N of M words … it can't tell
  which sounds need practice", with no "on track", "ready to practice" or
  age verdict (its old paths stay in the code, unreachable). It is `noindex`
  and nothing links to it. Whether it stays, and what its results may say,
  is hers.
- No silence counted as reps; voice boosts never logged as SLP data.
- Never rewrite pushed git history. Push after every verified milestone.
- A child's name never leaves the device to any CRM, ad pixel or analytics
  payload. Progress leaves only with a grown-up's explicit consent, and
  never as audio.
- Run the full battery (`node tests/run-all.mjs`) before every push.

## Clinical rules (Rachel owns these)
The app must not teach a child something an SLP would have to undo. These
are enforced in code and pinned by tests — change them only on Rachel's say-so.

- **One target, said in isolation, before anything else.** Never glue a
  carrier phrase onto a practice word. "a rain" and "one robot" shipped once
  because a rotating carrier was applied blindly to the whole word bank; a
  child was being shown ungrammatical English to imitate. Sentences may be
  sentences; single words stay single words.
- **Silence is never a rep.** A rep requires detected voicing. A round that
  advances on a timer teaches a child that not talking works.
- **End every speech-practice round on a success.** Step the target down
  rather than let a child fail out of speaking — the last thing they do is
  the thing they remember. An arcade round can end at zero gameplay hearts
  under Travis's 4 Oct rule; it never marks the child's speech as a loss.
- **Developmental order is real.** Sounds are gated by `SOUND_NORM` (the age
  a sound is typically acquired). Do not offer a 4-year-old /r/ drills
  because the parent picked it.
- **Nothing in the app is an evaluation.** No grades, no diagnosis, no
  "score" a parent could mistake for an assessment. Parent-facing summaries
  carry the practice-snapshot hedge and Rachel's byline.
- **What the accuracy number now means — Rachel to confirm.** With the cloud
  scorer gone, pass/fail comes from an on-device spectral check: it asks "did
  that sound like this sound", not "was that word correct". Any percentage
  shown to a parent or an SLP is built on that narrower signal. Rachel decides
  whether it should still be shown as a percentage, softened, or dropped.
- **Apple's listening check: in the ballpark, never "taco"** (Travis, 28 Sep
  2026: "I just don't want kids saying taco and getting a correct score. We
  want them to be in the ballpark"). In the iPhone app the practice page asks
  Apple's on-device recognizer what was said (SonaSpeech, never Apple's
  servers) and `hearVerdict` in sona.js decides. Pass: the word or a close
  try (each sound's typical errors, `HEAR_SUBS`: "wabbit", "wed", "cah"; or a
  letter or two off with the sound intact: "rainy", "parrot" for carrot), and
  nothing else. A different word does not count, even one starting with the
  sound (Travis: "ideally the exact / close word"; not "run" for rain). On a
  bare-sound round only a short sound or mostly the sound itself counts
  ("Er", "Rrrr"), never a word that merely has it. Fail: clear words that
  are none of those ("taco", "poop", "fridge", "Here is a taco", "sock" for
  rock). Unknown, handed to the sound-shape check: nothing clear (filler like
  "uh", or only the sentence's own words). A grown-up's "say rabbit" and a sentence's other
  words ("Here is a") are set aside first. The plugin was written in August
  but never reached the app until `scripts/install-ios-speech.py`; the website
  cannot use it and still judges by sound shape. The arcade slowdown turns
  now use it when available; older checkpoint and Feed/Hoops checks remain
  sound-shape based. Which errors count as close (`HEAR_SUBS`) is Rachel's call;
  `heartest` pins the rules.
- **Cueing** — TODO, Rachel to specify. Her highest-value ask was the
  "sssoup" prompt: model the target sound stretched and attached to the word
  rather than saying the word cold. Needs her exact wording and which sounds
  it applies to (stretchers vs. poppers) before it ships.
- **Auditory bombardment warm-up** — TODO, Rachel to specify. Hearing the
  target sound many times before producing it. Needs: how many exposures,
  where in the flow, and whether the child responds or only listens.
- **Speech-rate control** — TODO, Rachel to specify. Slowing the model so a
  child has time to plan the motor movement. Needs her target rate and
  whether it changes by age or ladder rung.

- **A double tap never zooms the app** (Travis, 30 Sep 2026: "i double tapped
  the screen and it zoomed in"). Two locks, because an iPhone has two browsers:
  every kid page's viewport meta carries `maximum-scale=1, user-scalable=no`
  (the iOS app's web view obeys it), and since Safari ignores that, sona.js puts
  `*{touch-action:manipulation}` first in <head> on every page that loads it,
  except the clinician dashboard. Settings, Progress, Subscribe, Premium and
  Talk to us keep pinch zoom for parents. A page's own `touch-action:none`
  (Hoops' court, Fruit Slice's board) still wins. `tests/zoomtest.mjs` pins it;
  a new grown-up page that should keep pinch zoom goes in its `GROWNUP` list.
- **Grown-ups goes straight to Settings** (Travis, 30 Sep 2026: "when they
  click parents and put in code i want it to go straight to settings"). Home's
  Grown-ups button opens the grown-up check, then Settings, whose tab bar is
  Progress · Settings · Talk to us. The old three-door pop-up is gone; its plan
  and trial lines now live in Settings > Account.

- **Settings is the minimum** (Travis, 22 Oct 2026: "simplify settings.
  It's too busy. Let's get rid of as much as we possibly can, including like
  we want the minimum viable features"; it was already "short" on 30 Sep).
  Top to bottom: **Your family** (switch, add, remove a child); **one card
  for the child picked** (name, age, sounds to practice, the one
  start-of-word line, and "Reset progress" last); the "Sound is off in Sona."
  line only while muted; the Practice Board card only while it is live or
  owed; **Account** (the plan line with See Premium and Restore, then
  Privacy · Terms); the clinician's "Open dashboard →" only for a
  clinician in a browser; and **"Moving to a new phone?"** at the foot.
  Gone from it: the week-by-week reps card (the daily goal and the rep line
  moved to Progress, beside the days-a-week buttons, with today's count
  under the daily goal; Home's corner is the gift button, to the Trophy
  Road), the game-card picker and the "Level 1 only" picker (saved
  values are ignored, so nobody is stuck: see each one's section), the Buddy
  & world card (the shop is Home's), the play-mode note, the age line, the
  page's subtitle, the divider, "Help" (the Talk to us tab is the same
  page), the backup's "Download file", and the clinician's code, key and
  message (the dashboard has them). **The "Founder key" link shows only
  after the five taps on "Account"** (the mic-numbers taps), on that visit;
  a founder still sees "Founder access ✓". Before adding a control back,
  ask whether a parent needs it here; a saved value with no control left
  must be ignored on read, never left to stick.
  - Reps in one line, on Progress since 22 Oct 2026: "A rep is one time
    <name> says their sound or word out loud, in practice, a game or a
    book. Silence never counts." (`repweektest`.)
  - No volume slider: the phone's side buttons set the level ("why can't we
    just use our phones to adjust volume on the side of our iphone?").
    `getProfile()` plays any saved level above zero at the one normal level,
    0.8; a volume of 0 stays muted, and only then Settings shows "Sound is off
    in Sona." with "Turn sound on". Never bring back a level control: a saved
    level nobody can change is how families got stuck at 30% once.
  - No parent code: the grown-ups check is always four number words (it stays
    for Settings, Progress and Talk to us). Apple wants a check before a buy
    screen only in its Kids category, which Sona is not in, so since 4 Oct
    2026 the offer a grey game or book opens skips it (see "TRIAL FIRST").
  - Focus-sound buttons show a grey "by ~Ny" and nothing else. Nothing in the
    code gates a sound by age, despite "Developmental order is real" below;
    building a real gate is Rachel's call.
  - Backup & restore sits behind a closed "Moving to a new phone?" link at the
    foot of Settings (`#moveBox`, same ids inside). It is still the only way
    practice, and a clinician's link, reaches a new phone or the iPhone app.
- **Practice syllables never spell "gay" or "poo"** (Travis, 30 Sep 2026):
  `syllables()` in `gamecontent.js` swaps them for "guy" and "pie". `soundmap`
  checks a NEVER_SAY list; add to it, never drop a syllable.
- **The word position drives the practice page** (Travis, 30 Sep 2026): the
  word step, the sentence step and the step-down read `Sona.practicePos()`
  (homework position first, then the family's setting); a position with no
  words for that sound falls back to start-of-word words. The games keep
  start-of-word words until Rachel says otherwise (`progtest`, `hwtest`).
  **A family can pick only the start of a word for now** (Travis, 1 Oct 2026:
  "have the options listed but to not let them select other positioning
  because it's not built yet ... make it clear that it's just the initial
  position"). The pilot page lists all six positions; the ones not in
  `FAMILY_POSITIONS` (sona.js, today just `"i"`) are greyed out and say
  "coming soon". Settings hides its picker while only one is open (22 Oct
  2026: it had nothing to choose) and keeps one line under the sounds, "For
  now, Sona practices each sound at the beginning of a word."; a second id
  in that list brings the picker back, the closed ones still greyed. A position a family
  saved before reads as the start of a word. A speech therapist's homework
  still names its own position. Add an id to that list to open one
  (`kidtest`).
- **Child slots are never reused, and a removed child takes their saved tries**
  (`addKid` high-water mark, `removeKid` deletes that slot's clips; a page that
  leaves right after either waits on `Sona.clipsSettled()`).

## Code conventions
- `public/` is static ES5 — no build step, no framework, no bundler. It ships
  to the live site and the iOS shell reads that same site, so a web change is
  a shipped app change with no App Store review.
- `sona.js` is the single source of truth for state, entitlement and content.
  Pages read it; they don't reimplement it. One switch, honoured everywhere —
  when a rule lives in two places it drifts, and drifted rules are how the
  paywall and the free-mode copy ended up contradicting each other.
- Per-child data routes through `load()`/`save()` or `Sona.kkey()`. Anything
  in `PER_KID` that bypasses them is a promise the code doesn't keep.
- Entitlement is never granted from a URL parameter or an unverified page
  load. If a link unlocks something, a server verified it first.
- **In the iPhone app, Echo's voice plays as media, never Web Audio**
  (Travis, 1 Oct 2026: "Sounds not working again on books", with the
  phone-call volume slider on screen). After a page has had the mic open, an
  iPhone plays Web Audio as a call: quiet, and the volume buttons move call
  volume. Web Audio is also silenced by the ring/silent switch. So a voice line
  goes through `Sona.mediaPCM(bytes, {volume})` when `Sona.voiceAsMedia()`
  says so (the app), and falls back to the browser voice when it reports
  "failed". The practice page, Fruit Slice, Feed Echo, the books, the Say &
  Play games and Bubble Pop all do; a new page that speaks does too. The
  browser keeps Web Audio, where a tap unlocks it. `iphonepolishtest` pins it.
  A media element plays through the ring/silent switch, so **on Sona's own mic
  the page turns that off** (15 Oct 2026, "Everything off": see "Sona's own
  microphone in the app" below): Echo's media voice is silent on a silenced
  phone. An App Store build without the plugin plays through it as before.
- **So do Sona's chimes** (2 Oct 2026): the "heard you" chime rings the moment
  the mic closes, exactly when Web Audio is a quiet phone call. `Sona.sfx`
  decides, once, for every page: in the app each chime is written down from
  its own recipe as a short recording and played as a media element (one
  element a chime, the level in the samples, `CHIME_MEDIA` in `sona.js`, set
  without a phone to listen on); a refused element falls back to Web Audio,
  never to silence; a muted Sona plays none; the browser keeps Web Audio. When
  a chime may ring is still each page's own rule (never over a mic). Piano
  Tiles' notes and Bubble Pop's pops are media in their own pages. **Still Web
  Audio in the app:** the sounds Hoops, Soccer Goal, Dino Dig and Fruit Slice
  make themselves (the swish, the kick, the roar, the splat).
- **Sona's own microphone in the app: no phone-call audio** (Travis, 12 Oct
  2026: the volume buttons moving "call volume" and sounds playing with the
  phone on silent, "yeah start building it now"). While a web page captures,
  WebKit switches the whole app to call audio (PlayAndRecord + VideoChat +
  voice processing), and no page setting can stop it. So in an app build
  whose SonaSpeech plugin has `micOpen`, the native side owns the mic
  (AVAudioEngine, `.playAndRecord` + mode `.default`, no hands-free
  Bluetooth) and streams PCM to the page; the NATIVE MIC block in `sona.js`
  (`Sona.micOpen`, `micProbe`, `micSource`, `micRecorder`, `micDeaf`,
  `micStats`) feeds it through an AudioWorklet into the very analysers every
  listening page already reads. Every page keeps its literal getUserMedia as
  the fallback: browsers, every App Store build before this plugin, a refused
  worklet, and `NATIVE_MIC_ON = false` (the website kill switch; one phone:
  `localStorage "sona.nativemic" = "off"`) all listen exactly as before.
  **Every bar is unchanged**, but the sound reaching it is not: no automatic
  gain, no noise suppression. A one-number boost (`NATIVE_MIC_GAIN`, ×1.0)
  exists for the phone test, and changing it is Rachel's call, as is
  `micDeaf`: frames from a paused or starved native mic never set a room
  floor. The plugin ships through `scripts/install-ios-speech.py`, so it
  needs a new App Store build; SPEECH_PLUGIN.md holds the phone checklist
  and the numbers to send back. `nativemictest` (with `tests/_nativemic.mjs`,
  a fake phone) plays the app path, `micquietgamesowntest` and
  `repguardowntest` the quiet rules on it, and `heartest` pins the Swift.
  **On silent, nothing plays** (Travis, 15 Oct 2026, asked "When the iPhone
  is on silent, what should Sona do?", picked "Everything off": "nothing
  plays, Echo included, like most iPhone games"). On Sona's own mic every
  page sets
  `navigator.audioSession.type` to `"transient-solo"` as it loads
  (`AUDIO_SESSION_TYPE` in `sona.js`, THE SILENT SWITCH): Echo's voice,
  Rachel's sound, "Go!", the chimes, the notes, the pops and the games' own
  sounds all follow the switch, and a parent's music still pauses when Echo
  talks. Never `"ambient"`: it mixes, so Spotify would play into the open
  mic. WebKit refuses its own mic while the type is set, so every way to it
  (the phone's "not now", a fault, the off switch, a page's own getUserMedia
  line, a parked page) sets `"auto"` first, for the rest of that page, and a
  page on the off switch writes `"auto"` as it loads (WebKit holds an earlier
  page's setting across page loads). A browser and an App Store build
  without the plugin are never touched. The plugin's `sessionOff()` now
  leaves the app's session `.ambient` (it was `.playback`), so the robot
  fallback voice follows the switch too, but only from the next App Store
  build; the page half is a web deploy. **To take it out, set
  `AUDIO_SESSION_TYPE` to `"auto"`**: every page then writes `"auto"` as it
  loads, which also clears the setting a family's open app still holds.
  **Never revert this block, and never roll speaksona.com back to a
  deployment from before it (Vercel's Instant Rollback included), while an
  app build with `micOpen` is in families' hands.** WebKit keeps
  `"transient-solo"` for as long as the app stays open, and code without the
  block never gives it back, so WebKit refuses its own mic (every fallback,
  and every listen once `NATIVE_MIC_ON` is `false`) until the family closes
  the app fully and opens it again. The off switch works only on code that
  has this block (`nativemictest` plays it, and `"auto"`). **For Rachel:** a
  child on a silenced phone hears no Echo and no sound to copy until a
  grown-up flips the switch, and nothing on screen says why.
- Comments explain *why*, especially where the obvious implementation is
  wrong. Match the surrounding density.


**Daily rep goals and weekly goal days** (Travis handoff, 5 Oct 2026).
Home uses the shared read-only `dayGoal()` count: today's practice tries plus
accepted game and book asks. **The default is 30 reps a day at every age**
(Travis, that evening: "we'll just set the default to thirty reps per day.
Right now it's set to fifty", which it was for ages 5–8; "if they say three
days per week, that will make their goal ninety reps a week"), and 4 days a
week for a family never asked. Setup asks the minutes a day (22 Oct 2026: 5,
10 or 15, saved as 30, 60 or 90 reps a day) and no longer the days; on
Progress grown-ups choose 3, 4, 5 or every day and a daily number (in
Settings until 22 Oct 2026), and a number picked there is kept. **"Every day" is 7 again**: for a few hours on 5
Oct a saved 7 read as 5. An
active clinician assignment keeps precedence over the family's daily number.
These are product defaults, not a research-established treatment dose.

`sona.goaldays.v1` is per child, backed up and removed with that child. It
stamps a day once when a real counted rep reaches the goal. Raising the goal
later cannot erase it. A DOM-only status appears once that day, for four
seconds, without audio, confetti, a focus change or any interception of play.
An invisible page stamps without displaying it. Opening Home earns nothing.
Monday–Sunday goal stamps feed the weekly goal streak, with earlier practice
days (before 5 Oct 2026) preserving existing weeks. An unfinished week does not
break the prior completed-week streak. `momWeek().days/done` remain actual
practice days for the clinical summary; `.metDays/.goalDone` serve the goal.
Game and book reps remain outside outcomes, clinician summaries, shared
progress and homework reports. They earn trophies (TROPHY1), and a goal day
they complete can count on the Practice Board if a grown-up turned it on
(BOARD2; the board ships switched off). Progress, under the daily goal,
explicitly explains the homework report's practice-only count. No child name enters goal analytics.
`dailygoaltest`, `repweektest`, `momweek` and `booktest` pin the boundaries.

Rachel's follow-up review belongs in the development record, not a warning
flow or an approval screen for families:

| Review question | Product behavior shipping |
|---|---|
| Daily default |30 at every age, adjustable; setup's 5 / 10 / 15 minutes are 30 / 60 / 90|
| What a rep means |Voiced practice try, accepted game ask or accepted book word; no silence|
| Homework and play |Home includes play toward the displayed goal; clinician report stays practice-only|
| Weekly target |4 days by default (setup no longer asks); Progress 3, 4, 5 or every day; earned-day stamps|
| Book check limitations |One accepted word is a play rep, without a clinical correctness claim|

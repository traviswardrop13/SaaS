# Gospel Questions

A simple app for a Sunday school (or seminary / family) class. Everyone writes
down the gospel questions on their heart, the class sees them all and **votes**,
and then you study the ones that rise to the top — with **real scripture verses**
and **quotes from living prophets and apostles**.

It works like Kahoot or Mentimeter: the teacher starts a class, everyone joins
on their phones with a short code, and the teacher drives the class through three
phases.

> This app is completely separate from anything else in this repository. It
> lives entirely in the `sunday-school/` folder and has its own dependencies,
> its own build, and its own deploy — building or changing it cannot affect the
> other app in this repo.

## How a class runs

1. **Ask** — Each person opens the app on their phone, enters the class code,
   and writes one or more gospel questions. Their questions stay private (only
   they see their own) until the teacher reveals them. The teacher's screen shows
   a live count and a join QR code to project.
2. **Vote** — The teacher taps **Reveal all & start voting**. Now every question
   appears on everyone's phone and the class upvotes the ones they most want to
   study. Questions sort to the top as votes come in.
3. **Study** — The teacher picks a question (usually the top-voted one). The app
   gathers **relevant scripture verses** (shown with their full, real text) and a
   few **prophet/apostle quotes**, and displays them on every device.

## How the answers are kept trustworthy

This is a teaching setting, so accuracy matters. Two guarantees:

- **Scriptures are always real.** Every reference is looked up in the full LDS
  standard works dataset bundled with the app (Old & New Testament, Book of
  Mormon, Doctrine & Covenants, Pearl of Great Price — 41,995 verses). A verse
  that doesn't resolve to real text is silently dropped, so the class can never
  see a made-up reference. The **actual verse text** is displayed, not a summary.
- **Quotes link to their source.** Prophet/apostle quotes come from a curated,
  fact-checked topical index. Each quote shows its attribution and a link to its
  source (or a search on churchofjesuschrist.org) so you can confirm it before
  sharing in class. The app never generates quotations on the fly.

When an `ANTHROPIC_API_KEY` is set, the app uses Claude to pick the most relevant
gospel topics for a free-form question, write a short neutral framing (it does
**not** answer the question — the scriptures and prophets speak for themselves),
and suggest additional **real** references (which are then validated against the
scriptures dataset). Without the key, the app falls back to keyword matching over
the built-in topical index and still works.

## Run it locally

```bash
cd sunday-school
npm install
npm run dev
# open http://localhost:3000
```

Open `/host` in one tab (the teacher) and `/join` in another (a class member) to
try the whole flow on one machine.

## Deploy (Vercel)

Because this app lives in a subfolder, point Vercel at it:

1. Import this repository into Vercel as a **new project** (separate from any
   other app in the repo).
2. In the project settings, set **Root Directory** to `sunday-school`.
3. Add environment variables (Settings → Environment Variables):
   - `ANTHROPIC_API_KEY` — optional but recommended (better topic matching +
     framing). Same key style as any Anthropic API usage.
   - A shared store (see below) — required for phones to sync.
4. Deploy.

### Making phones sync (shared sessions)

For everyone to submit and vote from their **own** phones, the app needs a
shared store. The easiest path on Vercel:

1. In your Vercel project → **Storage** → create an **Upstash Redis** (or KV)
   store.
2. Click **Connect** to link it to this project. Vercel injects the
   `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (or `KV_REST_API_*`)
   variables automatically — you don't paste anything.
3. Redeploy.

To run it yourself, create a free database at <https://upstash.com>, then set
`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (see `.env.example`).

**Without a shared store** the app runs in *single-screen mode*: state lives in
one server's memory, so it's perfect for testing or for passing one device
around, but phones won't stay in sync. The teacher screen shows a banner when
this is the case.

## Project layout

```
sunday-school/
  app/
    page.tsx                       # landing (Start a class / Join a class)
    host/page.tsx                  # teacher: code+QR, phases, pick a question
    join/page.tsx                  # class member: write, vote, study
    api/
      session/route.ts             # create a class (returns code + host token)
      session/[code]/route.ts      # live state (polled)
      session/[code]/questions/    # submit a question (ask phase)
      session/[code]/vote/         # toggle an upvote
      session/[code]/phase/        # host-only: change phase / pick question
      study/route.ts               # question -> scriptures + quotes
  components/
    QuestionList.tsx               # vote / select list
    StudyView.tsx                  # scriptures + quotes display
  lib/
    store.ts                       # Upstash Redis + in-memory session store
    scriptures.ts                  # real verse lookup + validation
    topics.ts                      # topical index + question matching
    study.ts                       # builds a study result for a question
    ai.ts                          # optional Claude assist (constrained)
    clientApi.ts                   # browser-side API helpers
    types.ts, ids.ts, publicView.ts
  data/
    scriptures.min.json            # 41,995 verses of real scripture text
    topics.json                    # curated, verified topical index
```

## A note on sources

Scripture text is from the public-domain LDS standard works. Quotes are provided
with attribution and source links for your verification; please confirm any quote
at its original source before sharing it as authoritative in class.

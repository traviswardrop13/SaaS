# SpeakUp Kids

A Duolingo-style speech-therapy practice app for children. Built with Next.js
(App Router) + Tailwind. The MVP runs entirely in the browser — no backend, no
audio uploads. Speech is transcribed on-device with the Web Speech API and
progress is saved to `localStorage`.

## What's in the MVP

- **Parent setup** → create a parent profile and one or more child profiles.
- **Kid skill tree** of speech sounds (S, R, L, SH, TH, CH), each with one or
  more short lessons (e.g. "S at the start", "R in the middle").
- **Pronunciation lesson player**: kid sees an emoji + word, taps to hear the
  target word (browser TTS), then taps the mic to say it. The browser's
  speech recognizer transcribes the attempt; a forgiving fuzzy matcher scores
  it and animates feedback.
- **XP, streaks, and ⭐ ratings** per lesson; lessons unlock progressively.
- **Parent dashboard** with per-child XP, streak, total stars, and a
  per-sound breakdown.
- Graceful fallback for browsers without speech recognition (Firefox, older
  Safari): the kid self-rates each word instead.

## Tech stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS, Framer Motion, canvas-confetti
- Web Speech API (`SpeechRecognition` + `speechSynthesis`)
- `localStorage` persistence (single device)

## Run locally

```bash
npm install
npm run dev
# open http://localhost:3000
```

Chrome / Edge are the best browsers for the mic experience.

## Project layout

```
app/
  page.tsx                              # landing
  setup/page.tsx                        # parent + child setup
  dashboard/page.tsx                    # parent view
  kid/[id]/page.tsx                     # kid skill tree
  kid/[id]/lesson/[skillId]/[lessonId]/page.tsx   # lesson player
lib/
  lessons.ts    # skills + lesson data
  scoring.ts    # fuzzy match for kid speech
  speech.ts     # speech recognition + TTS helpers
  storage.ts    # localStorage state, XP/streak logic
```

## Cloud scoring API (`/api/score`)

The mobile app posts a child's recording to `POST /api/score` and gets back a
word- and phoneme-level score. This route proxies to Speechace using a
server-side key — the API key is never sent to the device.

**Setup in Vercel:**

1. Speechace dashboard → copy your product key.
2. Vercel → `sona` project → Settings → Environment Variables.
3. Add `SPEECHACE_API_KEY` with the key value. Check Production + Preview +
   Development.
4. Redeploy (any new commit triggers it).

**Smoke test the deployed endpoint:**

```bash
API_URL=https://sona-yourdeploy.vercel.app ./scripts/test-speechace.sh rabbit R
```

Records 3s from the default mic, uploads, and prints Speechace's response.

## Roadmap (post-MVP)

- Real accounts + sync (Supabase / Clerk) so progress moves between devices.
- Therapist accounts that can assign exercises and review recordings.
- Minimal-pair discrimination games (ship vs chip).
- Sticker / collectible reward layer for younger / less competitive kids.

## A note on COPPA / privacy

Because this MVP stores everything locally and uploads no audio, there is no
data collection or transmission. Any future version that adds accounts or
recording uploads needs an explicit privacy review before launch.

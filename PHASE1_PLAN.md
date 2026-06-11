# Phase 1 — morning runbook

Goal: see the coach **talk in LITE with our voice**, then run a **full session**.

## 1. Add the voice key (the only thing blocking us)
In **Vercel → sona → Settings → Environment Variables** (Production **and** Preview):

- **`ELEVENLABS_API_KEY`** = your ElevenLabs key  → premium voice
  - Optional: **`ELEVENLABS_VOICE_ID`** (pick a warm female voice; defaults to "Rachel")
  - ⚠️ Needs a **paid** ElevenLabs plan (PCM output). If you're not paid yet, instead add:
- **`OPENAI_API_KEY`** = your OpenAI key  → good voice, works on any tier (test today)

Already set (no action): the LiveAvatar key. Optional: `ANTHROPIC_API_KEY` makes the
coach's lines dynamic (Claude); without it, the session uses friendly canned lines.

Then reply **"done"** in chat — I'll push a fresh deploy so the key takes effect.

## 2. Test — single line (clean, isolates "does she talk")
```
…/avatar.html?go=7&mode=LITE
```
Tap **Start**, allow audio → she should connect and **greet you in our voice**.
Type something → **Say it** → she speaks it.
If it errors, copy the alert — I read the SDK source, so I'll know the fix fast.

## 3. Test — the full session (the real experience I built overnight)
```
…/coach.html?mode=LITE&name=Mia
```
Tap **Start session**, allow mic. Expected flow:
- She greets you, then for each word: introduces it → shows the word card →
  "your turn" (tap the mic when done) → praises → next word → wrap-up.
- `?name=` personalizes; the word list is a placeholder set (rabbit, sun, lion…).

## What's built and ready (this branch)
- **`/avatar.html`** — minimal connect + speak test (LITE via our TTS).
- **`/coach.html`** — full session UI + loop (greeting → words → turns → feedback →
  finish), premium blue/green stage, captions, progress, mic turn-taking. Reuses the
  proven avatar path; paces on the SDK's `avatar.speak_ended` event.
- **`/api/tts`** — ElevenLabs (or OpenAI) → raw PCM 24k for `repeatAudio`.
- **`/api/coach`** — Claude coach lines (with canned fallback).
- **Landing + pricing** ($99 single plan, blue/green), **Stripe checkout**
  (`/subscribe`), **Privacy + Terms** (COPPA-aware templates — get them lawyer-reviewed).

## Likely first-try snags (and they're quick fixes)
- **"Speak error / not a supported mode"** → the LITE session may not open the
  command socket; I'll adjust how we connect.
- **No audio but she's connected** → PCM format/endianness tweak in `/api/tts`.
- **ElevenLabs 401/403 on PCM** → plan gating; use OpenAI key to test today.
- **Timing feels off** (overlap/gaps) → tune the `awaitSpeakEnded` cap.

Bring me whatever you see and we'll burn through these together.

## After Phase 1 (Phase 2 preview)
Port the session into the React app, real onboarding/screener → personalized word
list, accounts + Stripe gating wired to access, parent progress dashboard,
real-time scoring (Speechace) on the child's turn.

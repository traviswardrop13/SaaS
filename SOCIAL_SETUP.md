# Daily short video — setup

Every day, with nobody in the loop:

1. **Claude writes** a 30–40 second script from the next topic in `lib/socialRules.ts`.
2. **The checker** (`checkScript`, same file) rejects anything Sona must never say publicly: "certified", a price or "free", "therapy", a diagnosis, a promise, a developmental age. A bad draft gets one rewrite; a second bad draft skips the day.
3. **HeyGen renders** it as a vertical talking-avatar video with captions burned in.
4. **Upload-Post posts** it to TikTok, Instagram Reels, YouTube Shorts and Facebook Reels, labelled AI-generated and not made for kids.

Times (UTC, `vercel.json`): make at 13:17, post at 16:17, a second post attempt at 19:17 for a slow render. 16:17 UTC is 8:17am Pacific / 11:17am Eastern in winter.

## One-time setup (about 20 minutes)

1. **Upload-Post** (upload-post.com): sign up on a plan that includes TikTok (the free plan doesn't). Create one profile (for example `sona`) and connect Sona's TikTok, Instagram (Business or Creator account), YouTube channel and Facebook Page to it. Copy your API key.
2. **HeyGen** (platform.heygen.com/api-keys): create an API key. Pick a stock avatar and a voice; their ids come from `GET /v3/avatars/looks` and `GET /v3/models/audio/voices`. This is the HeyGen *video* key, not the LiveAvatar key the in-app coach uses.
3. **Vercel → Settings → Environment Variables** (Production), then redeploy:

| Name | What |
|---|---|
| `ANTHROPIC_API_KEY` | already set for the coach |
| `HEYGEN_VIDEO_API_KEY` | HeyGen API key |
| `HEYGEN_AVATAR_ID` | the avatar look id |
| `HEYGEN_VOICE_ID` | the voice id |
| `UPLOADPOST_API_KEY` | Upload-Post API key |
| `UPLOADPOST_USER` | the Upload-Post profile name, e.g. `sona` |
| `UPLOADPOST_FACEBOOK_PAGE_ID` | optional: only if more than one Facebook Page is connected |
| `CRON_SECRET` | already set for the Friday email |

Until all of these are set, every run does nothing and logs which ones are missing.

## Day to day

- **Stop it:** set `SOCIAL_PAUSED=1` in Vercel. Every run then does nothing. Delete the variable to restart.
- **See what happened** (last 14 days, and today's result on each network):

```bash
curl -H "X-Founder-Key: $FOUNDER_KEY" "https://speaksona.com/api/cron/social?step=status"
```

- **Try the writer without making a video** (costs one Claude call, renders and posts nothing):

```bash
curl -H "X-Founder-Key: $FOUNDER_KEY" "https://speaksona.com/api/cron/social?step=make&dry=1"
```

- **Change what the videos are about:** edit `TOPICS` in `lib/socialRules.ts`. What parents are told to do at home is Rachel's call.

## What it costs

Claude: a few cents a day. HeyGen and Upload-Post: their plan prices. A TikTok post can land in the account's drafts instead of going live if TikTok's daily cap for Upload-Post's app is hit; the status call shows `fallback_to_inbox: true` when that happens.

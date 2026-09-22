# SLP dashboard redesign — release handoff

Branch: `codex/slp-dashboard-redesign`, based on September 21's dashboard (`0c9f482`). Worktree: `/Users/traviswardrop/.codex/worktrees/sona-slp-redesign/SaaS`. The older main workspace and app work are separate.

## Review the finished local pass

```sh
node scripts/slp-preview.mjs
```

Open http://127.0.0.1:4174/slp.html. Set `SLP_PREVIEW_PORT` if another port is needed. This preview uses synthetic children, intercepts all API writes locally, and shows a preview banner. Nothing is submitted to a live account. Reset demo restores the sample roster.

The deployed dashboard still uses authenticated SLP APIs. Community and Affiliates default hidden, including direct hash routes and in-page links. Only the local preview server injects `window.SLP_PREVIEW_FEATURES=true`, and the dashboard also requires a localhost hostname.

## Completed

- Calm desktop/mobile workspace; clear Today groups, caseload search/filter/sort, clickable rows, honest clipboard/load-error recovery, and keyboard focus.
- Review fixes: consistent Last 7 days labels, homework hit counts that exclude future/out-of-window dates, friendly parent check-in messages, Set their sound for new families, and no duplicate quiet/missed row.
- One family invite panel with individual and general links/messages. Initials, 30-day expiry, and parent-message guidance are preserved.
- Quick homework reuses existing targets or prior homework, shows what the family receives, prevents duplicate sends, and keeps failed drafts. Assignment requires an explicit click.
- Next session uses supported position rates with sample counts, homework completion, and last practice. Edits are separate for each child and stay in the current tab; copying/exporting remains the way to keep a plan across refreshes.
- Progress notes include all-time position breakdowns, suppress percentages under 20 attempts, and retain the practice-snapshot/evaluation hedge.
- Feedback and call requests use the signed-in email. Call availability is optional. A request is never presented as a confirmed booking. The API reports receipt only after confirmed storage or dedicated webhook delivery.
- Overview-only removal link retains the original confirmation. Duplicate homework/feedback entry points removed. Settings copy is plain and accurate. Dashboard spelling is US English.
- Neutral pass-rate chips, position cells, and rate bars, per Travis's decision.
- Free forever remains in Settings and the family invitation messages; repeated banners are removed. Affiliate commission is unconfirmed, so the teaser says “Earn a share of each sale — details at launch.”
- Community preview includes topic filters, replies, and Rachel seed drafts clearly marked for her to rewrite. Demo posts remain in the current tab and clear on reload.

## Verification

253 focused checks passed against the final implementation:

| Suite | Checks |
| --- | ---: |
| `slpdesigntest.mjs` | 52 |
| `slptest.mjs` | 48 |
| `hwtest.mjs` | 33 |
| `syntaxtest.mjs` | 36 |
| `slpworkflowtest.mjs` | 50 |
| `slpfeedbacktest.mjs` | 34 |

TypeScript passed with `--noEmit --incremental false`. Browser review covered 1440/390 pixels, with workflow checks also covering 320 pixels. No runtime errors or horizontal overflow were found. Tests verify view navigation does not make write requests. New review checks fail against the saved pre-review page, and the durable workflow suite detects the old generic planner.

Release verification on September 22: after integrating main at `777cdc7`, all 34 suites in `node tests/run-all.mjs` passed (exit 0), including the latest audio regression suites. TypeScript also passed with `--noEmit --incremental false`. The local run used the installed Google Chrome executable via `CHROMIUM_PATH`.

## Deliberately not live

- Release prerequisite: Production must have `SLP_AUTH_SECRET` set before merging. Without it, SLP sessions and family enrollment tickets fail closed. Confirm the setting by name; never record its value here.
- Community needs shared storage and moderation before enabling it for members. Rachel must rewrite/approve her seed posts. The preview is not a functioning shared community.
- Affiliate commission and eligibility terms still need a confirmed launch decision.
- Live feedback delivery was not exercised. Dedicated notifications use `SLACK_FEEDBACK_WEBHOOK_URL` or `FEEDBACK_WEBHOOK_URL`; with KV alone, messages are stored but no notification is sent. The code does not route feedback into generic lead/pilot destinations.
- Rachel should review the changed clinical-facing planner and note presentation before release.

Local review screenshots are in `/private/tmp/sona-slp-review/`.

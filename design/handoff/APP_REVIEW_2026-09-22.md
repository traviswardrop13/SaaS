# Sona family app review — local implementation checkpoint

Source: Travis's `sona-codex-redesign-review-2026-09-21.md`, numbered “Paste this to Codex / your build chat” section. Worktree: `sona-current/SaaS`; branch: `codex/sona-app-improvements`. No deployment, merge, or push.

Travis approved the item 25 summary wording and confirmed Rachel approved Simple play for ages 2–4 and Arcade for ages 5+. All games remain available at every age.

## Review checklist

| Item | Implementation |
| --- | --- |
| 1 | **Partially implemented; release blocker.** Zero-rep and unknown checks cannot log practice or clips, including native recognition. Shape analysis receives only frames from a counted burst. The new hard speech classifier was removed after it rejected valid recorded sounds across the inventory. The prior energy-event detector remains; noise rejection is unfinished and its regression tests deliberately remain failing. See below. |
| 2 | Shared mic disclosure covers practice and optional voice-enabled games. Clips stay local except explicit parent sharing, with at most one per child per day across targets. Automatic onboarding device-transfer upload removed; anonymous peer-count endpoint retired. |
| 3 | Chest appears after the whole adventure. Free-play headers name the game; no free-play chest. |
| 4 | Home has one large adventure action. Game shelf appears after today's adventure is complete. |
| 5 | Eight illustrated library tiles, two columns on phones and three on wider screens; Echo invitation, accessible descriptions, no age locks. |
| 6 | Setup requests the real microphone permission on the parent's tap, releases tracks, and offers Not now. Native speech permission follows the mic grant. |
| 7 | Calm setup build beat and explicit child handoff; no setup confetti or automatic redirect. Disabled controls and three progress groups. |
| 8 | Sound selection starts empty, includes examples, and requires a deliberate selection. No automatic R fallback. |
| 9 | Welcome and handoff use Echo's world; questions stay plain. Device-transfer code entry uses a styled sheet. |
| 10 | Buddy, library and settings header controls; empty coins hidden; jar explains itself on tap. |
| 11 | Five-node illustrated adventure path with Echo at the current step, driven by the shared saved plan. |
| 12 | Fresh zero-round exits show the initial invitation; earned games, pending returns and completion beats resume. |
| 13 | Shared age logic gives ages 2–4 an untimed simple adventure and ages 5+ an arcade adventure. Simple discovery play creates no speech stats. A completed simple adventure earns a discovery sticker, consistent with item 16. |
| 14 | Larger Echo with listening, talking, heard and checking states. Heard feedback is binary rather than a loudness meter. |
| 15 | Mic is a status indicator; tapping Echo replays the model. Turtle slow-help remains available. Model playback does not consume the child's listening time. |
| 16 | Warm game handoff, then final celebration → chest → tomorrow/Done. Finish state and sticker claim survive refresh without duplicate awards. |
| 17 | Quiet retry stays in the scene. Busy/interrupted microphone has a distinct recovery path; only permission denial invokes denial instructions. |
| 18 | Five path dots with the current game replace ticket/star counters and the numeric practice header. |
| 19 | Ghost items show an outer outline rather than interior fruit details. |
| 20 | Waiting Echo and prominent Resume action. Pause stops mic/audio; resume continues the same attempt and preserves earned progress. |
| 21 | Parent view uses detected tries, weekly days and clearest eligible sound. Weekly goal remains; no Sessions/Stars/day-streak tiles. Completed library practice is recorded. |
| 22 | Percentages stay hidden until at least 10 tries across two days. Accuracy is explicitly a sound check per burst, not a score for every try. |
| 23 | Peer ranking and percentile request removed; comparison is only with the family's previous week. |
| 24 | Local recordings appear below the narrative. Honest empty first/latest slots, clip-dependent listen link, explicit file sharing. |
| 25 | Weekly image/text share plus prominent copy-summary action. Approved practice-aid disclaimer; protected setup “doesn't test or diagnose” line preserved. **Native iPhone sharing still needs a device check.** |
| 26 | US practice/practiced/practicing spelling on the touched family app surfaces and related tests. |

## Final audit fixes

- Demonstration replay no longer advances the practice ring or sound rotation.
- Returning Home from a completed simple game resumes at the next game, without repeating or double-banking it.
- Adding, switching or removing children preserves each child's own unfinished adventure and daily recording marker.
- Recording ownership is captured before asynchronous database work.
- Feed Echo cancels speech, generated audio, concert audio and mic capture on backgrounding; late responses cannot restart playback. Returning to the foreground alone stays quiet.

## Verification

Live-release recheck on 22 Sep 2026 finished: **38 of 39 suites passed; exit 1**. Only `repguardtest.mjs` failed. The production build passed (exit 0). Durable logs and the voice-only fallback patch are in `/Users/traviswardrop/Documents/SaaS/output/sona-live-release-2026-09-22/`. Tests used installed Chrome with muted playback and synthetic microphones. This checkpoint is not release-ready under the existing all-tests-pass rule. The earlier 39-suite run passed, but broader positive-sound checks then exposed a real false-negative problem that those tests did not cover. That earlier green result is not the final release verdict.

All 19 recorded-target positive controls pass after rollback (40 checks, exit 0). Focused results include 41 onboarding checks, 33 parent-progress checks, speech/noise regressions and positive controls across all 19 recorded targets, 120 pause checks, 29 completion checks, child-switching checks and 11 Feed Echo audio checks. New regression tests were exercised against pre-fix code and failed there. TypeScript passed. Visual inspection covered Home, library, practice, parent progress and welcome; 375px pages had no horizontal overflow or page errors, with an additional 320px practice capture.

All automated browser tests were muted. Microphone tests used generated streams or local recorded fixtures, never a live microphone. No child audio was sent to an external service.

## Required before release

1. Finish and validate review item 1 before releasing. The rejected classifier accepted R/S but completely rejected recorded M/N/THV/V; several other sounds could not sustain its continuous 150ms gate. Low voiced sounds, brief stops and weak fricatives need distinct evidence, validated beyond these single-voice fixtures. The strict candidate was removed instead of tuning arbitrary exceptions to make the fixture set pass. Keep the failing noise regressions as the acceptance bar; do not disable them to make the battery green.
2. Rachel/Travis should then exercise the practice loop on a real iPhone with child voices, quiet speech, claps, knocks, breath and humming. Desktop fixtures are not a clinical validation and do not establish performance across children's ages, voices or phone microphones.
3. A single microphone cannot reliably tell the child from another person or speech on a TV. The retained energy-event detector can still count noise. Humming versus isolated M, and blowing versus F/TH, overlap acoustically. The requested blanket TV-audio rejection is not achieved. The parent scoring explanation now states the nearby-voice limitation. Do not describe this as speaker identification or an assessment.
4. Check native microphone/speech permission, interruptions and resume, and actual iOS file sharing. Browser tests cover the routing and fallback behavior; they cannot verify the OS share sheet on a physical phone.
5. Listen to the model voice on-device with Rachel before release. The existing shape checker returns `fail` for the bundled L example, while short T/D/B examples correctly remain `unknown` with limited evidence. Review the model/checker pairing; positive detection alone does not validate scoring. This checkpoint does not constitute a clinical sign-off on voice cues or cadence.

Pricing, free-era promises, the dormant paid flow, existing clinical cues, protected setup disclaimer, parent narrative/byline, weekly goal and no-age-lock library behavior remain preserved. No SLP dashboard redesign is included.

## Live release request — 22 Sep 2026

Travis authorized a release for everyone. No push, merge or deployment was made during the release check because the retained practice acceptance suite still fails. The live ElevenLabs configuration returned a successful 71,332-byte PCM response for a generic test phrase; no sound was played on the Mac. Physical iPhone playback remains unverified.

A separate five-file audio-only patch applies to production `main` at `10ec31a`; its 21 route checks and seven shared-client checks passed. It preserves the current live clinical, game and visual behavior. It still needs its full release battery if selected. The decision now is audio-only scope, fixing practice detection first, or an explicit exception for publishing the full redesign with the known practice limitations.

## Merge preparation after audio release

The audio-only release is live through PR #121 and production commit 777cdc736959b2e50ea2f0cc3a73a5398a3d1824. Current main has been integrated locally into this redesign branch. Its non-cancelling narration watchdog and regression test are preserved alongside the simple-game voice tests. All 24 combined voice-client checks and the syntax suite passed after integration. No redesigned app changes have been published.

The prior full battery remains 38/39 suites; the known noise acceptance failures were neither removed nor weakened. Source comparison confirms production uses the same underlying energy-event gate, but this branch also changes practice accounting and related flows, so the full redesign is not a UI-only release. Publishing it with those known limitations needs an explicit exception to the all-tests-pass rule. No new detector tuning or full repeated battery was started during this merge preparation.

## Approved known-limitation release

After the remaining 38/39 result and its practical consequence were explained, Travis explicitly instructed: “okay letsfirst merge what we have then attack this noise issue.” This authorizes publishing the current redesign with the disclosed noise-counting limitation as an exception to the all-tests-pass gate. The failing noise suite remains enabled and unchanged. The noise investigation is separate follow-up work, with no new detector behavior included in this release.

## Native family-only correction

Travis reported the installed iPhone app showing SLP sign-in, clarified that clinician tools belong only in the browser, and instructed fixing this before merging immediately. The native start URL was already the family root, but direct/restored clinician URLs had no native guard and a legacy SLP profile could reveal clinician Settings controls. The exact arrival path on his device is not established.

Each clinician entry page now performs its native redirect inline in the head, before rendering and without another asset dependency; clinician boot/send functions honor that redirect. Native Settings hides clinician controls and uses family feedback wording. Native setup disregards a saved clinician role in its draft. Existing profile data and browser clinician access remain intact. Fresh/returning native users, clean aliases, active-child setup, legacy Capacitor bridges and browser bridges are covered: 14/28 checks before the fix, 28/28 afterward. Syntax passed. Physical-device confirmation is still needed.

The first integration battery also had three navigation/timing timeouts (day1, pause, pause-audio); all three passed once when rerun independently (143, 120 and 41 assertions respectively). This is recorded rather than relabeling the first run as green. The final combined battery log is family-entry-final-battery.log under the release output folder.

## Concurrent production change reconciled

While the release checks ran, production advanced to ce59e43 (#120), making `/` rewrite to `/for-slps.html`. The installed Capacitor app loads that root; this explains the observed clinician entry. The native guard now protects that rewritten root too. The browser clinician homepage, dashboard, consent/roster changes and optional parent email feature are retained. The browser setup clinician link is available only outside the native app; native draft routing remains parent-only.

The completed pre-integration 40-suite run passed 39 suites, with only the disclosed repguard failure. After integrating current production, native entry passed 32/32 including `/`, the syntax suite and production build passed, and targeted parent/clinician/referral checks were rerun. Full runner retains 42 suites, including both upstream SLP suites and the unchanged noise acceptance suite. No new noise-detector behavior is shipped here.


## Noise-filter review candidate — 24 September 2026

Review item 1 now has an integrated candidate on `codex/sona-noise-guard`,
based on production `77190cc`. It reuses the earlier filter from `fc30d3e`
and preserves the newer final 350 ms of active listening, exactly-once credit,
pause/resume, microphone-replacement qualification, interrupted-recording
exclusion, and 20-second cap. No pricing, purchase, SLP-dashboard or clinical
cue changes are included.

The unchanged noise suite improves from 64/74 on the original page to 74/74,
including detectable events for all 19 shipped adult targets. Pause/recovery
passes 152 assertions. Two added real-recorded final-try scenarios pass 8/8;
the original filter at immutable `fc30d3e` fails six of those checks because
it stops collecting evidence after five frames and saves no practice. The final combined battery passes all 49 groups (exit 0), including 156
speech-evidence checks. TypeScript and syntax checks pass.

**This remains a review candidate, not clinical approval.** Earlier filter
measurements found missed very soft steady F and quiet L, fewer P releases in
noise, and fewer synthetic child M/N repetitions in some conditions. Those
losses are not resolved by passing normal-volume adult recordings. Rachel
should review quiet/held F/TH/L, M/N, short P/T/K, actual room noise and Low
Power Mode on an iPhone before release. The existing cues are unchanged.

The filter rejects the tested pure tones, electrical hum and steady noise.
Actual humming, blowing, household hiss, brief household sounds, changing
noise, buzzy toys and nearby speech can still count. It does not identify who
spoke or reliably exclude TV. Automated checks are muted and use synthetic
streams or shipped adult recordings; no physical-device or child-voice
validation has been performed. Audio stays on the device.

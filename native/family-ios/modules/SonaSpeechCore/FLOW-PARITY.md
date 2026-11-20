# Practice flow decisions

`PracticeFlowMachine` follows `public/charge.html`’s `burstAndVerify()` and `flow()` decisions. It is a pure reducer. It plays nothing, owns no microphone, calculates no verdict, selects no content and writes no family data.

Initialize it with the existing selected `PracticeFlowContent`, mastered rung, and optional existing same-sound `stepNext`. The supplied step must be earlier; no random easier word is invented. Pass the source item’s `position` and `cueFirst` unchanged. `send(.start)` emits `beginTurn` with content, exact prompt, count and a unique turn ID. Capture that ID when attaching `PracticeTurnSession.onResult`; send the completed result back with it. Send the session’s quiet/unavailable phase separately. Pause and microphone ownership stay with the existing session.

The first known failure asks the existing cue and three-try retry. A second failure above isolation uses only the supplied earlier item, for three tries. Only a full first pass at or above the mastered rung emits a rung win. Each voiced known result emits one identified ledger effect; neither silence nor unknown evidence does. Retries and easier targets never win a rung. Demo replay emits no ledger, rung or ring requests. An already-ringed daily round cannot ring again. IDs reject duplicate and old-flow results.

On a quiet retry tap, the new turn keeps its current stage/count but uses the shipping uncued regular prompt. This deliberately preserves the existing source edge: after `NEED` is restored, its regular replay may say five while the coached listening retry still requires three. This port does not silently change the wording or clinical rule.

`readyForGame` is a handoff plan, not an entitlement or automatic launch. The host applies it in this order:

1. Await `feedbackBeforeBookkeeping`: the existing final-failure line, or the existing step-down praise selection. Re-check cancellation and the child/target owner afterwards.
2. Apply the proposed ring flag, save the daily-ready checkpoint when indicated, and retain the existing non-daily practice-session count. Use the emitted IDs and the saved run checkpoint for idempotence across reloads.
3. Perform the existing access-checked game handoff; play `feedbackAfterBookkeeping` only where indicated, after the existing completion chime gap. Await microphone cleanup and re-check ownership before navigation. `cancel` can still veto navigation after a ready plan without undoing earned history.

The full native speech-core package passed 58 tests after the new flow and prompt fixes. The pre-fix prompt run failed on the two real say/display mismatches; the flow contract also failed before its missing type was added. These are local synthetic and deterministic checks, not physical-device, clinical, or full release validation. Exact content selection, live integration, persistence, pricing and real-device audio still need their existing release checks.

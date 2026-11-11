# Piano Tiles: sound-powered slow keys

28 September 2026. Follow-up to the crafted-world redesign, scoped to Piano Tiles.

## Child interaction

Tap Echo inside the piano board. The existing notes hold in place while the instruction plays, followed by the selected sound's existing Rachel/Echo demo recording. The microphone listens for a short attempt. A qualifying sound resumes the song with eight seconds of slower falling tiles and slower tile arrival (55% of normal speed), a teal visual state and a shrinking duration bar. The same song, note order and score continue. The effect can be earned again after it expires. Between-song sound prompts remain.

The child can choose Keep playing without earning the effect. Silence times out without earning it. A cancelled or backgrounded attempt grants nothing. Exit waits for a pending native microphone start to settle and stop before navigating.

## Speech and audio boundaries

The target comes from the current practice sound. Its recorded sound model is reused; TTS only says the instruction prefix. The existing family-shape voice check is required. When native recognition starts, the existing Sona.hearVerdict isolation rules additionally reject a clear unrelated transcript. No new clinical thresholds, substitutions, or pronunciation claims were introduced. No practice records are written and no child audio or transcript leaves the device.

The web fallback can judge sound shape but cannot reliably distinguish every unrelated word. Physical iPhone testing is still required for microphone/recognizer coordination and speaker levels.

## Validation

The new feature suite was first run against the pre-change Piano page and failed because the speech control did not exist. Focused checks passed: the new speech interaction suite (64 assertions), the existing complete Piano Tiles round (21), and the microphone/audio regression suite (315). Script syntax, TypeScript, and whitespace checks also passed. The speech tests use simulated microphone frames and native transcripts; they do not establish real-device recognition accuracy. Visual checks covered 393×852 and 320×568 layouts. This follow-up is not merged, deployed, or included in the redesign's earlier 63-suite receipt. The full battery is required again before pushing.

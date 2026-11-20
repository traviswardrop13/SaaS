# Existing practice dialogue

`Content/PracticeDialogue.json` snapshots the shipping practice page's own line builders and existing recorded models. `PracticeDialogueCatalog.load()` reads it; `sound("S")?.prompt(repetitions: catalog.defaultRepetitions, first: true)` returns the exact first ask. The same record holds repeat asks, the retry cue, the existing step-down-to-sound line and the original clip references.

Run `node native/family-ios/tools/export-practice-dialogue.mjs --check` to verify freshness against both source files, every referenced recording and the bundled sound-only WAVs. Run without `--check` to regenerate after reviewing a source change. Source hashes, line references and audio hashes are recorded in the JSON.

This is data only. It starts no microphone or voice, generates no audio, picks no rung or homework, and records no practice. Target templates are existing authored frames; they may only receive a target selected by the approved content rules. The explicit WAVs contain Rachel's existing adult sound recordings. The MP3 references are the existing whole-line fallback takes, not new child voices. They are referenced, not newly copied into the preview.

The exported speaker/microphone gaps describe the current implementation; they are not permission to alter scoring or timing. A full native session still needs parity for target and position selection, cue-once state, spoken model delivery, pause/cleanup, on-device evidence and verdicts, partial tries, homework, rung advancement and rep accounting. This snapshot alone does not establish that parity.

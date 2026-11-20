# Sona native family rebuild

Open `SonaNativePreview.xcodeproj` in Xcode, select **SonaNativePreview** and an iPhone Simulator, and press Run. The preview uses a separate bundle ID. Work stays on `codex/sona-native-family`. [Design changes for review](DESIGN-CHANGES.md)

The first screen offers both regular setup and **I have a login from my speech therapist**. The local build uses the existing family-login, clinician coverage, consent enrollment, and family-password endpoints on `app.speaksona.com`. A verified covered household goes directly to its games and books after making the sharing choice. An unconfirmed or uncovered connection does not confer Premium.

The preview includes a native Home, a playable subset of the Arcade, the existing Books catalog, a native sound-model player, and Grown-ups. Game completions and manual book progress are preview records. Spoken practice and the full game catalog still need parity before release.

## Release checks

1. Verify a dedicated, dashboard-issued family login with confirmed Premium coverage on the live server. Exercise both sharing decisions on dedicated test slots, confirm the consented row in the dashboard, verify the first target attaches when the invitation carries one, confirm restart state, and verify changing the disposable password. Keep credentials out of logs and screenshots.
2. Port the existing clinical session and game/reading speech turns. Preserve the approved words, cue recordings and timing, speech rules, privacy, and Rachel wording. Audio input stays on the phone and in memory.
3. Preserve all existing device data and access. Verify that an upgrade under `com.speaksona.app` retains each profile, progress, homework, eligible purchase, and the existing free-era and founding promises. Verify repeatable migration and Restore Purchases with the same products and offer terms.
4. Complete the rest of the native catalog and review the design changes with Travis and Rachel. Release work waits for Travis’s explicit “merge.”

## Local login contract test

Run the following from this checkout. The test intercepts requests with fictional responses and makes zero live calls.

```sh
test_dir=$(mktemp -d)
swiftc native/family-ios/SonaNativePreview/Sources/FamilyLoginClient.swift \
  native/family-ios/tests/FamilyLoginContract.swift \
  -o "$test_dir/family-login-contract"
"$test_dir/family-login-contract"
```

# Sona (native app)

The React Native (Expo) rebuild of the speech-therapy practice app — the
real product that will ship to the App Store. The Next.js web app in the
repo root stays as a marketing/demo surface.

## Stack

- **Expo** (SDK 52) + **Expo Router** (file-based routing, like Next.js)
- **NativeWind** (Tailwind for React Native)
- **react-native-svg** for the talking face + sagittal mouth diagram
- **expo-speech** for text-to-speech
- **@react-native-voice/voice** for on-device speech recognition (iOS
  `SFSpeechRecognizer` / Android `SpeechRecognizer`) — much better at
  children's speech than the browser API. Requires a dev build (below).
- **AsyncStorage** for local persistence

## Shared logic

`lib/lessons.ts`, `lib/scoring.ts`, and `lib/clipVariants.ts` are ported
verbatim from the web app — they're pure TypeScript with no DOM
dependencies. `lib/store.tsx` is the native rewrite of the web's
`storage.ts` (React context over AsyncStorage instead of localStorage).

## Run it locally

You need Node 18+ and the Expo tooling.

```bash
cd mobile
npm install
npx expo start
```

Then press `i` for the iOS simulator (Mac + Xcode required) or scan the QR
code with the **Expo Go** app on your phone.

### Speech recognition needs a dev build

`@react-native-voice/voice` is a native module, so it does **not** run in
the standard Expo Go app. Text-to-speech and the whole UI work in Expo Go,
but to test the microphone scoring you need a custom dev client:

```bash
npx expo install @react-native-voice/voice
npx expo prebuild
npx expo run:ios      # builds + installs the dev client on a simulator/device
```

Until then, isolation lessons (which use parent self-rating anyway) work
everywhere, and word/phrase lessons fall back to self-rating when
recognition is unavailable.

## Still TODO before App Store submission

- App icon + splash (`assets/icon.png`, `assets/splash.png`) and re-add the
  references in `app.json`.
- Wire `@react-native-voice/voice` via a dev build and test on a real
  device.
- Full onboarding parity (diagnostic flow, motivation screen, reminders).
- Apple Developer account ($99/yr) + EAS Build for store binaries.

## Building store binaries (later)

```bash
npm install -g eas-cli
eas login
eas build --platform ios
eas submit --platform ios
```

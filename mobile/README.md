# Sona (native app)

The React Native (Expo) rebuild of the speech-therapy practice app — the
real product that will ship to the App Store. The Next.js web app in the
repo root stays as a marketing/demo surface.

## Stack

- **Expo** (SDK 54) + **Expo Router** (file-based routing, like Next.js)
- **NativeWind** (Tailwind for React Native)
- **react-native-svg** for the talking face + sagittal mouth diagram
- **expo-speech** for text-to-speech
- **expo-av** for microphone recording (used by the Speechace cloud-scoring
  flow described below). Works in Expo Go; a dev build is required to publish.
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

### Cloud scoring (Speechace)

The lesson player records the child's voice and uploads it to the
`/api/score` route in the Next.js web app, which forwards to Speechace
(server-side key, never on the device). The phoneme-level score that
comes back drives the great/ok/try-again rating.

To enable it locally:

```bash
cd mobile
npx expo install expo-av
# point the app at your deployed scoring API
echo "EXPO_PUBLIC_API_URL=https://your-vercel-preview.vercel.app" > .env
npx expo start --clear
```

`expo-av` is supported in Expo Go for recording, so you can iterate without
a dev build. For TestFlight / App Store you'll still want a dev build:

```bash
npx expo prebuild
npx expo run:ios      # builds + installs the dev client on a simulator/device
```

Isolation lessons (which can't be scored phonetically) keep the parent
self-rating UI. Word/phrase lessons go through Speechace. If the recorder
isn't available (no `expo-av`), the app gracefully falls back to self-rate.

## App icon & splash

Sources live in `assets/*.svg`. To regenerate the PNGs Expo consumes
(`icon.png`, `adaptive-icon.png`, `splash.png`, `favicon.png`):

```bash
node scripts/generate-assets.js
```

Edit the SVGs, re-run the script, commit the PNGs. The script uses
`sharp` (devDependency).

## Still TODO before App Store submission

- Run `npx expo install expo-av`, set `EXPO_PUBLIC_API_URL`, and test
  recording → cloud scoring on a real device.
- Apple Developer account ($99/yr) + EAS Build for store binaries.

## Building store binaries (later)

```bash
npm install -g eas-cli
eas login
eas build --platform ios
eas submit --platform ios
```

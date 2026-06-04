import * as Speech from "expo-speech";

/**
 * Native speech layer for Sona.
 *
 * Text-to-speech uses expo-speech (works in Expo Go today).
 *
 * Speech *recognition* on-device uses the platform recognizers
 * (iOS SFSpeechRecognizer / Android SpeechRecognizer) via
 * @react-native-voice/voice. That library needs a custom dev build
 * (it won't run in plain Expo Go), so it's wired behind the
 * `recognizeOnce` interface below and activated once we create a dev
 * client. The native recognizers are dramatically better at children's
 * speech than the browser Web Speech API was — this is the main reason
 * we went native.
 */

export type RecognitionAlternative = {
  transcript: string;
  confidence: number;
};

export function speak(
  text: string,
  opts?: { onStart?: () => void; onEnd?: () => void; rate?: number },
) {
  Speech.stop();
  Speech.speak(text, {
    language: "en-US",
    rate: opts?.rate ?? 0.8,
    pitch: 1.15,
    onStart: () => opts?.onStart?.(),
    onDone: () => opts?.onEnd?.(),
    onStopped: () => opts?.onEnd?.(),
    onError: () => opts?.onEnd?.(),
  });
}

/**
 * Recognition handle returned while listening. Call stop() to finish early.
 */
export type RecognitionHandle = { stop: () => void };

/**
 * Lazy bridge to @react-native-voice/voice. We require() it dynamically so
 * the JS bundle still loads in Expo Go (where the native module is absent);
 * callers get `supported: false` instead of a crash. Typed loosely because
 * the package is only present once a custom dev build is created.
 */
type VoiceLike = {
  start: (locale: string) => Promise<void>;
  stop: () => Promise<void>;
  onSpeechResults?: (e: { value?: string[] }) => void;
  onSpeechPartialResults?: (e: { value?: string[] }) => void;
  onSpeechError?: (e: { error?: { message?: string } }) => void;
  onSpeechEnd?: (e: unknown) => void;
};

let voiceModule: VoiceLike | null = null;
let voiceTried = false;

function getVoice(): VoiceLike | null {
  if (voiceTried) return voiceModule;
  voiceTried = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    voiceModule = require("@react-native-voice/voice").default as VoiceLike;
  } catch {
    voiceModule = null;
  }
  return voiceModule;
}

export function isRecognitionSupported(): boolean {
  return getVoice() != null;
}

/**
 * Listen once and stream alternatives back. Mirrors the web API shape so the
 * shared scoring code (lib/scoring.ts) is unchanged.
 */
export function startRecognition(opts: {
  onResult: (alts: RecognitionAlternative[], isFinal: boolean) => void;
  onError: (err: string) => void;
  onEnd: () => void;
  maxDurationMs?: number;
}): RecognitionHandle | null {
  const Voice = getVoice();
  if (!Voice) {
    opts.onError("not-supported");
    return null;
  }

  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const cleanup = () => {
    Voice.onSpeechResults = undefined;
    Voice.onSpeechPartialResults = undefined;
    Voice.onSpeechError = undefined;
    Voice.onSpeechEnd = undefined;
  };

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (timer) clearTimeout(timer);
    Voice.stop().catch(() => {});
    cleanup();
    opts.onEnd();
  };

  Voice.onSpeechPartialResults = (e: { value?: string[] }) => {
    const alts = (e.value ?? []).map((t, i) => ({
      transcript: t,
      confidence: i === 0 ? 0.6 : 0.4,
    }));
    if (alts.length) opts.onResult(alts, false);
  };
  Voice.onSpeechResults = (e: { value?: string[] }) => {
    const alts = (e.value ?? []).map((t, i) => ({
      transcript: t,
      confidence: i === 0 ? 0.9 : 0.5,
    }));
    if (alts.length) opts.onResult(alts, true);
    stop();
  };
  Voice.onSpeechError = (e: { error?: { message?: string } }) => {
    opts.onError(e.error?.message ?? "unknown");
    stop();
  };

  Voice.start("en-US").catch((err: unknown) => {
    opts.onError(err instanceof Error ? err.message : "start-failed");
  });

  timer = setTimeout(stop, opts.maxDurationMs ?? 6000);
  return { stop };
}

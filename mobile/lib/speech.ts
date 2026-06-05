import * as Speech from "expo-speech";
import { configurePlaybackAudio } from "./recorder";

/**
 * Native speech layer for Sona.
 *
 * Text-to-speech uses expo-speech. iOS routes TTS through the shared audio
 * session, which by default can be quiet (earpiece / silenced on the ring
 * switch). So before *every* utterance we force a loud playback session
 * (speaker, plays on silent) and set volume to max.
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
  // Make sure the audio session is loud playback BEFORE speaking, then speak.
  configurePlaybackAudio().finally(() => {
    const options: Speech.SpeechOptions = {
      language: "en-US",
      rate: opts?.rate ?? 0.75,
      pitch: 1.12,
      onStart: () => opts?.onStart?.(),
      onDone: () => opts?.onEnd?.(),
      onStopped: () => opts?.onEnd?.(),
      onError: () => opts?.onEnd?.(),
    };
    // `volume` isn't in every expo-speech type version but is honored at runtime.
    (options as Record<string, unknown>).volume = 1.0;
    Speech.speak(text, options);
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

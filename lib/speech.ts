"use client";

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export type RecognitionAlternative = {
  transcript: string;
  confidence: number;
};

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export type RecognitionHandle = {
  stop: () => void;
};

/**
 * Start a single recognition session. Emits the *full* alternatives array
 * (transcript + confidence for each of N guesses) rather than just one
 * transcript — downstream scoring picks the best match against the target
 * word, which works much better for kid speech than trusting the top guess.
 *
 * `continuous: true` + an explicit timeout gives kids who hesitate a real
 * chance to finish their word. The recognizer will still auto-stop when a
 * final result comes in or when the timeout fires, whichever is first.
 */
export function startRecognition(opts: {
  onResult: (alternatives: RecognitionAlternative[], isFinal: boolean) => void;
  onError: (err: string) => void;
  onEnd: () => void;
  /** Hard cap on listening duration in ms. Default 6000. */
  maxDurationMs?: number;
}): RecognitionHandle | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec: any = new Ctor();
  rec.lang = "en-US";
  rec.interimResults = true;
  rec.continuous = true;
  rec.maxAlternatives = 5;

  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (timer) clearTimeout(timer);
    try {
      rec.stop();
    } catch {
      // ignore
    }
  };

  rec.onresult = (event: any) => {
    // Aggregate across results: keep the most recent final (or, if none yet,
    // the latest interim). The recognizer can split an utterance across
    // multiple results when `continuous: true`.
    let chosen: any = null;
    let chosenIsFinal = false;
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const r = event.results[i];
      if (r.isFinal) {
        chosen = r;
        chosenIsFinal = true;
      } else if (!chosenIsFinal) {
        chosen = r;
      }
    }
    if (!chosen) return;
    const alternatives: RecognitionAlternative[] = [];
    for (let i = 0; i < chosen.length; i++) {
      const a = chosen[i];
      if (a?.transcript) {
        alternatives.push({
          transcript: a.transcript.trim(),
          confidence: typeof a.confidence === "number" ? a.confidence : 0.5,
        });
      }
    }
    if (alternatives.length === 0) return;
    opts.onResult(alternatives, chosenIsFinal);
    if (chosenIsFinal) stop();
  };
  rec.onerror = (event: any) => opts.onError(event.error ?? "unknown");
  rec.onend = () => {
    if (timer) clearTimeout(timer);
    opts.onEnd();
  };

  try {
    rec.start();
    timer = setTimeout(stop, opts.maxDurationMs ?? 6000);
  } catch (e: any) {
    opts.onError(e?.message ?? "start failed");
    return null;
  }

  return { stop };
}

/**
 * Request microphone access ahead of time so the first recognition in a
 * lesson doesn't have visible permission / audio-context lag. Safe to call
 * repeatedly — granted permission is cached by the browser.
 */
export async function prewarmMicrophone(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia)
    return false;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch {
    return false;
  }
}

let cachedVoice: SpeechSynthesisVoice | null | undefined;

function pickVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice !== undefined) return cachedVoice;
  if (typeof window === "undefined" || !window.speechSynthesis) {
    cachedVoice = null;
    return cachedVoice;
  }
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) {
    // Voices load async on some browsers; let caller try again later.
    return null;
  }
  cachedVoice =
    voices.find(
      (v) =>
        v.lang.startsWith("en") &&
        /child|kid|samantha|karen|google us english|female/i.test(v.name),
    ) ??
    voices.find((v) => v.lang.startsWith("en")) ??
    null;
  return cachedVoice;
}

export function speak(text: string, opts?: { rate?: number; pitch?: number }) {
  if (typeof window === "undefined") return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = opts?.rate ?? 0.8;
  u.pitch = opts?.pitch ?? 1.15;
  const voice = pickVoice();
  if (voice) u.voice = voice;
  synth.speak(u);
}

"use client";

type Recognition = any;

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export type RecognitionHandle = {
  stop: () => void;
};

export function startRecognition(opts: {
  onResult: (transcript: string, isFinal: boolean) => void;
  onError: (err: string) => void;
  onEnd: () => void;
}): RecognitionHandle | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec: Recognition = new Ctor();
  rec.lang = "en-US";
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 3;

  rec.onresult = (event: any) => {
    let combined = "";
    let isFinal = false;
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const r = event.results[i];
      // Use the top alternative but also consider others — kids' speech is messy.
      let best = r[0]?.transcript ?? "";
      for (let a = 1; a < r.length; a++) {
        if ((r[a]?.transcript?.length ?? 0) > best.length) best = r[a].transcript;
      }
      combined += best;
      if (r.isFinal) isFinal = true;
    }
    opts.onResult(combined.trim(), isFinal);
  };
  rec.onerror = (event: any) => opts.onError(event.error ?? "unknown");
  rec.onend = () => opts.onEnd();

  try {
    rec.start();
  } catch (e: any) {
    opts.onError(e?.message ?? "start failed");
    return null;
  }

  return {
    stop: () => {
      try {
        rec.stop();
      } catch {
        // ignore
      }
    },
  };
}

export function speak(text: string, opts?: { rate?: number; pitch?: number }) {
  if (typeof window === "undefined") return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = opts?.rate ?? 0.85;
  u.pitch = opts?.pitch ?? 1.1;
  // Try to pick a friendly English voice if one is available.
  const voices = synth.getVoices();
  const preferred = voices.find(
    (v) =>
      v.lang.startsWith("en") &&
      /samantha|karen|google us english|female/i.test(v.name),
  );
  if (preferred) u.voice = preferred;
  synth.speak(u);
}

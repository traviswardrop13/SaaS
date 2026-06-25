"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const WORDS = [
  { emoji: "🐰", word: "Rabbit", sound: "R", praise: 'Awesome "R" sound!', rating: 3 },
  { emoji: "☀️", word: "Sun", sound: "S", praise: 'Perfect "S"!', rating: 3 },
  { emoji: "🦁", word: "Lion", sound: "L", praise: 'Beautiful "L"!', rating: 2 },
];

const SPEECHES = [
  { before: "Let's try this one!", after: "You said it!" },
  { before: "Your turn!", after: "Nailed it!" },
  { before: "One more!", after: "Amazing!" },
];

type DemoState = "idle" | "ready" | "listening" | "scoring" | "done";

export default function InteractiveDemo() {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<DemoState>("idle");
  const [speechText, setSpeechText] = useState("");
  const [speechVisible, setSpeechVisible] = useState(false);
  const [wordVisible, setWordVisible] = useState(false);
  const [scoreVisible, setScoreVisible] = useState(false);
  const [ctaVisible, setCtaVisible] = useState(false);
  const [starsPopped, setStarsPopped] = useState([false, false, false]);
  const [confetti, setConfetti] = useState<{ id: number; left: string; bg: string; w: string; h: string; dur: string; delay: string; round: boolean }[]>([]);
  const autoRef = useRef(true);
  const confettiId = useRef(0);

  const loadWord = useCallback((idx: number) => {
    setWordVisible(false);
    setSpeechVisible(false);
    setTimeout(() => {
      setSpeechText(`${SPEECHES[idx].before} <span style="color:#1cb0f6;font-size:18px">"${WORDS[idx].word}"</span>`);
      setSpeechVisible(true);
    }, 300);
    setTimeout(() => {
      setWordVisible(true);
      setState("ready");
    }, 800);
  }, []);

  const spawnConfetti = useCallback(() => {
    const colors = ["#ff9600", "#1cb0f6", "#58cc02", "#ff4b4b", "#ffd400", "#a855f7"];
    const items = Array.from({ length: 30 }, (_, i) => ({
      id: confettiId.current++,
      left: `${Math.random() * 100}%`,
      bg: colors[Math.floor(Math.random() * colors.length)],
      w: `${5 + Math.random() * 6}px`,
      h: `${5 + Math.random() * 6}px`,
      dur: `${1 + Math.random() * 1.5}s`,
      delay: `${Math.random() * 0.3}s`,
      round: Math.random() > 0.5,
    }));
    setConfetti(items);
    setTimeout(() => setConfetti([]), 2500);
  }, []);

  const handleMic = useCallback(() => {
    if (state !== "ready") return;
    autoRef.current = false;
    setState("listening");
    setSpeechVisible(false);

    setTimeout(() => {
      setState("scoring");
      setStarsPopped([false, false, false]);
      setScoreVisible(true);
      spawnConfetti();
      setTimeout(() => setStarsPopped((s) => [true, s[1], s[2]]), 200);
      setTimeout(() => setStarsPopped((s) => [s[0], true, s[2]]), 450);
      if (WORDS[step].rating >= 3) {
        setTimeout(() => setStarsPopped([true, true, true]), 700);
      }

      setTimeout(() => {
        setScoreVisible(false);
        const next = step + 1;
        if (next >= WORDS.length) {
          setTimeout(() => { setCtaVisible(true); setState("done"); }, 400);
        } else {
          setStep(next);
          setTimeout(() => loadWord(next), 400);
        }
      }, 2200);
    }, 1500);
  }, [state, step, loadWord, spawnConfetti]);

  const replay = useCallback(() => {
    setStep(0);
    setCtaVisible(false);
    setScoreVisible(false);
    autoRef.current = false;
    setTimeout(() => loadWord(0), 200);
  }, [loadWord]);

  // Boot sequence
  useEffect(() => {
    const t1 = setTimeout(() => {
      setSpeechText("Hi! I'm Leo 🦁<br/>Let's practice some sounds!");
      setSpeechVisible(true);
    }, 600);
    const t2 = setTimeout(() => loadWord(0), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [loadWord]);

  // Auto-play
  useEffect(() => {
    if (state !== "ready" || !autoRef.current) return;
    const t = setTimeout(() => {
      if (autoRef.current && state === "ready") {
        setState("listening");
        setSpeechVisible(false);
        setTimeout(() => {
          setState("scoring");
          setStarsPopped([false, false, false]);
          setScoreVisible(true);
          spawnConfetti();
          setTimeout(() => setStarsPopped((s) => [true, s[1], s[2]]), 200);
          setTimeout(() => setStarsPopped((s) => [s[0], true, s[2]]), 450);
          if (WORDS[step].rating >= 3) {
            setTimeout(() => setStarsPopped([true, true, true]), 700);
          }
          setTimeout(() => {
            setScoreVisible(false);
            const next = step + 1;
            if (next >= WORDS.length) {
              setTimeout(() => { setCtaVisible(true); setState("done"); }, 400);
            } else {
              setStep(next);
              setTimeout(() => loadWord(next), 400);
            }
          }, 2200);
        }, 1500);
      }
    }, 2000);
    return () => clearTimeout(t);
  }, [state, step, loadWord, spawnConfetti]);

  const w = WORDS[step] || WORDS[0];

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white to-brand-50 py-16">
      <div className="mx-auto max-w-2xl px-5 text-center">
        <p className="text-sm font-extrabold uppercase tracking-wide text-brand-500">
          See it in action
        </p>
        <h2 className="mt-2 font-display text-3xl font-extrabold text-gray-900 sm:text-4xl">
          A real Sona session
        </h2>
        <p className="mt-2 text-gray-600">
          Watch how Leo coaches your child through speech sounds — or tap the mic yourself.
        </p>
      </div>

      <div className="mx-auto mt-10 flex justify-center">
        {/* Phone frame */}
        <div className="relative w-[340px] h-[640px] rounded-[44px] bg-white overflow-hidden select-none"
          style={{ boxShadow: "0 30px 60px -12px rgba(20,60,120,.25), 0 0 0 2px #c8d8e8" }}>

          {/* Scene */}
          <div className="absolute inset-0 flex flex-col">
            <div className="relative flex-1 overflow-hidden"
              style={{ background: "linear-gradient(180deg,#bfe9ff 0%,#dff4ff 55%,#b2e8a4 75%,#8fd37a 100%)" }}>

              {/* Clouds */}
              <Cloud className="top-[12%] left-[10%]" dur="14s" />
              <Cloud className="top-[22%] left-[65%]" dur="18s" delay="4s" />
              <Cloud className="top-[8%] left-[40%]" dur="20s" delay="7s" />

              {/* Leo */}
              <div className="absolute bottom-[26%] left-1/2 -translate-x-1/2 flex flex-col items-center z-[3]">
                <div className={`relative bg-white rounded-2xl px-4 py-2.5 text-center max-w-[240px] transition-all duration-400 ${speechVisible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-[.8] translate-y-2.5"}`}
                  style={{ boxShadow: "0 6px 18px rgba(20,80,140,.12)" }}>
                  <p className="font-extrabold text-[15px] text-gray-800"
                    dangerouslySetInnerHTML={{ __html: speechText }} />
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0"
                    style={{ borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderTop: "10px solid #fff" }} />
                </div>
                <img src="/coach/leo.png" alt="Leo" className="w-[120px] h-[120px] object-contain mt-2 drop-shadow-lg"
                  style={{ animation: "demo-bob 2.5s ease-in-out infinite" }} />
              </div>

              {/* Ground */}
              <div className="absolute bottom-0 left-0 right-0 h-[22%] z-[1]"
                style={{ background: "linear-gradient(180deg,#6cc644,#4da82e)", borderRadius: "50% 50% 0 0 / 20% 20% 0 0" }} />

              {/* Flowers */}
              <span className="absolute bottom-[2%] left-[8%] z-[2] text-base" style={{ animation: "demo-sway 3s ease-in-out infinite" }}>🌸</span>
              <span className="absolute bottom-[2%] left-[25%] z-[2] text-base" style={{ animation: "demo-sway 2.5s ease-in-out infinite .5s" }}>🌼</span>
              <span className="absolute bottom-[2%] right-[20%] z-[2] text-base" style={{ animation: "demo-sway 3.5s ease-in-out infinite 1s" }}>🌷</span>
              <span className="absolute bottom-[2%] right-[8%] z-[2] text-base" style={{ animation: "demo-sway 2.8s ease-in-out infinite 1.5s" }}>🌻</span>
            </div>

            {/* Bottom panel */}
            <div className="relative z-[5] flex flex-col items-center gap-2 px-5 pb-6 pt-4"
              style={{ background: "linear-gradient(180deg,rgba(255,255,255,0),rgba(255,255,255,.95) 20%)" }}>

              {/* Progress dots */}
              <div className="flex gap-2 mb-1">
                {WORDS.map((_, i) => (
                  <div key={i} className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                    i < step ? "bg-green-500 scale-[1.2]" :
                    i === step ? "bg-sky-500" : "bg-gray-200"
                  }`} style={i === step ? { animation: "demo-dot-pulse 1.5s infinite" } : {}} />
                ))}
              </div>

              <p className="font-extrabold text-sm text-sky-500 min-h-[20px] text-center">
                {state === "listening" ? "Listening..." : state === "ready" ? "Tap the mic and say it!" : "\u00A0"}
              </p>

              {/* Word card */}
              <div className={`flex items-center gap-3 bg-white rounded-2xl px-5 py-2 transition-all duration-500 ${
                wordVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
              }`} style={{ border: "2px solid #e8eef4", borderBottomWidth: 4, boxShadow: "0 6px 18px rgba(20,120,200,.08)" }}>
                <span className="text-3xl leading-none">{w.emoji}</span>
                <span className="font-display font-extrabold text-2xl text-sky-500">{w.word}</span>
              </div>

              {/* Mic button */}
              <button onClick={handleMic}
                className={`relative w-20 h-20 rounded-full border-none flex items-center justify-center cursor-pointer overflow-hidden ${
                  state === "listening" ? "" : ""
                }`}
                style={{
                  background: "radial-gradient(circle at 50% 30%,#5cc6ff,#1cb0f6 60%,#1597d4)",
                  boxShadow: "0 6px 0 0 #0f7fb5, inset 0 3px 7px rgba(255,255,255,.45)",
                  animation: state === "listening" ? "demo-pulse 1.2s infinite" : undefined,
                }}>
                {/* Glow ring */}
                {state === "ready" && (
                  <div className="absolute -inset-1 rounded-full"
                    style={{ background: "rgba(28,176,246,.3)", animation: "demo-mic-pulse 2s ease-in-out infinite" }} />
                )}
                {state === "listening" ? (
                  <div className="relative z-[2] flex gap-[3px] items-center h-9">
                    {[12,20,28,20,12].map((h, i) => (
                      <i key={i} className="block w-1 bg-white rounded-full"
                        style={{ height: h, animation: `demo-wave .6s ease-in-out infinite alternate ${i * 0.1}s` }} />
                    ))}
                  </div>
                ) : (
                  <svg className="relative z-[2] w-9 h-9 fill-white" viewBox="0 0 24 24">
                    <path d="M12 1a4 4 0 0 0-4 4v6a4 4 0 0 0 8 0V5a4 4 0 0 0-4-4Z" />
                    <path d="M19 10v1a7 7 0 0 1-14 0v-1" fill="none" stroke="white" strokeWidth="2" />
                    <line x1="12" y1="19" x2="12" y2="23" stroke="white" strokeWidth="2" />
                    <line x1="8" y1="23" x2="16" y2="23" stroke="white" strokeWidth="2" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Score overlay */}
          <div className={`absolute inset-0 flex flex-col items-center justify-center z-20 transition-opacity duration-400 ${
            scoreVisible ? "opacity-100" : "opacity-0 pointer-events-none"
          }`} style={{ background: "rgba(16,36,58,.4)", backdropFilter: "blur(4px)" }}>
            <div className={`bg-white rounded-[28px] px-8 py-7 text-center transition-transform duration-500 ${
              scoreVisible ? "scale-100" : "scale-[.7]"
            }`} style={{ boxShadow: "0 20px 50px rgba(20,60,120,.3)", transitionTimingFunction: "cubic-bezier(.34,1.56,.64,1)" }}>
              <div className="text-[42px] tracking-[4px] leading-none">
                {starsPopped.map((popped, i) => (
                  <span key={i} className={`inline-block transition-all duration-400 ${
                    popped ? "opacity-100 scale-100 rotate-0" : "opacity-0 scale-0 -rotate-[30deg]"
                  }`} style={{ transitionTimingFunction: "cubic-bezier(.34,1.56,.64,1)" }}>⭐</span>
                ))}
              </div>
              <p className="font-display font-extrabold text-xl text-gray-800 mt-2">
                {SPEECHES[step]?.after || "Great!"}
              </p>
              <p className="font-bold text-sm text-gray-500 mt-1">{w.praise}</p>
            </div>
          </div>

          {/* Confetti */}
          <div className="absolute inset-0 pointer-events-none z-[25] overflow-hidden">
            {confetti.map((c) => (
              <div key={c.id} className="absolute" style={{
                left: c.left, width: c.w, height: c.h,
                background: c.bg, borderRadius: c.round ? "50%" : "2px",
                animation: `demo-fall ${c.dur} ease-out ${c.delay} forwards`,
              }} />
            ))}
          </div>

          {/* CTA overlay */}
          <div className={`absolute inset-0 flex flex-col items-center justify-center z-30 p-6 transition-opacity duration-500 ${
            ctaVisible ? "opacity-100" : "opacity-0 pointer-events-none"
          }`} style={{ background: "linear-gradient(180deg,rgba(191,233,255,.95),rgba(234,251,233,.95))" }}>
            <img src="/coach/leo.png" alt="Leo" className="w-[100px] h-[100px] object-contain"
              style={{ animation: "demo-bob 2s ease-in-out infinite" }} />
            <p className="font-display font-extrabold text-2xl text-gray-800 mt-3 text-center leading-tight">
              That&apos;s how Sona works! 🎉
            </p>
            <p className="font-bold text-sm text-gray-500 mt-2 text-center max-w-[260px] leading-relaxed">
              AI listens to every word, gives instant feedback, and tracks progress — all in a game kids love.
            </p>
            <div className="flex gap-4 mt-4">
              <div className="text-center">
                <p className="font-display font-extrabold text-3xl text-sky-500 leading-none">8+</p>
                <p className="font-bold text-xs text-gray-500 mt-0.5">Games</p>
              </div>
              <div className="text-center">
                <p className="font-display font-extrabold text-3xl text-sky-500 leading-none">5</p>
                <p className="font-bold text-xs text-gray-500 mt-0.5">min/day</p>
              </div>
              <div className="text-center">
                <p className="font-display font-extrabold text-3xl text-sky-500 leading-none">📈</p>
                <p className="font-bold text-xs text-gray-500 mt-0.5">Real progress</p>
              </div>
            </div>
            <a href="/onboarding.html"
              className="block w-full max-w-[260px] mt-5 rounded-2xl px-6 py-4 text-center font-display font-extrabold text-white text-lg no-underline"
              style={{ background: "linear-gradient(180deg,#ff9f43,#ff8a3d)", boxShadow: "0 6px 0 0 #e06d1f" }}>
              Try it free — 7 days
            </a>
            <button onClick={replay}
              className="bg-transparent border-none text-sky-500 font-extrabold text-sm cursor-pointer mt-3 underline">
              ↻ Watch again
            </button>
          </div>
        </div>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes demo-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
        @keyframes demo-sway { 0%,100% { transform: rotate(-3deg) } 50% { transform: rotate(3deg) } }
        @keyframes demo-pulse { 0% { box-shadow: 0 0 0 0 rgba(28,176,246,.5), 0 6px 0 0 #0f7fb5 } 70% { box-shadow: 0 0 0 16px rgba(28,176,246,0), 0 6px 0 0 #0f7fb5 } 100% { box-shadow: 0 0 0 0 rgba(28,176,246,0), 0 6px 0 0 #0f7fb5 } }
        @keyframes demo-mic-pulse { 0% { transform: scale(.9); opacity: .6 } 50% { transform: scale(1.15); opacity: .2 } 100% { transform: scale(.9); opacity: .6 } }
        @keyframes demo-wave { 0% { height: 8px } 100% { height: 28px } }
        @keyframes demo-dot-pulse { 0%,100% { transform: scale(1) } 50% { transform: scale(1.3) } }
        @keyframes demo-fall { 0% { transform: translateY(-20px) rotate(0); opacity: 1 } 100% { transform: translateY(700px) rotate(720deg); opacity: 0 } }
        @keyframes demo-drift { 0% { transform: translateX(0) } 100% { transform: translateX(-400px); opacity: 0 } }
      `}</style>
    </section>
  );
}

function Cloud({ className, dur, delay }: { className: string; dur: string; delay?: string }) {
  return (
    <div className={`absolute opacity-90 ${className}`}
      style={{
        width: 70, height: 28, background: "#fff", borderRadius: "50%",
        animation: `demo-drift ${dur} linear infinite ${delay || "0s"}`,
      }}>
      <div className="absolute bg-white rounded-full" style={{ width: "55%", height: "140%", top: "-40%", left: "20%" }} />
      <div className="absolute bg-white rounded-full" style={{ width: "45%", height: "120%", top: "-30%", right: "15%" }} />
    </div>
  );
}

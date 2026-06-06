import { useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { findLesson, LEVEL_INFO } from "@/lib/lessons";
import { type ScoreResult } from "@/lib/scoring";
import { speak } from "@/lib/speech";
import {
  startRecording,
  isRecordingSupported,
  configurePlaybackAudio,
  type RecorderHandle,
} from "@/lib/recorder";
import { scoreAudio, type CloudScore } from "@/lib/cloudScoring";
import { useStore } from "@/lib/store";
import { Button, ProgressBar } from "@/components/ui";
import LeoImage, { type LeoMood } from "@/components/LeoImage";
import MouthModel from "@/components/MouthModel";
import { MicIcon } from "@/components/icons";
import Confetti from "@/components/Confetti";
import {
  hapticSuccess,
  hapticWarning,
  hapticLight,
  hapticListenStart,
  hapticStarReveal,
  hapticCoinAward,
  hapticCelebrate,
} from "@/lib/haptics";
import { leoLessonCheer } from "@/lib/leo";

type Phase = "prompt" | "listening" | "scoring" | "result" | "done";

// Coins reward for finishing a lesson — a base plus a per-star bonus, so
// doing better earns more to spend in Leo's World.
const COINS_BASE = 10;
const COINS_PER_STAR = 10;

export default function Lesson() {
  const router = useRouter();
  const { skillId, lessonId } = useLocalSearchParams<{
    skillId: string;
    lessonId: string;
  }>();
  const { activeChild, recordLessonComplete } = useStore();

  const info = findLesson(skillId ?? "", lessonId ?? "");

  const [phase, setPhase] = useState<Phase>("prompt");
  const [wordIdx, setWordIdx] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [scores, setScores] = useState<number[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // TEMP: holds the last raw cloud score so we can show the numbers on the
  // result screen while we calibrate strictness. Remove once dialed in.
  const [lastCloud, setLastCloud] = useState<CloudScore | null>(null);
  // Bumped to fire the celebratory coin/confetti burst on the done screen.
  const [fireKey, setFireKey] = useState(0);
  const recorderRef = useRef<RecorderHandle | null>(null);
  // Auto-stop timer for the hands-free flow (records for a fixed window after
  // Leo speaks, so the child never has to press a button to record).
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lesson = info?.lesson;
  const word = lesson?.words[wordIdx];
  // Cloud scoring is used whenever the recorder is available (dev build with
  // expo-av installed). Isolation lessons now use simple CV syllables like
  // "sah" / "rah" which Speechace can score, so every level is gradeable.
  // Falls back to parent self-rating only when recording isn't supported.
  const useCloud = isRecordingSupported();
  const useSelfRate = !useCloud;

  // Loud playback so Leo is actually audible (speaker, not earpiece; plays
  // even on silent). Runs once when the lesson opens.
  useEffect(() => {
    configurePlaybackAudio();
  }, []);

  // Hands-free flow: when arriving at a new prompt, Leo says the word
  // automatically, and the moment he finishes the mic goes live and starts
  // listening — the child just repeats, no buttons. (Falls back to the manual
  // mic / self-rate when the recorder isn't available.)
  useEffect(() => {
    if (phase === "prompt" && word) {
      speak(word.text, {
        onStart: () => setSpeaking(true),
        onEnd: () => {
          setSpeaking(false);
          if (useCloud) beginListening();
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, wordIdx]);

  useEffect(
    () => () => {
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      recorderRef.current?.stop().catch(() => {});
    },
    [],
  );

  // Celebration buzz pattern when the done screen appears: heavy thump +
  // success ding for the confetti, a tap per star as they reveal, then a
  // coin chime for the reward. Lands in sync with the visuals.
  useEffect(() => {
    if (phase !== "done") return;
    const avg = scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length);
    const stars = avg >= 0.85 ? 3 : avg >= 0.65 ? 2 : 1;
    hapticCelebrate();
    const starsT = setTimeout(() => hapticStarReveal(stars), 380);
    const coinsT = setTimeout(() => hapticCoinAward(), 380 + stars * 220 + 120);
    // Let the buzz pattern land first, then Leo cheers out loud.
    const cheerT = setTimeout(
      () => leoLessonCheer(activeChild?.name),
      380 + stars * 220 + 300,
    );
    return () => {
      clearTimeout(starsT);
      clearTimeout(coinsT);
      clearTimeout(cheerT);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (!info || !lesson || !word || !activeChild) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-lg text-gray-600">Lesson not found.</Text>
        <View className="mt-4 w-full max-w-xs">
          <Button label="Back to map" onPress={() => router.replace("/home")} />
        </View>
      </SafeAreaView>
    );
  }

  const { skill } = info;
  const total = lesson.words.length;
  const pct = Math.round((wordIdx / total) * 100);

  // The mascot reacts to the result: celebrate on great, gently encourage on
  // ok, kindly commiserate on try-again. Neutral otherwise.
  const mascotMood: LeoMood =
    phase === "result" && result
      ? result.rating === "great"
        ? "celebrate"
        : result.rating === "ok"
          ? "encourage"
          : "sad"
      : "neutral";

  function playWord() {
    hapticLight();
    if (word)
      speak(word.text, {
        onStart: () => setSpeaking(true),
        onEnd: () => setSpeaking(false),
      });
  }

  // Max time we listen before auto-scoring, so a child never has to tap stop.
  const LISTEN_MS = 4500;

  async function beginListening() {
    setResult(null);
    setErrorMsg(null);
    hapticListenStart();
    setPhase("listening");
    const handle = await startRecording({
      onError: (e) => {
        setErrorMsg(e);
        setPhase("prompt");
      },
    });
    if (!handle) {
      setPhase("prompt");
      return;
    }
    recorderRef.current = handle;
    // Auto-stop + score after the window (child can also tap to finish early).
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    autoStopRef.current = setTimeout(() => stopAndScore(), LISTEN_MS);
  }

  async function stopAndScore() {
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    const handle = recorderRef.current;
    recorderRef.current = null;
    if (!handle) {
      setPhase("prompt");
      return;
    }
    setPhase("scoring");
    const uri = await handle.stop();
    if (!uri) {
      setPhase("prompt");
      return;
    }
    const cloud = await scoreAudio({
      audioUri: uri,
      text: word!.text,
      targetSound: lesson!.targetSound,
      userId: activeChild?.id,
      // Isolation = "can you make the sound at all?" → lenient (target
      // phoneme). Syllables and up → strict (whole-utterance match).
      mode: lesson!.level === "isolation" ? "phoneme" : "full",
    });

    // Surface a backend / network failure so it's diagnosable on-device
    // rather than silently bouncing back to the prompt.
    if (!cloud.ok) {
      setErrorMsg(cloud.error ?? "Scoring failed. Check your connection.");
      setPhase("prompt");
      return;
    }

    // The backend now scores the whole utterance against the prompt (so
    // "ree" no longer passes for "rah") and returns a coaching line.
    const similarity = Math.max(0, Math.min(1, (cloud.score ?? 0) / 100));
    const s: ScoreResult = {
      similarity,
      rating: cloud.rating,
      matchedAgainst: word!.text,
      bestHeard: cloud.transcript,
      hint: cloud.rating === "great" ? undefined : cloud.feedback ?? undefined,
    };
    if (cloud.rating === "great") hapticSuccess();
    else if (cloud.rating === "tryAgain") hapticWarning();
    setLastCloud(cloud);
    setResult(s);
    setScores((p) => [...p, s.similarity]);
    setPhase("result");
  }

  function selfRate(rating: ScoreResult["rating"]) {
    const sim = rating === "great" ? 1 : rating === "ok" ? 0.7 : 0.3;
    setResult({ similarity: sim, rating, matchedAgainst: word!.text, bestHeard: "" });
    setScores((p) => [...p, sim]);
    setPhase("result");
  }

  function nextWord() {
    if (wordIdx + 1 >= total) {
      const avg = scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length);
      const stars = avg >= 0.85 ? 3 : avg >= 0.65 ? 2 : 1;
      recordLessonComplete(activeChild!.id, lesson!.id, {
        stars,
        score: Math.round(avg * 100),
        xpEarned: 10 + stars * 5,
        coinsEarned: COINS_BASE + stars * COINS_PER_STAR,
      });
      setFireKey((k) => k + 1);
      setPhase("done");
    } else {
      setWordIdx((i) => i + 1);
      setResult(null);
      setPhase("prompt");
    }
  }

  if (phase === "done") {
    const avg = scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length);
    const stars = avg >= 0.85 ? 3 : avg >= 0.65 ? 2 : 1;
    const xp = 10 + stars * 5;
    const coins = COINS_BASE + stars * COINS_PER_STAR;
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
        <LeoImage
          speaking={false}
          mood={stars >= 3 ? "holding-star" : "celebrate"}
          size={190}
        />
        <Text className="mt-5 text-3xl font-extrabold font-display text-feather-edge">
          Lesson complete!
        </Text>
        <Text className="mt-1 text-center text-base text-wolf">
          Amazing work, {activeChild.name}! 🎉
        </Text>
        <View className="mt-5 flex-row gap-2">
          {[0, 1, 2].map((i) => (
            <Text
              key={i}
              className="text-5xl"
              style={{ opacity: i < stars ? 1 : 0.18 }}
            >
              ⭐
            </Text>
          ))}
        </View>
        <View className="mt-7 w-full max-w-sm flex-row gap-3">
          <Stat label="Stars" value={`${stars}/3`} />
          <Stat label="XP" value={`+${xp}`} />
          <Stat label="Coins" value={`+${coins}`} />
        </View>
        {/* Coins earned → nudge toward the reward loop */}
        <Pressable
          onPress={() => router.replace("/world")}
          className="mt-4 flex-row items-center gap-2 rounded-2xl border-2 border-bee-edge bg-bee-50 px-4 py-2.5"
        >
          <Text className="text-xl">🪙</Text>
          <Text className="text-sm font-extrabold font-display text-ink">
            +{coins} coins — build Leo's World
          </Text>
        </Pressable>
        <View className="mt-6 w-full max-w-sm">
          <Button
            label="Back to map"
            onPress={() => router.replace("/home")}
          />
        </View>
        <Confetti fireKey={fireKey} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          className="h-9 w-9 items-center justify-center rounded-full bg-polar"
        >
          <Text className="text-lg font-bold font-heading text-hare">✕</Text>
        </Pressable>
        <ProgressBar value={pct / 100} />
      </View>

      <ScrollView className="flex-1 px-6" contentContainerStyle={{ flexGrow: 1 }}>
        {/* Level tag (Duolingo "NEW WORD" style) */}
        <View className="mt-1 flex-row items-center gap-1.5">
          <View className={`h-2.5 w-2.5 rounded-full ${skill.color}`} />
          <Text className="text-xs font-extrabold font-display uppercase tracking-widest text-hare">
            {LEVEL_INFO[lesson.level].label}
          </Text>
        </View>
        <View className="mt-2 flex-row items-center gap-2">
          <LeoImage speaking={speaking} size={44} />
          <Text className="text-2xl font-extrabold font-display text-ink">
            Repeat after Leo
          </Text>
        </View>

        {/* Speech bubble — tap the speaker to hear it; segmented underline
            dots under each word, like Duolingo's speaking prompts. */}
        <View className="mt-7">
          <SpeechBubble text={word.text} emoji={word.emoji} onPlay={playWord} />
        </View>

        {/* During the prompt/your-turn, the mouth model shows HOW to make the
            sound (lips/teeth/tongue). On the result, Leo reacts. */}
        <View className="mt-1 items-center">
          {phase === "result" ? (
            <LeoImage speaking={false} size={200} mood={mascotMood} />
          ) : (
            <MouthModel
              sound={lesson.targetSound}
              playing={phase === "prompt" || phase === "listening"}
              size={210}
            />
          )}
        </View>
        {phase !== "result" ? (
          <Text className="mt-1 text-center text-xs font-extrabold font-display uppercase tracking-widest text-hare">
            Watch the mouth
          </Text>
        ) : null}

        {/* Coaching cue — the articulation tip for this sound. */}
        {phase !== "result" ? (
          <View className="mt-1 flex-row items-center gap-2 self-center rounded-2xl bg-brand-50 px-4 py-2">
            <Text className="text-base">💡</Text>
            <Text className="text-sm font-bold font-heading text-brand-700">{lesson.hint}</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Action area */}
      {phase === "result" && result ? (
        <ResultBanner
          result={result}
          cloud={lastCloud}
          targetSound={lesson.targetSound}
          onNext={nextWord}
          onRetry={() => {
            setResult(null);
            setScores((p) => p.slice(0, -1));
            setPhase("prompt");
          }}
        />
      ) : (
        <View className="px-6 pb-6">
          {errorMsg ? (
            <View className="mb-3 rounded-2xl border-2 border-cardinal bg-cardinal-50 px-4 py-3">
              <Text className="text-center text-sm font-extrabold font-display text-cardinal">
                {errorMsg}
              </Text>
            </View>
          ) : null}
          {useSelfRate ? (
            <View>
              <Text className="mb-2 text-center text-sm font-bold font-heading text-wolf">
                {lesson.level === "isolation"
                  ? "How did your child sound?"
                  : "How did it sound?"}
              </Text>
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Button label="Again" variant="danger" onPress={() => selfRate("tryAgain")} />
                </View>
                <View className="flex-1">
                  <Button label="Okay" variant="secondary" onPress={() => selfRate("ok")} />
                </View>
                <View className="flex-1">
                  <Button label="Great!" onPress={() => selfRate("great")} />
                </View>
              </View>
            </View>
          ) : (
            <View>
            <Pressable
              disabled={phase === "scoring" || speaking}
              onPress={() =>
                phase === "listening" ? stopAndScore() : beginListening()
              }
            >
              {({ pressed }) => {
                // Blue when ready to speak or actively listening; grey only
                // while Leo is talking or while checking. Never red.
                const blue =
                  phase === "listening" || (phase === "prompt" && !speaking);
                const face = blue ? "#1cb0f6" : "#e5e5e5";
                const edge = blue ? "#1899d6" : "#cfcfcf";
                return (
                  <View style={{ backgroundColor: edge, borderRadius: 20 }}>
                    <View
                      className="items-center justify-center"
                      style={{
                        backgroundColor: face,
                        borderRadius: 20,
                        paddingVertical: 20,
                        transform: [{ translateY: pressed ? 4 : 0 }],
                        marginBottom: pressed ? 0 : 5,
                      }}
                    >
                      {phase === "scoring" ? (
                        <Text className="text-base font-extrabold font-display uppercase tracking-wide text-white">
                          Checking…
                        </Text>
                      ) : phase === "listening" ? (
                        <Waveform active />
                      ) : (
                        <MicIcon size={30} color="#ffffff" />
                      )}
                    </View>
                  </View>
                );
              }}
            </Pressable>
            <Text
              className="mt-3 text-center text-sm font-extrabold font-display uppercase tracking-wide"
              style={{ color: phase === "listening" ? "#1899d6" : "#afafaf" }}
            >
              {speaking
                ? "Listen to Leo…"
                : phase === "listening"
                  ? "Speak now — tap when done"
                  : phase === "scoring"
                    ? "Checking…"
                    : "Tap to speak"}
            </Text>
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

// Waveform bars shown inside the speak button (Duolingo speaking style).
// When `active`, the bars jitter to read as "listening to you."
const WAVE_BARS = [12, 22, 32, 18, 34, 16, 28, 14, 24, 30, 16];
function Waveform({ active = false }: { active?: boolean }) {
  const [bars, setBars] = useState<number[]>(WAVE_BARS);
  useEffect(() => {
    if (!active) {
      setBars(WAVE_BARS);
      return;
    }
    const id = setInterval(() => {
      setBars(WAVE_BARS.map(() => 8 + Math.round(Math.random() * 28)));
    }, 130);
    return () => clearInterval(id);
  }, [active]);
  return (
    <View className="flex-row items-center" style={{ height: 34, gap: 6 }}>
      {bars.map((h, i) => (
        <View
          key={i}
          style={{ width: 5, height: h, borderRadius: 3, backgroundColor: "#ffffff" }}
        />
      ))}
    </View>
  );
}

// Dotted underline segment under each word in the prompt bubble.
function Dots({ count }: { count: number }) {
  return (
    <View className="mt-1.5 flex-row" style={{ gap: 4 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: "#c7ccd1" }}
        />
      ))}
    </View>
  );
}

function SpeechBubble({
  text,
  emoji,
  onPlay,
}: {
  text: string;
  emoji?: string;
  onPlay: () => void;
}) {
  const tokens = text.split(" ").filter(Boolean);
  return (
    <View className="items-center">
      <View className="w-full flex-row items-center gap-3 rounded-3xl border-2 border-swan bg-white px-5 py-5">
        <Pressable
          onPress={onPlay}
          className="h-11 w-11 items-center justify-center rounded-2xl"
          style={{ backgroundColor: "#1cb0f6" }}
        >
          <Text className="text-lg text-white">🔊</Text>
        </Pressable>
        <View
          className="flex-1 flex-row flex-wrap items-end"
          style={{ columnGap: 14, rowGap: 8 }}
        >
          {tokens.map((tok, i) => (
            <View key={i} className="items-center">
              <Text className="text-3xl font-extrabold font-display text-ink">{tok}</Text>
              <Dots count={Math.max(4, Math.round(tok.length * 1.6))} />
            </View>
          ))}
        </View>
        {emoji ? <Text className="text-3xl">{emoji}</Text> : null}
      </View>
      {/* Tail pointing down to the lion */}
      <View
        style={{
          marginTop: -10,
          width: 18,
          height: 18,
          backgroundColor: "#ffffff",
          borderRightWidth: 2,
          borderBottomWidth: 2,
          borderColor: "#e5e5e5",
          transform: [{ rotate: "45deg" }],
        }}
      />
    </View>
  );
}

function ResultBanner({
  result,
  cloud,
  targetSound,
  onNext,
  onRetry,
}: {
  result: ScoreResult;
  cloud: CloudScore | null;
  targetSound: string;
  onNext: () => void;
  onRetry: () => void;
}) {
  const great = result.rating === "great";
  const ok = result.rating === "ok";
  const cfg = great
    ? { tint: "#d7ffb8", color: "#58a700", icon: "✓", title: "Perfect!" }
    : ok
      ? { tint: "#ddf4ff", color: "#1899d6", icon: "✓", title: "Almost!" }
      : { tint: "#ffdfe0", color: "#e63232", icon: "↻", title: "Good try!" };
  const starCount = great ? 3 : ok ? 2 : 1;

  return (
    <View
      className="px-6 pt-5 pb-6"
      style={{
        backgroundColor: cfg.tint,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
      }}
    >
      <View className="flex-row items-center gap-3">
        <View
          className="h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: cfg.color }}
        >
          <Text className="text-2xl font-extrabold font-display text-white">{cfg.icon}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-2xl font-extrabold font-display" style={{ color: cfg.color }}>
            {cfg.title}
          </Text>
          {result.hint ? (
            <Text className="mt-0.5 text-sm font-bold font-heading text-ink">{result.hint}</Text>
          ) : null}
        </View>
        <View className="flex-row gap-0.5">
          {[0, 1, 2].map((i) => (
            <Text key={i} className="text-base" style={{ opacity: i < starCount ? 1 : 0.2 }}>
              ⭐
            </Text>
          ))}
        </View>
      </View>

      {/* Calibration debug line (temporary) */}
      {cloud ? (
        <Text className="mt-2 text-[11px] font-bold font-heading text-wolf">
          {`debug · score ${cloud.score ?? "?"} · phoneAvg ${
            cloud.phoneAvg ?? "?"
          } · wordAvg ${cloud.wordAvg ?? "?"} · ${targetSound} ${
            cloud.targetPhoneme ?? "?"
          }${
            cloud.phones?.length
              ? ` · ${cloud.phones
                  .map((p) => `${p.phone}:${p.score ?? "?"}`)
                  .join(" ")}`
              : ""
          }${cloud.transcript ? ` · heard "${cloud.transcript}"` : ""}`}
        </Text>
      ) : null}

      <View className="mt-4 flex-row gap-3">
        {great ? (
          <View className="flex-1">
            <Button label="Continue" variant="primary" onPress={onNext} />
          </View>
        ) : ok ? (
          <>
            <View className="flex-1">
              <Button label="Try again" variant="ghost" icon="🔁" onPress={onRetry} />
            </View>
            <View className="flex-1">
              <Button label="Continue" variant="secondary" onPress={onNext} />
            </View>
          </>
        ) : (
          <>
            <View className="flex-1">
              <Button label="Skip" variant="ghost" onPress={onNext} />
            </View>
            <View className="flex-1">
              <Button label="Try again" variant="primary" icon="🔁" onPress={onRetry} />
            </View>
          </>
        )}
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 rounded-2xl border-2 border-swan bg-polar px-3 py-3">
      <Text className="text-center text-xl font-extrabold font-display text-ink">{value}</Text>
      <Text className="text-center text-[11px] font-bold font-heading uppercase tracking-wide text-hare">
        {label}
      </Text>
    </View>
  );
}

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
  type RecorderHandle,
} from "@/lib/recorder";
import { scoreAudio, type CloudScore } from "@/lib/cloudScoring";
import { useStore } from "@/lib/store";
import { Button, ProgressBar } from "@/components/ui";
import TalkingFace, { type Mood } from "@/components/TalkingFace";

type Phase = "prompt" | "listening" | "scoring" | "result" | "done";

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
  const recorderRef = useRef<RecorderHandle | null>(null);

  const lesson = info?.lesson;
  const word = lesson?.words[wordIdx];
  // Cloud scoring is used whenever the recorder is available (dev build with
  // expo-av installed). Isolation lessons now use simple CV syllables like
  // "sah" / "rah" which Speechace can score, so every level is gradeable.
  // Falls back to parent self-rating only when recording isn't supported.
  const useCloud = isRecordingSupported();
  const useSelfRate = !useCloud;

  // Auto-play the word when arriving at a new prompt.
  useEffect(() => {
    if (phase === "prompt" && word) {
      speak(word.text, {
        onStart: () => setSpeaking(true),
        onEnd: () => setSpeaking(false),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, wordIdx]);

  useEffect(
    () => () => {
      recorderRef.current?.stop().catch(() => {});
    },
    [],
  );

  if (!info || !lesson || !word || !activeChild) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-lg text-gray-600">Lesson not found.</Text>
        <Button label="Back" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const { skill } = info;
  const total = lesson.words.length;
  const pct = Math.round((wordIdx / total) * 100);

  // The mascot reacts to the result: celebrate on great, gently encourage on
  // ok, kindly commiserate on try-again. Neutral otherwise.
  const mascotMood: Mood =
    phase === "result" && result
      ? result.rating === "great"
        ? "celebrate"
        : result.rating === "ok"
          ? "encourage"
          : "sad"
      : "neutral";

  function playWord() {
    if (word)
      speak(word.text, {
        onStart: () => setSpeaking(true),
        onEnd: () => setSpeaking(false),
      });
  }

  async function listen() {
    setResult(null);
    setErrorMsg(null);
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
  }

  async function stopAndScore() {
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
      });
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
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
        <TalkingFace speaking={false} mood="celebrate" size={170} />
        <Text className="mt-5 text-3xl font-extrabold text-feather-edge">
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
          <Stat label="Accuracy" value={`${Math.round(avg * 100)}%`} />
          <Stat label="XP" value={`+${xp}`} />
        </View>
        <View className="mt-8 w-full max-w-sm">
          <Button
            label="Back to map"
            onPress={() => router.replace("/home")}
          />
        </View>
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
          <Text className="text-lg font-bold text-hare">✕</Text>
        </Pressable>
        <ProgressBar value={pct / 100} />
      </View>

      <ScrollView className="flex-1 px-6" contentContainerStyle={{ flexGrow: 1 }}>
        {/* Level tag (Duolingo "NEW WORD" style) */}
        <View className="mt-1 flex-row items-center gap-1.5">
          <View className={`h-2.5 w-2.5 rounded-full ${skill.color}`} />
          <Text className="text-xs font-extrabold uppercase tracking-widest text-hare">
            {LEVEL_INFO[lesson.level].label}
          </Text>
        </View>
        <Text className="mt-2 text-2xl font-extrabold text-ink">
          Repeat after Leo
        </Text>

        {/* Speech bubble — tap the speaker to hear it; segmented underline
            dots under each word, like Duolingo's speaking prompts. */}
        <View className="mt-7">
          <SpeechBubble text={word.text} emoji={word.emoji} onPlay={playWord} />
        </View>

        {/* The lion "says" it (mouth animates) and reacts to the result. */}
        <View className="mt-1 items-center">
          <TalkingFace speaking={speaking} size={200} mood={mascotMood} />
        </View>

        {/* Coaching cue — the articulation tip for this sound. */}
        {phase !== "result" ? (
          <View className="mt-1 flex-row items-center gap-2 self-center rounded-2xl bg-brand-50 px-4 py-2">
            <Text className="text-base">💡</Text>
            <Text className="text-sm font-bold text-brand-700">{lesson.hint}</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Action area */}
      <View className="px-4 pb-4">
        {errorMsg ? (
          <View className="mb-3 rounded-2xl border-2 border-red-300 bg-red-50 px-4 py-3">
            <Text className="text-center text-sm font-extrabold text-red-600">
              {errorMsg}
            </Text>
          </View>
        ) : null}
        {phase === "result" && result && lastCloud ? (
          <Text className="mb-2 text-center text-[11px] font-bold text-gray-400">
            {`debug · score ${lastCloud.score ?? "?"} · overall ${
              lastCloud.overall ?? "?"
            } · ${lesson.targetSound} ${lastCloud.targetPhoneme ?? "?"}${
              lastCloud.phones?.length
                ? ` · ${lastCloud.phones
                    .map((p) => `${p.phone}:${p.score ?? "?"}`)
                    .join(" ")}`
                : ""
            }${lastCloud.transcript ? ` · heard "${lastCloud.transcript}"` : ""}`}
          </Text>
        ) : null}
        {phase === "result" && result ? (
          <ResultBar result={result} onNext={nextWord} onRetry={() => {
            setResult(null);
            setScores((p) => p.slice(0, -1));
            setPhase("prompt");
          }} />
        ) : useSelfRate ? (
          <View>
            <Text className="mb-2 text-center text-sm font-bold text-gray-500">
              {lesson.level === "isolation"
                ? "How did your child sound?"
                : "How did it sound?"}
            </Text>
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Button label="Again" variant="warn" onPress={() => selfRate("tryAgain")} />
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
              disabled={phase === "scoring"}
              onPress={() =>
                phase === "listening" ? stopAndScore() : listen()
              }
            >
              {({ pressed }) => {
                const face =
                  phase === "listening"
                    ? "#ff4b4b"
                    : phase === "scoring"
                      ? "#e5e5e5"
                      : "#1cb0f6";
                const edge =
                  phase === "listening"
                    ? "#e63232"
                    : phase === "scoring"
                      ? "#cfcfcf"
                      : "#1899d6";
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
                        <Text className="text-base font-extrabold uppercase tracking-wide text-white">
                          Checking…
                        </Text>
                      ) : (
                        <Waveform />
                      )}
                    </View>
                  </View>
                );
              }}
            </Pressable>
            <Text className="mt-3 text-center text-sm font-extrabold uppercase tracking-wide text-hare">
              {phase === "listening"
                ? "Tap to stop"
                : phase === "scoring"
                  ? "Listening to you…"
                  : "Tap to speak"}
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

// Waveform bars shown inside the speak button (Duolingo speaking style).
const WAVE_BARS = [12, 22, 32, 18, 34, 16, 28, 14, 24, 30, 16];
function Waveform() {
  return (
    <View className="flex-row items-center" style={{ height: 34, gap: 6 }}>
      {WAVE_BARS.map((h, i) => (
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
              <Text className="text-3xl font-extrabold text-ink">{tok}</Text>
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

function ResultBar({
  result,
  onNext,
  onRetry,
}: {
  result: ScoreResult;
  onNext: () => void;
  onRetry: () => void;
}) {
  const great = result.rating === "great";
  const ok = result.rating === "ok";
  const title = great ? "Perfect! 🎉" : ok ? "Almost there!" : "Good try!";
  const tint = great ? "#f0fde4" : ok ? "#e8f7ff" : "#fff0f0";
  const titleColor = great ? "#58a700" : ok ? "#1899d6" : "#e63232";
  const starCount = great ? 3 : ok ? 2 : 1;
  return (
    <View className="rounded-3xl p-4" style={{ backgroundColor: tint }}>
      <View className="flex-row items-center justify-between">
        <Text className="text-2xl font-extrabold" style={{ color: titleColor }}>
          {title}
        </Text>
        <Text className="text-lg">
          {"⭐".repeat(starCount)}
          <Text style={{ opacity: 0.2 }}>{"⭐".repeat(3 - starCount)}</Text>
        </Text>
      </View>
      {result.hint ? (
        <Text className="mt-1 text-sm font-bold text-ink">{result.hint}</Text>
      ) : null}
      {result.bestHeard ? (
        <Text className="mt-1 text-xs text-wolf">
          I heard: “{result.bestHeard}”
        </Text>
      ) : null}
      <View className="mt-3 flex-row gap-2">
        {!great && (
          <View className="flex-1">
            <Button label="Try again" variant="ghost" icon="🔁" onPress={onRetry} />
          </View>
        )}
        <View className="flex-1">
          <Button
            label={great ? "Continue" : "Next"}
            variant={great ? "primary" : "secondary"}
            onPress={onNext}
          />
        </View>
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 rounded-2xl border-2 border-swan bg-polar px-3 py-3">
      <Text className="text-center text-xl font-extrabold text-ink">{value}</Text>
      <Text className="text-center text-[11px] font-bold uppercase tracking-wide text-hare">
        {label}
      </Text>
    </View>
  );
}

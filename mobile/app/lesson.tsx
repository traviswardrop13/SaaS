import { useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { findLesson, LEVEL_INFO } from "@/lib/lessons";
import { scoreUtterance, type ScoreResult } from "@/lib/scoring";
import {
  speak,
  startRecognition,
  isRecognitionSupported,
  type RecognitionAlternative,
  type RecognitionHandle,
} from "@/lib/speech";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui";
import TalkingFace from "@/components/TalkingFace";

type Phase = "prompt" | "listening" | "result" | "done";

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
  const recRef = useRef<RecognitionHandle | null>(null);
  const altsRef = useRef<RecognitionAlternative[]>([]);

  const lesson = info?.lesson;
  const word = lesson?.words[wordIdx];
  const useSelfRate =
    !isRecognitionSupported() || lesson?.level === "isolation";

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

  useEffect(() => () => recRef.current?.stop(), []);

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

  function playWord() {
    if (word)
      speak(word.text, {
        onStart: () => setSpeaking(true),
        onEnd: () => setSpeaking(false),
      });
  }

  function listen() {
    setResult(null);
    altsRef.current = [];
    setPhase("listening");
    recRef.current = startRecognition({
      onResult: (alts, isFinal) => {
        altsRef.current = alts;
        if (isFinal) finish(alts);
      },
      onError: () => setPhase("prompt"),
      onEnd: () => {
        setPhase((p) => {
          if (p !== "listening") return p;
          finish(altsRef.current);
          return "result";
        });
      },
    });
  }

  function finish(alts: RecognitionAlternative[]) {
    const s = scoreUtterance(alts, {
      target: word!.text,
      accepts: word!.accepts,
      targetSound: lesson!.targetSound,
      position: lesson!.position,
      blend: lesson!.blend,
    });
    setResult(s);
    setScores((p) => [...p, s.similarity]);
    setPhase("result");
    recRef.current?.stop();
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
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-7xl">🎉</Text>
        <Text className="mt-4 text-4xl font-extrabold text-brand-600">
          Lesson complete!
        </Text>
        <Text className="mt-2 text-center text-gray-600">
          Amazing work, {activeChild.name}!
        </Text>
        <View className="mt-6 flex-row gap-3">
          <Stat label="Stars" value={`${stars}⭐`} />
          <Stat label="Accuracy" value={`${Math.round(avg * 100)}%`} />
          <Stat label="XP" value={`+${10 + stars * 5}`} />
        </View>
        <View className="mt-8 w-full max-w-sm">
          <Button label="Back to map" onPress={() => router.replace("/home")} />
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
          className="h-9 w-9 items-center justify-center rounded-full bg-gray-100"
        >
          <Text className="text-gray-500">✕</Text>
        </Pressable>
        <View className="h-3 flex-1 overflow-hidden rounded-full bg-gray-100">
          <View className="h-full rounded-full bg-grass-500" style={{ width: `${pct}%` }} />
        </View>
      </View>

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ flexGrow: 1 }}>
        <Text className="text-center text-xs font-extrabold uppercase tracking-widest text-gray-400">
          Level {LEVEL_INFO[lesson.level].short} · {LEVEL_INFO[lesson.level].label}
        </Text>
        <Text className="mt-1 text-center text-2xl font-extrabold text-gray-800">
          {lesson.level === "isolation" ? "Make the sound" : "Say it out loud"}
        </Text>

        {/* Word bubble */}
        <Pressable
          onPress={playWord}
          className="mt-6 flex-row items-center gap-3 rounded-3xl border-2 border-gray-100 bg-white px-5 py-4"
        >
          <View className={`h-9 w-9 items-center justify-center rounded-full ${skill.color}`}>
            <Text className="text-white">🔊</Text>
          </View>
          <Text className="flex-1 text-2xl font-extrabold text-gray-800">
            {word.text}
          </Text>
          {word.emoji ? <Text className="text-4xl">{word.emoji}</Text> : null}
        </Pressable>

        {/* Visual — the mascot models the sound; its mouth moves while the
            word plays. (The tongue-position diagram is being redesigned and
            will return as a polished "show me how" later.) */}
        <View className="mt-4 items-center">
          <TalkingFace speaking={speaking} size={210} />
        </View>
      </ScrollView>

      {/* Action area */}
      <View className="px-4 pb-4">
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
          <Pressable
            onPress={() => (phase === "listening" ? recRef.current?.stop() : listen())}
            className={`mx-auto h-24 w-24 items-center justify-center rounded-full ${
              phase === "listening" ? "bg-brand-500" : "bg-grass-500"
            }`}
          >
            <Text className="text-4xl">{phase === "listening" ? "⏹" : "🎤"}</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
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
  const title = great ? "Good job!" : result.rating === "ok" ? "Nice try!" : "Let's try again";
  return (
    <View>
      <Text
        className={`text-2xl font-extrabold ${
          great ? "text-grass-600" : result.rating === "ok" ? "text-sky-600" : "text-brand-600"
        }`}
      >
        {great ? "✓ " : ""}
        {title}
      </Text>
      {result.hint ? (
        <Text className="mt-1 text-sm font-bold text-gray-700">{result.hint}</Text>
      ) : null}
      {result.bestHeard ? (
        <Text className="mt-1 text-sm text-gray-500">I heard: “{result.bestHeard}”</Text>
      ) : null}
      <View className="mt-3 flex-row gap-2">
        {!great && (
          <View className="flex-1">
            <Button label="Try again" variant="ghost" onPress={onRetry} />
          </View>
        )}
        <View className="flex-1">
          <Button label="Continue" variant={great ? "primary" : "secondary"} onPress={onNext} />
        </View>
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="rounded-2xl bg-brand-50 px-4 py-3">
      <Text className="text-center text-xl font-extrabold text-brand-600">{value}</Text>
      <Text className="text-center text-xs uppercase tracking-wide text-gray-500">{label}</Text>
    </View>
  );
}

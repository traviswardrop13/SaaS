import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { findLanguageLesson, type Exercise, type LangOption } from "@/lib/language";
import { speak } from "@/lib/speech";
import { configurePlaybackAudio } from "@/lib/recorder";
import { hapticSuccess, hapticWarning, hapticSelect } from "@/lib/haptics";
import { useStore } from "@/lib/store";
import { Button, ProgressBar } from "@/components/ui";
import TalkingFace from "@/components/TalkingFace";
import Confetti from "@/components/Confetti";

type Phase = "answer" | "feedback" | "done";

// Coins reward for finishing a lesson — base plus per-star bonus, matching the
// speech track so both products feed the same Leo's World reward loop.
const COINS_BASE = 10;
const COINS_PER_STAR = 10;

export default function LanguageLesson() {
  const router = useRouter();
  const { skillId, lessonId } = useLocalSearchParams<{
    skillId: string;
    lessonId: string;
  }>();
  const { activeChild, recordLessonComplete } = useStore();
  const info = findLanguageLesson(skillId ?? "", lessonId ?? "");

  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("answer");
  const [correct, setCorrect] = useState<boolean | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const [speaking, setSpeaking] = useState(false);
  // build-exercise state: ids of placed tiles, in order
  const [placed, setPlaced] = useState<number[]>([]);
  // Bumped to fire the celebratory coin/confetti burst on the done screen.
  const [fireKey, setFireKey] = useState(0);

  const lesson = info?.lesson;
  const ex = lesson?.exercises[idx];

  useEffect(() => {
    configurePlaybackAudio();
  }, []);

  // Auto-play the prompt audio when a new exercise appears.
  useEffect(() => {
    setPlaced([]);
    setCorrect(null);
    setPhase("answer");
    const say =
      ex && ("say" in ex ? ex.say : undefined) !== undefined
        ? (ex as any).say
        : undefined;
    if (say) {
      speak(say, {
        onStart: () => setSpeaking(true),
        onEnd: () => setSpeaking(false),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  // Shuffled tiles for the current build exercise (stable per exercise).
  const bankTiles = useMemo(() => {
    if (ex?.kind !== "build") return [];
    return shuffle(ex.bank.map((word, id) => ({ id, word })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  if (!info || !lesson || !ex || !activeChild) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-lg text-wolf">Lesson not found.</Text>
        <View className="mt-4 w-full max-w-xs">
          <Button label="Back" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const total = lesson.exercises.length;
  const pct = idx / total;

  function replay() {
    const say = (ex as any)?.say as string | undefined;
    if (say)
      speak(say, {
        onStart: () => setSpeaking(true),
        onEnd: () => setSpeaking(false),
      });
  }

  function answer(isCorrect: boolean) {
    if (isCorrect) hapticSuccess();
    else hapticWarning();
    setCorrect(isCorrect);
    setResults((r) => [...r, isCorrect]);
    setPhase("feedback");
  }

  // Audio-first: tapping a picture/word also speaks it, so a pre-reader hears
  // the word as they choose. (Then `answer` evaluates.)
  function chooseOption(o: LangOption) {
    hapticSelect();
    if (o.label) speak(o.label);
    answer(!!o.correct);
  }

  function next() {
    if (idx + 1 >= total) {
      const score = results.filter(Boolean).length / Math.max(1, results.length);
      const stars = score >= 0.85 ? 3 : score >= 0.6 ? 2 : 1;
      recordLessonComplete(activeChild!.id, lesson!.id, {
        stars,
        score: Math.round(score * 100),
        xpEarned: 10 + stars * 5,
        coinsEarned: COINS_BASE + stars * COINS_PER_STAR,
      });
      hapticSuccess();
      setFireKey((k) => k + 1);
      setPhase("done");
    } else {
      setIdx((i) => i + 1);
    }
  }

  // ---------- completion ----------
  if (phase === "done") {
    const score = results.filter(Boolean).length / Math.max(1, results.length);
    const stars = score >= 0.85 ? 3 : score >= 0.6 ? 2 : 1;
    const coins = COINS_BASE + stars * COINS_PER_STAR;
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
        <TalkingFace speaking={false} mood="celebrate" size={170} />
        <Text className="mt-5 text-3xl font-extrabold text-feather-edge">
          Lesson complete!
        </Text>
        <Text className="mt-1 text-center text-base text-wolf">
          Great thinking, {activeChild.name}! 🎉
        </Text>
        <View className="mt-5 flex-row gap-2">
          {[0, 1, 2].map((i) => (
            <Text key={i} className="text-5xl" style={{ opacity: i < stars ? 1 : 0.18 }}>
              ⭐
            </Text>
          ))}
        </View>
        <Pressable
          onPress={() => router.replace("/world")}
          className="mt-6 flex-row items-center gap-2 rounded-2xl border-2 border-bee-edge bg-bee-50 px-4 py-2.5"
        >
          <Text className="text-xl">🪙</Text>
          <Text className="text-sm font-extrabold text-ink">
            +{coins} coins — build Leo's World
          </Text>
        </Pressable>
        <View className="mt-6 w-full max-w-sm">
          <Button label="Back to map" onPress={() => router.replace("/language")} />
        </View>
        <Confetti fireKey={fireKey} />
      </SafeAreaView>
    );
  }

  const placedWords = placed.map((id) => bankTiles.find((t) => t.id === id)?.word ?? "");
  const canCheck = ex.kind === "build" && placed.length > 0;

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
        <ProgressBar value={pct} />
      </View>

      <ScrollView className="flex-1 px-6" contentContainerStyle={{ flexGrow: 1 }}>
        {/* Prompt */}
        <View className="mt-2 flex-row items-center gap-3">
          <Pressable
            onPress={replay}
            className="h-11 w-11 items-center justify-center rounded-2xl"
            style={{ backgroundColor: speaking ? "#1899d6" : "#1cb0f6" }}
          >
            <Text className="text-lg text-white">🔊</Text>
          </Pressable>
          <Text className="flex-1 text-2xl font-extrabold text-ink">{ex.prompt}</Text>
        </View>

        {/* Picture cue for build exercises */}
        {ex.kind === "build" && ex.emoji ? (
          <Text className="mt-4 text-center text-6xl">{ex.emoji}</Text>
        ) : null}

        {/* pickImage: 2x2 grid of picture options */}
        {ex.kind === "pickImage" ? (
          <View className="mt-6 flex-row flex-wrap justify-between">
            {ex.options.map((o, i) => (
              <ImageChoice
                key={i}
                option={o}
                disabled={phase !== "answer"}
                onPress={() => chooseOption(o)}
              />
            ))}
          </View>
        ) : null}

        {/* choice: stacked text answers */}
        {ex.kind === "choice" ? (
          <View className="mt-6 gap-3">
            {ex.options.map((o, i) => (
              <Pressable
                key={i}
                disabled={phase !== "answer"}
                onPress={() => chooseOption(o)}
                className="flex-row items-center gap-3 rounded-2xl border-2 border-swan bg-white px-5 py-4"
              >
                {o.emoji ? <Text className="text-3xl">{o.emoji}</Text> : null}
                <Text className="text-xl font-extrabold text-ink">{o.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* build: sentence area + word bank */}
        {ex.kind === "build" ? (
          <View className="mt-6">
            <View className="min-h-[64px] flex-row flex-wrap gap-2 rounded-2xl border-2 border-dashed border-swan p-3">
              {placed.map((id) => (
                <Tile
                  key={id}
                  word={bankTiles.find((t) => t.id === id)?.word ?? ""}
                  onPress={
                    phase === "answer"
                      ? () => setPlaced((p) => p.filter((x) => x !== id))
                      : undefined
                  }
                />
              ))}
            </View>
            <View className="mt-5 flex-row flex-wrap gap-2">
              {bankTiles
                .filter((t) => !placed.includes(t.id))
                .map((t) => (
                  <Tile
                    key={t.id}
                    word={t.word}
                    variant="bank"
                    onPress={
                      phase === "answer"
                        ? () => setPlaced((p) => [...p, t.id])
                        : undefined
                    }
                  />
                ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Action / feedback area */}
      {phase === "feedback" ? (
        <FeedbackBanner
          correct={!!correct}
          answerText={ex.kind === "build" ? ex.answer.join(" ") : correctLabel(ex)}
          onNext={next}
        />
      ) : (
        <View className="px-6 pb-6">
          {ex.kind === "build" ? (
            <Button
              label="Check"
              variant="primary"
              disabled={!canCheck}
              onPress={() =>
                answer(
                  placedWords.length === ex.answer.length &&
                    placedWords.every((w, i) => w === ex.answer[i]),
                )
              }
            />
          ) : (
            <Text className="text-center text-sm font-bold text-hare">
              {ex.kind === "pickImage" ? "Tap the picture" : "Tap your answer"}
            </Text>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

function correctLabel(ex: Exercise): string {
  if (ex.kind === "pickImage" || ex.kind === "choice") {
    const o = ex.options.find((x) => x.correct);
    return o?.label ?? "";
  }
  return "";
}

function ImageChoice({
  option,
  disabled,
  onPress,
}: {
  option: LangOption;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: "48%",
        marginBottom: 12,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
      className="aspect-square items-center justify-center rounded-3xl border-2 border-swan bg-white"
    >
      <Text style={{ fontSize: 64 }}>{option.emoji}</Text>
    </Pressable>
  );
}

function Tile({
  word,
  variant = "placed",
  onPress,
}: {
  word: string;
  variant?: "placed" | "bank";
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className={`rounded-xl border-2 px-4 py-2 ${
        variant === "bank" ? "border-swan bg-white" : "border-macaw bg-macaw-50"
      }`}
    >
      <Text className="text-lg font-extrabold text-ink">{word}</Text>
    </Pressable>
  );
}

function FeedbackBanner({
  correct,
  answerText,
  onNext,
}: {
  correct: boolean;
  answerText: string;
  onNext: () => void;
}) {
  const cfg = correct
    ? { tint: "#d7ffb8", color: "#58a700", icon: "✓", title: "Nice!" }
    : { tint: "#ffdfe0", color: "#e63232", icon: "✕", title: "Not quite" };
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
          <Text className="text-2xl font-extrabold text-white">{cfg.icon}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-2xl font-extrabold" style={{ color: cfg.color }}>
            {cfg.title}
          </Text>
          {!correct && answerText ? (
            <Text className="mt-0.5 text-sm font-bold text-ink">
              Answer: {answerText}
            </Text>
          ) : null}
        </View>
      </View>
      <View className="mt-4">
        <Button
          label="Continue"
          variant={correct ? "primary" : "secondary"}
          onPress={onNext}
        />
      </View>
    </View>
  );
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

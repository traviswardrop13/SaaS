import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { findPairSet, type PairWord } from "@/lib/minimalPairs";
import { speak } from "@/lib/speech";
import { configurePlaybackAudio } from "@/lib/recorder";
import {
  hapticSuccess,
  hapticWarning,
  hapticLight,
  hapticStarReveal,
  hapticCoinAward,
  hapticCelebrate,
} from "@/lib/haptics";
import { leoLessonCheer } from "@/lib/leo";
import { useStore } from "@/lib/store";
import { Button, ProgressBar, Loading } from "@/components/ui";
import LeoImage from "@/components/LeoImage";
import Confetti from "@/components/Confetti";

type Phase = "answer" | "feedback" | "done";
type Round = { spoken: PairWord; options: PairWord[] };

const COINS_BASE = 10;
const COINS_PER_STAR = 10;
const MAX_ROUNDS = 6;

export default function MinimalPair() {
  const router = useRouter();
  const { setId } = useLocalSearchParams<{ setId: string }>();
  const { ready, activeChild, recordLessonComplete } = useStore();
  const set = findPairSet(setId ?? "");

  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("answer");
  const [chosen, setChosen] = useState<string | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const [fireKey, setFireKey] = useState(0);

  // Build the round list once: each pair contributes a "find the target" and a
  // "find the contrast" round, shuffled, capped — trains the ear both ways.
  const rounds = useMemo<Round[]>(() => {
    if (!set) return [];
    const rs: Round[] = [];
    for (const p of set.pairs) {
      rs.push({ spoken: p.target, options: shuffle([p.target, p.foil]) });
      rs.push({ spoken: p.foil, options: shuffle([p.target, p.foil]) });
    }
    return shuffle(rs).slice(0, MAX_ROUNDS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId]);

  const round = rounds[idx];
  const total = rounds.length;

  useEffect(() => {
    configurePlaybackAudio();
  }, []);

  // Leo says the word to find whenever a new round appears.
  useEffect(() => {
    if (phase === "answer" && round) {
      const t = setTimeout(() => speak(round.spoken.word), 350);
      return () => clearTimeout(t);
    }
  }, [idx, phase, round]);

  // Celebration on the done screen.
  useEffect(() => {
    if (phase !== "done") return;
    const correct = results.filter(Boolean).length;
    const score = correct / Math.max(1, total);
    const stars = score >= 0.85 ? 3 : score >= 0.6 ? 2 : 1;
    hapticCelebrate();
    const a = setTimeout(() => hapticStarReveal(stars), 380);
    const b = setTimeout(() => hapticCoinAward(), 380 + stars * 220 + 120);
    const c = setTimeout(
      () => leoLessonCheer(activeChild?.name),
      380 + stars * 220 + 300,
    );
    return () => {
      clearTimeout(a);
      clearTimeout(b);
      clearTimeout(c);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (!ready) return <Loading />;
  if (!set || !round || !activeChild) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-lg text-wolf">Game not found.</Text>
        <View className="mt-4 w-full max-w-xs">
          <Button label="Back to map" onPress={() => router.replace("/home")} />
        </View>
      </SafeAreaView>
    );
  }

  function choose(opt: PairWord) {
    if (phase !== "answer" || !round) return;
    hapticLight();
    speak(opt.word);
    const correct = opt.word === round.spoken.word;
    if (correct) hapticSuccess();
    else hapticWarning();
    setChosen(opt.word);
    setResults((r) => [...r, correct]);
    setPhase("feedback");
  }

  function next() {
    if (idx + 1 >= total) {
      const correct = results.filter(Boolean).length;
      const score = correct / Math.max(1, total);
      const stars = score >= 0.85 ? 3 : score >= 0.6 ? 2 : 1;
      recordLessonComplete(activeChild!.id, set!.id, {
        stars,
        score: Math.round(score * 100),
        xpEarned: 10 + stars * 5,
        coinsEarned: COINS_BASE + stars * COINS_PER_STAR,
      });
      setFireKey((k) => k + 1);
      setPhase("done");
    } else {
      setIdx((i) => i + 1);
      setChosen(null);
      setPhase("answer");
    }
  }

  function replay() {
    hapticLight();
    if (round) speak(round.spoken.word);
  }

  // ───────────── done ─────────────
  if (phase === "done") {
    const correct = results.filter(Boolean).length;
    const score = correct / Math.max(1, total);
    const stars = score >= 0.85 ? 3 : score >= 0.6 ? 2 : 1;
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
        <LeoImage
          speaking={false}
          mood={stars >= 3 ? "holding-star" : "celebrate"}
          size={190}
        />
        <Text className="mt-5 text-3xl font-extrabold font-display text-feather-edge">
          Great listening!
        </Text>
        <Text className="mt-1 text-center text-base text-wolf">
          {correct}/{total} right, {activeChild.name}! 🎉
        </Text>
        <View className="mt-5 flex-row gap-2">
          {[0, 1, 2].map((i) => (
            <Text key={i} className="text-5xl" style={{ opacity: i < stars ? 1 : 0.18 }}>
              ⭐
            </Text>
          ))}
        </View>
        <View className="mt-7 w-full max-w-sm">
          <Button label="Back to map" onPress={() => router.replace("/home")} />
        </View>
        <Confetti fireKey={fireKey} />
      </SafeAreaView>
    );
  }

  // ───────────── play ─────────────
  const correct = phase === "feedback" && chosen === round.spoken.word;
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable
          onPress={() => router.replace("/home")}
          className="h-9 w-9 items-center justify-center rounded-full bg-polar"
        >
          <Text className="text-lg font-bold font-heading text-hare">✕</Text>
        </Pressable>
        <ProgressBar value={idx / total} />
      </View>

      <View className="flex-1 px-6">
        <Text className="mt-1 text-xs font-extrabold font-display uppercase tracking-widest text-hare">
          {set.process}
        </Text>
        <Text className="mt-2 text-2xl font-extrabold font-display text-ink">
          Which one did Leo say?
        </Text>

        {/* Big speaker — tap to hear the word again */}
        <Pressable
          onPress={replay}
          className="mt-6 flex-row items-center gap-3 self-center rounded-4xl bg-macaw px-6 py-4"
        >
          <Text className="text-2xl text-white">🔊</Text>
          <Text className="text-lg font-extrabold font-display text-white">
            Say it again
          </Text>
        </Pressable>

        {/* The two picture choices */}
        <View className="mt-8 flex-row justify-between">
          {round.options.map((opt) => {
            const isChosen = chosen === opt.word;
            const isAnswer = opt.word === round.spoken.word;
            const showRight = phase === "feedback" && isAnswer;
            const showWrong = phase === "feedback" && isChosen && !isAnswer;
            return (
              <Pressable
                key={opt.word}
                disabled={phase !== "answer"}
                onPress={() => choose(opt)}
                style={({ pressed }) => ({
                  width: "47%",
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                })}
                className={`aspect-square items-center justify-center rounded-5xl border-4 ${
                  showRight
                    ? "border-feather bg-feather-50"
                    : showWrong
                      ? "border-cardinal bg-cardinal-50"
                      : "border-swan bg-white"
                }`}
              >
                <Text style={{ fontSize: 84 }}>{opt.emoji}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {phase === "feedback" ? (
        <View
          className="px-6 pb-6 pt-5"
          style={{
            backgroundColor: correct ? "#d7ffb8" : "#ffdfe0",
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
          }}
        >
          <View className="flex-row items-center gap-3">
            <View
              className="h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: correct ? "#58a700" : "#e63232" }}
            >
              <Text className="text-2xl font-extrabold text-white">
                {correct ? "✓" : "✕"}
              </Text>
            </View>
            <View className="flex-1">
              <Text
                className="text-2xl font-extrabold font-display"
                style={{ color: correct ? "#58a700" : "#e63232" }}
              >
                {correct ? "You heard it!" : `Leo said "${round.spoken.word}"`}
              </Text>
            </View>
          </View>
          <View className="mt-4">
            <Button
              label="Continue"
              variant={correct ? "primary" : "secondary"}
              onPress={next}
            />
          </View>
        </View>
      ) : (
        <View className="px-6 pb-6">
          <Text className="text-center text-sm font-bold font-heading text-hare">
            Listen, then tap the picture
          </Text>
        </View>
      )}
    </SafeAreaView>
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

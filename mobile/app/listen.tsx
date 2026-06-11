import { useEffect, useMemo, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { findSkill, type Word } from "@/lib/lessons";
import { speak } from "@/lib/speech";
import { configurePlaybackAudio } from "@/lib/recorder";
import { useStore } from "@/lib/store";
import { Button, ProgressBar, Loading, Coin } from "@/components/ui";
import LeoImage from "@/components/LeoImage";
import { hapticLight, hapticSuccess } from "@/lib/haptics";

/**
 * "Leo's Sound Show" — auditory bombardment. The child just listens to a
 * stream of words loaded with the target sound (no production), tuning the
 * ear before they practice. A real, evidence-based phonology warm-up.
 */
const PER_WORD_MS = 1900;
const COINS = 5;

export default function Listen() {
  const router = useRouter();
  const { skillId } = useLocalSearchParams<{ skillId: string }>();
  const { ready, activeChild, recordLessonComplete } = useStore();
  const skill = findSkill(skillId ?? "");

  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const awarded = useRef(false);

  // Gather picturable words across the skill (one per unique word), capped.
  const words = useMemo<Word[]>(() => {
    if (!skill) return [];
    const seen = new Set<string>();
    const out: Word[] = [];
    for (const l of skill.lessons) {
      for (const w of l.words) {
        if (w.emoji && !seen.has(w.text)) {
          seen.add(w.text);
          out.push(w);
        }
      }
    }
    return out.slice(0, 8);
  }, [skillId]);

  const word = words[idx];

  useEffect(() => {
    configurePlaybackAudio();
  }, []);

  // Play the current word, then auto-advance.
  useEffect(() => {
    if (done || paused || !word) return;
    speak(word.text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (idx + 1 >= words.length) finish();
      else setIdx((i) => i + 1);
    }, PER_WORD_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, paused, done, word]);

  function finish() {
    if (awarded.current) return;
    awarded.current = true;
    hapticSuccess();
    if (activeChild && skill) {
      recordLessonComplete(activeChild.id, `listen-${skill.id}`, {
        stars: 1,
        score: 100,
        xpEarned: 3,
        coinsEarned: COINS,
      });
    }
    setDone(true);
  }

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  if (!ready) return <Loading />;
  if (!skill || words.length === 0 || !activeChild) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-lg text-wolf">Nothing to listen to here.</Text>
        <View className="mt-4 w-full max-w-xs">
          <Button label="Back" onPress={() => router.replace("/home")} />
        </View>
      </SafeAreaView>
    );
  }

  if (done) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
        <LeoImage speaking={false} mood="celebrate" size={170} />
        <Text className="mt-5 text-3xl font-extrabold font-display text-feather-edge">
          Ears ready!
        </Text>
        <Text className="mt-1 text-center text-base text-wolf">
          You heard lots of {skill.title}. Now it's your turn!
        </Text>
        <View className="mt-6 flex-row items-center gap-2 rounded-2xl border-2 border-bee-edge bg-bee-50 px-4 py-2.5">
          <Coin size={20} />
          <Text className="text-sm font-extrabold font-display text-ink">
            +{COINS} coins
          </Text>
        </View>
        <View className="mt-7 w-full max-w-sm gap-3">
          <Button
            label="Practice now"
            onPress={() =>
              router.replace({
                pathname: "/lesson",
                params: { skillId: skill.id, lessonId: skill.lessons[0].id },
              })
            }
          />
          <Button
            label="Back to map"
            variant="secondary"
            onPress={() => router.replace("/home")}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable
          onPress={() => router.replace("/home")}
          className="h-9 w-9 items-center justify-center rounded-full bg-polar"
        >
          <Text className="text-lg font-bold font-heading text-hare">✕</Text>
        </Pressable>
        <ProgressBar value={idx / words.length} />
      </View>

      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-xs font-extrabold font-display uppercase tracking-widest text-hare">
          {skill.title} · just listen 👂
        </Text>
        <View
          className="mt-5 items-center justify-center rounded-5xl bg-polar"
          style={{ width: 240, height: 240 }}
        >
          <Text style={{ fontSize: 130 }}>{word.emoji}</Text>
        </View>
        <Text className="mt-5 text-4xl font-extrabold font-display text-ink">
          {word.text}
        </Text>
        <View className="mt-6 flex-row items-center gap-2">
          <LeoImage speaking={!paused} mood="idle" size={56} />
          <Pressable
            onPress={() => {
              hapticLight();
              setPaused((p) => !p);
            }}
            className="rounded-full border-2 border-swan px-4 py-2"
          >
            <Text className="text-sm font-extrabold font-display text-wolf">
              {paused ? "▶ Play" : "⏸ Pause"}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

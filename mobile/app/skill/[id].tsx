import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { findSkill, LEVEL_INFO } from "@/lib/lessons";
import { isLessonUnlocked, useStore } from "@/lib/store";
import { Button, Loading } from "@/components/ui";
import { hapticLight } from "@/lib/haptics";

/**
 * Inside-a-building view — the Duolingo-style winding lesson trail. Reached
 * by tapping a building on the home town. This is the *only* place the trail
 * shows; home stays a clean town overview.
 */
const OFFSETS = [0, 60, 88, 60, 0, -60, -88, -60];
type NodeState = "locked" | "current" | "done" | "available";

export default function SkillScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ready, activeChild } = useStore();
  const skill = findSkill(id ?? "");

  if (!ready) return <Loading />;
  if (!skill || !activeChild) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-base text-wolf">Couldn&apos;t find that.</Text>
        <View className="mt-4 w-full max-w-xs">
          <Button label="Back" onPress={() => router.replace("/home")} />
        </View>
      </SafeAreaView>
    );
  }

  // Current = first unlocked-but-not-mastered. Available = next playable.
  let currentLessonId: string | null = null;
  for (const lesson of skill.lessons) {
    const unlocked = isLessonUnlocked(activeChild, lesson.id);
    const stars = activeChild.progress[lesson.id]?.stars ?? 0;
    if (unlocked && stars < 2) {
      currentLessonId = lesson.id;
      break;
    }
  }

  const land = skillLandTint(skill.color);
  const doneCount = skill.lessons.filter(
    (l) => (activeChild.progress[l.id]?.stars ?? 0) >= 2,
  ).length;

  return (
    <View className="flex-1" style={{ backgroundColor: land.sky }}>
      <SafeAreaView className="flex-1" edges={["top"]}>
        {/* Header: back · skill title · library */}
        <View className="flex-row items-center justify-between px-4 pb-2 pt-1">
          <Pressable
            onPress={() => {
              hapticLight();
              router.back();
            }}
            className="h-10 w-10 items-center justify-center rounded-full bg-white"
          >
            <Text className="text-lg font-extrabold font-display text-macaw">←</Text>
          </Pressable>
          <View className="items-center">
            <Text className="text-base font-extrabold font-display text-ink">
              {skill.title}
            </Text>
            <Text className="text-[11px] font-extrabold font-display uppercase tracking-widest" style={{ color: land.label }}>
              {doneCount}/{skill.lessons.length} stops
            </Text>
          </View>
          <Pressable
            onPress={() => {
              hapticLight();
              router.push("/library");
            }}
            className="h-10 w-10 items-center justify-center rounded-full bg-white"
          >
            <Text className="text-lg">📚</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 36 }}>
          {/* Listen warm-up pill */}
          <View className="mx-4 mt-3 items-center">
            <Pressable
              onPress={() => {
                hapticLight();
                router.push({
                  pathname: "/listen",
                  params: { skillId: skill.id },
                });
              }}
              className="flex-row items-center gap-2 rounded-full bg-white px-4 py-2"
            >
              <Text className="text-base">👂</Text>
              <Text className="text-sm font-extrabold font-display" style={{ color: land.label }}>
                Listen warm-up
              </Text>
            </Pressable>
          </View>

          {/* The winding trail */}
          <View className="items-center pt-6">
            {skill.lessons.map((lesson, i) => {
              const unlocked = isLessonUnlocked(activeChild, lesson.id);
              const stars = activeChild.progress[lesson.id]?.stars ?? 0;
              const isCurrent = lesson.id === currentLessonId;
              const state: NodeState = !unlocked
                ? "locked"
                : stars >= 2
                  ? "done"
                  : isCurrent
                    ? "current"
                    : "available";
              const ringProgress =
                state === "current"
                  ? (activeChild.progress[lesson.id]?.bestScore ?? 0) / 100
                  : 0;
              return (
                <View
                  key={lesson.id}
                  style={{ transform: [{ translateX: OFFSETS[i % OFFSETS.length] }] }}
                  className="my-3 items-center"
                >
                  <LessonNode
                    state={state}
                    isCurrent={isCurrent}
                    level={LEVEL_INFO[lesson.level].short}
                    stars={stars}
                    ringProgress={ringProgress}
                    onPress={() => {
                      if (!unlocked) return;
                      hapticLight();
                      router.push({
                        pathname: "/lesson",
                        params: { skillId: skill.id, lessonId: lesson.id },
                      });
                    }}
                  />
                </View>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function LessonNode({
  state,
  isCurrent,
  level,
  stars,
  ringProgress,
  onPress,
}: {
  state: NodeState;
  isCurrent: boolean;
  level: string;
  stars: number;
  ringProgress: number;
  onPress: () => void;
}) {
  const SIZE = isCurrent ? 96 : 84;
  const palette =
    state === "done"
      ? { face: "#58cc02", edge: "#58a700" }
      : state === "current" || state === "available"
        ? { face: "#ff9600", edge: "#e08600" }
        : { face: "#e5e5e5", edge: "#cfcfcf" };

  const icon =
    state === "locked"
      ? "🔒"
      : state === "done"
        ? "⭐"
        : "🎤";

  return (
    <View className="items-center">
      {isCurrent ? (
        <View className="mb-2 items-center">
          <View
            className="rounded-xl px-3 py-1"
            style={{ backgroundColor: "#ffffff", borderWidth: 2, borderColor: "#e5e5e5" }}
          >
            <Text className="text-[11px] font-extrabold font-display uppercase tracking-wider text-ink">
              Start
            </Text>
          </View>
          <View
            style={{
              width: 0,
              height: 0,
              borderLeftWidth: 6,
              borderRightWidth: 6,
              borderTopWidth: 6,
              borderLeftColor: "transparent",
              borderRightColor: "transparent",
              borderTopColor: "#ffffff",
            }}
          />
        </View>
      ) : null}

      {state === "current" ? (
        <View
          style={{
            position: "absolute",
            top: 28,
            width: SIZE + 22,
            height: SIZE + 22,
            borderRadius: (SIZE + 22) / 2,
            borderWidth: 5,
            borderColor: "#e5e5e5",
          }}
        />
      ) : null}
      {state === "current" && ringProgress > 0 ? (
        <View
          style={{
            position: "absolute",
            top: 28,
            width: SIZE + 22,
            height: SIZE + 22,
            borderRadius: (SIZE + 22) / 2,
            borderWidth: 5,
            borderColor: "#58cc02",
            borderRightColor: ringProgress < 0.75 ? "transparent" : "#58cc02",
            borderBottomColor: ringProgress < 0.5 ? "transparent" : "#58cc02",
            borderLeftColor: ringProgress < 0.25 ? "transparent" : "#58cc02",
            transform: [{ rotate: "-45deg" }],
          }}
        />
      ) : null}

      <Pressable onPress={onPress} disabled={state === "locked"}>
        {({ pressed }) => (
          <View style={{ backgroundColor: palette.edge, borderRadius: 999 }}>
            <View
              className="items-center justify-center rounded-full"
              style={{
                width: SIZE,
                height: SIZE,
                backgroundColor: palette.face,
                transform: [{ translateY: pressed ? 6 : 0 }],
                marginBottom: pressed ? 0 : 7,
              }}
            >
              <Text style={{ fontSize: SIZE * 0.42 }}>{icon}</Text>
              {state !== "locked" ? (
                <View
                  className="absolute rounded-full bg-white px-1.5"
                  style={{ bottom: -4, borderWidth: 2, borderColor: palette.edge }}
                >
                  <Text className="text-[10px] font-extrabold font-display" style={{ color: palette.edge }}>
                    L{level}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        )}
      </Pressable>

      {state !== "locked" ? (
        <View className="mt-3 flex-row gap-0.5">
          {[0, 1, 2].map((i) => (
            <Text
              key={i}
              className="text-xs"
              style={{ opacity: i < stars ? 1 : 0.18 }}
            >
              ⭐
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function skillLandTint(bg: string): { sky: string; grass: string; label: string } {
  if (bg.includes("sky")) return { sky: "#eaf6ff", grass: "#cdeeb0", label: "#1899d6" };
  if (bg.includes("brand")) return { sky: "#fff3ea", grass: "#ffdcb8", label: "#c2410c" };
  if (bg.includes("grass")) return { sky: "#eefce2", grass: "#c5ebab", label: "#58a700" };
  return { sky: "#f3f2ff", grass: "#dfe6c8", label: "#7c6fd6" };
}

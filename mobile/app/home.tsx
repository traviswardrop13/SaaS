import { useRouter, usePathname } from "expo-router";
import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LEVEL_INFO, type Skill, type Lesson } from "@/lib/lessons";
import { useStore, visibleSkills, isLessonUnlocked, type Child } from "@/lib/store";
import { Loading, Pill, Button } from "@/components/ui";
import TalkingFace from "@/components/TalkingFace";

// Horizontal offsets that make the node column gently wind like a path.
const OFFSETS = [0, 60, 88, 60, 0, -60, -88, -60];

type NodeState = "locked" | "current" | "done" | "available";

export default function Home() {
  const router = useRouter();
  const { ready, activeChild } = useStore();

  if (!ready) return <Loading />;

  if (!activeChild) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-center text-lg text-wolf">No profile yet.</Text>
        <View className="mt-4 w-full max-w-xs">
          <Button label="Set up" onPress={() => router.replace("/welcome")} />
        </View>
      </SafeAreaView>
    );
  }

  const skills = visibleSkills(activeChild);

  // The single "current" lesson — first unlocked one not yet mastered — gets
  // the progress ring + START banner. The next unlocked one is "available".
  let currentLessonId: string | null = null;
  outer: for (const skill of skills) {
    for (const lesson of skill.lessons) {
      const unlocked = isLessonUnlocked(activeChild, lesson.id);
      const stars = activeChild.progress[lesson.id]?.stars ?? 0;
      if (unlocked && stars < 2) {
        currentLessonId = lesson.id;
        break outer;
      }
    }
  }

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView className="flex-1" edges={["top"]}>
        {/* Header */}
        <View className="flex-row items-center justify-between border-b-2 border-swan px-4 pb-3 pt-1">
          <View className="flex-row items-center gap-2">
            <View className="h-10 w-10 items-center justify-center rounded-2xl border-2 border-swan bg-polar">
              <Text className="text-xl">{activeChild.avatar || "🦁"}</Text>
            </View>
            <View>
              <Text className="text-base font-extrabold text-ink">
                {activeChild.name}
              </Text>
              <Text className="text-[11px] font-extrabold uppercase tracking-wider text-hare">
                Learner
              </Text>
            </View>
          </View>
          <View className="flex-row gap-2">
            <StatChip icon="🔥" value={String(activeChild.streak)} color="#ff9600" />
            <StatChip icon="⚡" value={String(activeChild.xp)} color="#ffc800" />
          </View>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 100, paddingTop: 10 }}
        >
          {/* Talk with Leo — the AI conversation companion */}
          <Pressable
            onPress={() => router.push("/talk")}
            className="mx-4 mb-3"
            style={{ backgroundColor: "#c2410c", borderRadius: 24 }}
          >
            <View
              className="flex-row items-center gap-3 rounded-3xl px-4 py-3"
              style={{ backgroundColor: "#ea580c", marginBottom: 4 }}
            >
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-white/25">
                <Text className="text-xl">💬</Text>
              </View>
              <View className="flex-1">
                <Text className="text-base font-extrabold text-white">
                  Talk with Leo
                </Text>
                <Text className="text-xs font-bold text-white/85">
                  Have a real conversation
                </Text>
              </View>
              <Text className="rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
                AI
              </Text>
            </View>
          </Pressable>

          {/* Cross-track entry: the Language product */}
          <Pressable
            onPress={() => router.push("/language")}
            className="mx-4 mb-4 flex-row items-center gap-3 rounded-3xl border-2 border-swan bg-polar px-4 py-3"
          >
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-grass-500">
              <Text className="text-xl">🧠</Text>
            </View>
            <View className="flex-1">
              <Text className="text-base font-extrabold text-ink">
                Language practice
              </Text>
              <Text className="text-xs font-bold text-wolf">
                Words, questions & sentences
              </Text>
            </View>
            <Text className="rounded-full bg-grass-500 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
              New
            </Text>
          </Pressable>

          {skills.map((skill) => (
            <SkillSection
              key={skill.id}
              skill={skill}
              child={activeChild}
              currentLessonId={currentLessonId}
              onOpen={(lesson) =>
                router.push({
                  pathname: "/lesson",
                  params: { skillId: skill.id, lessonId: lesson.id },
                })
              }
            />
          ))}
        </ScrollView>

        <BottomNav />
      </SafeAreaView>
    </View>
  );
}

function StatChip({
  icon,
  value,
  color,
}: {
  icon: string;
  value: string;
  color: string;
}) {
  return (
    <View className="flex-row items-center gap-1 rounded-xl border-2 border-swan bg-white px-2.5 py-1">
      <Text className="text-base">{icon}</Text>
      <Text className="text-base font-extrabold" style={{ color }}>
        {value}
      </Text>
    </View>
  );
}

function SkillSection({
  skill,
  child,
  currentLessonId,
  onOpen,
}: {
  skill: Skill;
  child: Child;
  currentLessonId: string | null;
  onOpen: (lesson: Lesson) => void;
}) {
  // Section banner is a chunky 3D card with title hierarchy mirroring
  // Duolingo's section/unit pattern.
  const bannerEdge = skillEdgeColor(skill.color);
  return (
    <View className="mb-5">
      {/* Section banner */}
      <View className="mx-4 mb-5" style={{ backgroundColor: bannerEdge, borderRadius: 20 }}>
        <View
          className={`flex-row items-center gap-3 rounded-[20px] px-4 py-3 ${skill.color}`}
          style={{ marginBottom: 4 }}
        >
          <View className="flex-1">
            <Text className="text-[11px] font-extrabold uppercase tracking-widest text-white/80">
              Skill · {skill.lessons.length} lessons
            </Text>
            <Text className="mt-0.5 text-2xl font-extrabold text-white">
              {skill.title}
            </Text>
          </View>
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-white/25">
            <Text className="text-2xl">{skill.emoji}</Text>
          </View>
        </View>
      </View>

      {/* Path of lesson nodes */}
      <View className="items-center">
        {skill.lessons.map((lesson, i) => {
          const unlocked = isLessonUnlocked(child, lesson.id);
          const stars = child.progress[lesson.id]?.stars ?? 0;
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
              ? (child.progress[lesson.id]?.bestScore ?? 0) / 100
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
                onPress={() => unlocked && onOpen(lesson)}
              />
            </View>
          );
        })}
      </View>
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
            <Text className="text-[11px] font-extrabold uppercase tracking-wider text-ink">
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

      {/* Progress ring for the active node — a thin track with a green arc
          that fills as the kid scores higher on this lesson. */}
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
              <Text style={{ fontSize: SIZE * 0.42 }}>
                {icon}
              </Text>
              {/* Tiny level badge so the hierarchy is still visible */}
              {state !== "locked" ? (
                <View
                  className="absolute rounded-full bg-white px-1.5"
                  style={{ bottom: -4, borderWidth: 2, borderColor: palette.edge }}
                >
                  <Text className="text-[10px] font-extrabold" style={{ color: palette.edge }}>
                    L{level}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        )}
      </Pressable>

      {/* Stars earned */}
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

function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const tabs: { icon: string; label: string; path: string }[] = [
    { icon: "🏠", label: "Learn", path: "/home" },
    { icon: "🦁", label: "Lion", path: "/home" }, // placeholder — TODO: profile
    { icon: "📊", label: "Stats", path: "/home" }, // placeholder — TODO: progress
  ];
  return (
    <View className="absolute bottom-0 left-0 right-0 border-t-2 border-swan bg-white">
      <View className="flex-row items-center justify-around px-2 py-2">
        {tabs.map((t, i) => {
          const active = i === 0 && (pathname === "/home" || pathname === "/");
          return (
            <Pressable
              key={i}
              onPress={() => router.push(t.path as never)}
              className={`flex-1 items-center rounded-2xl py-2 ${
                active ? "bg-macaw-50" : ""
              }`}
            >
              <Text className="text-2xl">{t.icon}</Text>
              <Text
                className={`mt-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                  active ? "text-macaw" : "text-hare"
                }`}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Pick a sensible darker edge color from a tailwind bg- class like "bg-sky-500". */
function skillEdgeColor(bg: string): string {
  if (bg.includes("sky")) return "#1899d6";
  if (bg.includes("brand")) return "#c2410c";
  if (bg.includes("grass")) return "#58a700";
  return "#3c3c3c";
}

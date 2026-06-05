import { useRouter } from "expo-router";
import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LEVEL_INFO, type Skill, type Lesson } from "@/lib/lessons";
import { useStore, visibleSkills, isLessonUnlocked, type Child } from "@/lib/store";
import { Loading, Pill, Button } from "@/components/ui";

// Horizontal offsets that make the node column gently wind like a path.
const OFFSETS = [0, 46, 72, 46, 0, -46, -72, -46];

type NodeState = "locked" | "current" | "done";

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
  // the bouncing START treatment, Duolingo-style.
  let currentLessonId: string | null = null;
  for (const skill of skills) {
    for (const lesson of skill.lessons) {
      const unlocked = isLessonUnlocked(activeChild, lesson.id);
      const stars = activeChild.progress[lesson.id]?.stars ?? 0;
      if (unlocked && stars < 2) {
        currentLessonId = lesson.id;
        break;
      }
    }
    if (currentLessonId) break;
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center justify-between border-b-2 border-swan px-4 pb-3 pt-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-3xl">{activeChild.avatar || "🦁"}</Text>
          <Text className="text-xl font-extrabold text-ink">
            {activeChild.name}
          </Text>
        </View>
        <View className="flex-row gap-2">
          <Pill color="#fff4d6" text="#e0a800">
            🔥 {activeChild.streak}
          </Pill>
          <Pill color="#f0fde4" text="#58a700">
            ⚡ {activeChild.xp}
          </Pill>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 60, paddingTop: 8 }}
      >
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
    </SafeAreaView>
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
  return (
    <View className="mb-4">
      {/* Section banner */}
      <View
        className={`mx-4 mb-2 flex-row items-center gap-3 rounded-3xl px-4 py-3 ${skill.color}`}
      >
        <Text className="text-3xl">{skill.emoji}</Text>
        <View className="flex-1">
          <Text className="text-lg font-extrabold text-white">
            {skill.title}
          </Text>
          <Text className="text-xs font-bold uppercase tracking-wide text-white/80">
            {skill.subtitle}
          </Text>
        </View>
      </View>

      {/* Path of lesson nodes */}
      <View className="items-center py-2">
        {skill.lessons.map((lesson, i) => {
          const unlocked = isLessonUnlocked(child, lesson.id);
          const stars = child.progress[lesson.id]?.stars ?? 0;
          const state: NodeState = !unlocked
            ? "locked"
            : stars >= 2
              ? "done"
              : "current";
          const isCurrent = lesson.id === currentLessonId;
          return (
            <View
              key={lesson.id}
              style={{ transform: [{ translateX: OFFSETS[i % OFFSETS.length] }] }}
              className="my-2 items-center"
            >
              <LessonNode
                state={state}
                isCurrent={isCurrent}
                level={LEVEL_INFO[lesson.level].short}
                stars={stars}
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
  onPress,
}: {
  state: NodeState;
  isCurrent: boolean;
  level: string;
  stars: number;
  onPress: () => void;
}) {
  const palette =
    state === "done"
      ? { face: "#58cc02", edge: "#58a700" }
      : state === "current"
        ? { face: "#ff9600", edge: "#e08600" }
        : { face: "#e5e5e5", edge: "#cfcfcf" };
  const size = isCurrent ? 80 : 70;

  return (
    <View className="items-center">
      {isCurrent ? (
        <View className="mb-1 rounded-xl bg-ink px-3 py-1">
          <Text className="text-[11px] font-extrabold uppercase tracking-wide text-white">
            Start
          </Text>
        </View>
      ) : null}
      <Pressable onPress={onPress} disabled={state === "locked"}>
        {({ pressed }) => (
          <View style={{ backgroundColor: palette.edge, borderRadius: 999 }}>
            <View
              className="items-center justify-center rounded-full"
              style={{
                width: size,
                height: size,
                backgroundColor: palette.face,
                transform: [{ translateY: pressed ? 5 : 0 }],
                marginBottom: pressed ? 0 : 6,
              }}
            >
              <Text className="text-2xl font-extrabold text-white">
                {state === "locked" ? "🔒" : state === "done" ? "✓" : level}
              </Text>
            </View>
          </View>
        )}
      </Pressable>
      {/* Stars earned */}
      {state !== "locked" ? (
        <Text className="mt-1 text-xs">
          {"⭐".repeat(stars)}
          <Text style={{ opacity: 0.18 }}>{"⭐".repeat(3 - stars)}</Text>
        </Text>
      ) : null}
    </View>
  );
}

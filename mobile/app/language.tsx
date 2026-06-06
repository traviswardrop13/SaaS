import { useRouter } from "expo-router";
import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  LANGUAGE_SKILLS,
  languageLessonsInOrder,
  languageSections,
  type LanguageLesson,
} from "@/lib/language";
import { useStore, type Child } from "@/lib/store";
import { Loading } from "@/components/ui";

// Sequential unlock within the language track (mirrors speech: a lesson
// unlocks once the previous one is done with 2+ stars).
function isUnlocked(child: Child, lessonId: string): boolean {
  const order = languageLessonsInOrder();
  const i = order.findIndex((o) => o.lessonId === lessonId);
  if (i <= 0) return true;
  return (child.progress[order[i - 1].lessonId]?.stars ?? 0) >= 2;
}

export default function LanguageHome() {
  const router = useRouter();
  const { ready, activeChild } = useStore();
  if (!ready) return <Loading />;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between border-b-2 border-swan px-4 pb-3 pt-1">
        <Pressable
          onPress={() => router.replace("/home")}
          className="flex-row items-center gap-1.5"
        >
          <Text className="text-lg text-hare">‹</Text>
          <Text className="text-sm font-extrabold font-display uppercase tracking-wide text-hare">
            Speech
          </Text>
        </Pressable>
        <Text className="text-lg font-extrabold font-display text-ink">Language 🧠</Text>
        <View className="w-16" />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 60, paddingTop: 12 }}>
        {languageSections().map((section) => (
          <View key={section} className="mb-3">
            <Text className="mb-2 px-4 text-xl font-extrabold font-display text-ink">
              {section}
            </Text>
            {LANGUAGE_SKILLS.filter((s) => s.section === section).map((skill) => (
              <View key={skill.id} className="mb-5">
                <View
                  className={`mx-4 mb-3 flex-row items-center gap-3 rounded-3xl px-4 py-3 ${skill.color}`}
                >
                  <Text className="text-3xl">{skill.emoji}</Text>
                  <View className="flex-1">
                    <Text className="text-lg font-extrabold font-display text-white">
                      {skill.title}
                    </Text>
                    <Text className="text-xs font-bold font-heading uppercase tracking-wide text-white/80">
                      {skill.subtitle}
                    </Text>
                  </View>
                </View>
                <View className="px-4">
                  {skill.lessons.map((lesson) => (
                    <LessonRow
                      key={lesson.id}
                      lesson={lesson}
                      child={activeChild}
                      onOpen={() =>
                        router.push({
                          pathname: "/language-lesson",
                          params: { skillId: skill.id, lessonId: lesson.id },
                        })
                      }
                    />
                  ))}
                </View>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function LessonRow({
  lesson,
  child,
  onOpen,
}: {
  lesson: LanguageLesson;
  child: Child | null;
  onOpen: () => void;
}) {
  const unlocked = child ? isUnlocked(child, lesson.id) : true;
  const stars = child?.progress[lesson.id]?.stars ?? 0;
  return (
    <Pressable
      disabled={!unlocked}
      onPress={onOpen}
      className={`mb-2 flex-row items-center gap-3 rounded-3xl border-2 p-4 ${
        unlocked ? "border-swan bg-white" : "border-swan bg-polar opacity-50"
      }`}
    >
      <View
        className="h-11 w-11 items-center justify-center rounded-full"
        style={{ backgroundColor: unlocked ? "#1cb0f6" : "#e5e5e5" }}
      >
        <Text className="text-lg">{unlocked ? "🧩" : "🔒"}</Text>
      </View>
      <Text className="flex-1 text-base font-extrabold font-display text-ink">
        {lesson.title}
      </Text>
      <View className="flex-row gap-0.5">
        {[0, 1, 2].map((i) => (
          <Text key={i} className="text-xs" style={{ opacity: i < stars ? 1 : 0.18 }}>
            ⭐
          </Text>
        ))}
      </View>
    </Pressable>
  );
}

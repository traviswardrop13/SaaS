import { useRouter } from "expo-router";
import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LEVEL_INFO } from "@/lib/lessons";
import { useStore, visibleSkills, isLessonUnlocked } from "@/lib/store";
import { Loading } from "@/components/ui";

export default function Home() {
  const router = useRouter();
  const { ready, activeChild } = useStore();

  if (!ready) return <Loading />;

  if (!activeChild) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-center text-lg text-gray-600">
          No profile yet.
        </Text>
        <Pressable
          onPress={() => router.replace("/welcome")}
          className="mt-4 rounded-2xl bg-grass-500 px-6 py-3"
        >
          <Text className="font-extrabold uppercase text-white">Set up</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const skills = visibleSkills(activeChild);

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3">
        <View>
          <Text className="text-2xl font-extrabold text-gray-800">
            {activeChild.name} {activeChild.avatar}
          </Text>
          <Text className="text-sm text-gray-500">
            {activeChild.xp} XP · {activeChild.streak}🔥
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 40 }}>
        {skills.map((skill) => (
          <View key={skill.id} className="mb-8">
            <View className="mb-3 flex-row items-center gap-3">
              <Text className="text-3xl">{skill.emoji}</Text>
              <View>
                <Text className="text-xl font-extrabold text-gray-800">
                  {skill.title}
                </Text>
                <Text className="text-sm text-gray-500">{skill.subtitle}</Text>
              </View>
            </View>

            {skill.lessons.map((lesson) => {
              const unlocked = isLessonUnlocked(activeChild, lesson.id);
              const stars = activeChild.progress[lesson.id]?.stars ?? 0;
              return (
                <Pressable
                  key={lesson.id}
                  disabled={!unlocked}
                  onPress={() =>
                    router.push({
                      pathname: "/lesson",
                      params: { skillId: skill.id, lessonId: lesson.id },
                    })
                  }
                  className={`mb-2 flex-row items-center gap-3 rounded-3xl border-2 p-4 ${
                    unlocked
                      ? "border-gray-100 bg-white"
                      : "border-gray-100 bg-gray-50 opacity-50"
                  }`}
                >
                  <View
                    className="h-10 w-10 items-center justify-center rounded-full bg-gray-100"
                  >
                    <Text className="text-xs font-extrabold text-gray-500">
                      {unlocked ? LEVEL_INFO[lesson.level].short : "🔒"}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-bold text-gray-800">
                      {lesson.title}
                    </Text>
                    <Text className="text-xs uppercase tracking-wide text-gray-400">
                      {LEVEL_INFO[lesson.level].label}
                    </Text>
                  </View>
                  <Text className="text-lg">
                    {"⭐".repeat(stars)}
                    <Text className="text-gray-200">
                      {"⭐".repeat(3 - stars)}
                    </Text>
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

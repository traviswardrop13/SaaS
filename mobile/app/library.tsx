import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useStore, visibleSkills } from "@/lib/store";
import { pairSetsForFocus } from "@/lib/minimalPairs";
import { Button, Loading } from "@/components/ui";
import { hapticLight } from "@/lib/haptics";

/**
 * Practice library — the "books" tab from the Duolingo ABC top-right. Houses
 * everything that isn't the core leveled trail: Sound Match listening games,
 * "Sound Show" auditory warm-ups per skill, and the language games entry.
 * Curated to the child's current plan when one exists.
 */
export default function Library() {
  const router = useRouter();
  const { ready, activeChild } = useStore();

  if (!ready) return <Loading />;
  if (!activeChild) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-base text-wolf">No profile yet.</Text>
        <View className="mt-4 w-full max-w-xs">
          <Button label="Back to home" onPress={() => router.replace("/home")} />
        </View>
      </SafeAreaView>
    );
  }

  const pairSets = pairSetsForFocus(activeChild.focusAreas ?? []);
  const planSkills = visibleSkills(activeChild);

  return (
    <SafeAreaView className="flex-1 bg-polar" edges={["top", "bottom"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between bg-white px-4 pb-3 pt-1">
        <Pressable
          onPress={() => {
            hapticLight();
            router.back();
          }}
          className="h-10 w-10 items-center justify-center rounded-full bg-polar"
        >
          <Text className="text-lg font-extrabold font-display text-macaw">←</Text>
        </Pressable>
        <Text className="text-lg font-extrabold font-display text-ink">
          Practice
        </Text>
        <View className="h-10 w-10" />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 36 }}>
        {/* Your sounds — the leveled practice paths (moved off the home) */}
        <Section title="Your sounds" subtitle="step-by-step practice">
          {planSkills.map((skill) => {
            const earned = skill.lessons.reduce(
              (n, l) => n + Math.min(3, activeChild.progress[l.id]?.stars ?? 0),
              0,
            );
            const total = skill.lessons.length * 3;
            return (
              <Pressable
                key={skill.id}
                onPress={() => {
                  hapticLight();
                  router.push({ pathname: "/skill/[id]", params: { id: skill.id } });
                }}
                className="flex-row items-center gap-3 rounded-4xl border-2 border-swan bg-white px-4 py-3"
              >
                <View className="h-11 w-11 items-center justify-center rounded-3xl bg-polar">
                  <Text className="text-2xl">{skill.emoji}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-base font-extrabold font-display text-ink">
                    {skill.title}
                  </Text>
                  <Text className="text-xs font-bold font-heading text-wolf">
                    ⭐ {earned}/{total}
                  </Text>
                </View>
                <Text className="text-xl text-hare">›</Text>
              </Pressable>
            );
          })}
        </Section>

        {/* Sound Match */}
        <Section title="Sound Match" subtitle="listening games">
          {pairSets.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => {
                hapticLight();
                router.push({
                  pathname: "/minimal-pair",
                  params: { setId: s.id },
                });
              }}
              className="flex-row items-center gap-3 rounded-4xl border-2 border-macaw bg-macaw-50 px-4 py-3"
            >
              <View className="h-11 w-11 items-center justify-center rounded-3xl bg-white">
                <Text className="text-2xl">{s.emoji}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-base font-extrabold font-display text-ink">
                  {s.title}
                </Text>
                <Text className="text-xs font-bold font-heading text-wolf">
                  {s.process}
                </Text>
              </View>
              <Text className="text-xl text-macaw">▶</Text>
            </Pressable>
          ))}
        </Section>

        {/* Sound Show — auditory bombardment, per skill in plan */}
        <Section title="Sound Show" subtitle="just listen — tune the ear">
          {planSkills.map((skill) => (
            <Pressable
              key={`listen-${skill.id}`}
              onPress={() => {
                hapticLight();
                router.push({
                  pathname: "/listen",
                  params: { skillId: skill.id },
                });
              }}
              className="flex-row items-center gap-3 rounded-4xl border-2 border-swan bg-white px-4 py-3"
            >
              <View className="h-11 w-11 items-center justify-center rounded-3xl bg-polar">
                <Text className="text-2xl">{skill.emoji}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-base font-extrabold font-display text-ink">
                  {skill.title}
                </Text>
                <Text className="text-xs font-bold font-heading text-wolf">
                  Hear a bunch of {skill.title.toLowerCase()} words
                </Text>
              </View>
              <Text className="text-xl">👂</Text>
            </Pressable>
          ))}
        </Section>

        {/* Language games */}
        <Section title="Language" subtitle="words, questions & sentences">
          <Pressable
            onPress={() => {
              hapticLight();
              router.push("/language");
            }}
            className="flex-row items-center gap-3 rounded-4xl border-2 border-feather bg-feather-50 px-4 py-3"
          >
            <View className="h-11 w-11 items-center justify-center rounded-3xl bg-feather">
              <Text className="text-2xl">🧠</Text>
            </View>
            <View className="flex-1">
              <Text className="text-base font-extrabold font-display text-ink">
                Language practice
              </Text>
              <Text className="text-xs font-bold font-heading text-wolf">
                Tap-based exercises, no mic
              </Text>
            </View>
            <Text className="text-xl text-feather-edge">▶</Text>
          </Pressable>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-6">
      <View className="mb-2.5 flex-row items-baseline gap-2 px-1">
        <Text className="text-base font-extrabold font-display text-ink">
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-xs font-bold font-heading text-hare">
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View className="gap-2.5">{children}</View>
    </View>
  );
}

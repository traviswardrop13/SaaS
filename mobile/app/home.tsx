import { useRouter } from "expo-router";
import { useEffect } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useStore, weeklySessionCount, weeklyGoal } from "@/lib/store";
import { Loading, Button } from "@/components/ui";
import { hapticLight } from "@/lib/haptics";
import { leoGreetHome } from "@/lib/leo";

/**
 * Home — deliberately almost nothing. Two things only: start today's session,
 * and your weekly goal. Everything that isn't those two lives behind the
 * parent area, so the child's screen never competes with the core loop.
 */
export default function Home() {
  const router = useRouter();
  const { ready, activeChild } = useStore();

  useEffect(() => {
    if (ready && activeChild) {
      leoGreetHome(activeChild.name, activeChild.id);
    }
  }, [ready, activeChild?.id, activeChild?.name]);

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

  const child = activeChild;
  const done = weeklySessionCount(child);
  const goal = weeklyGoal(child);
  const hasPlan = (child.focusAreas?.length ?? 0) > 0;
  const goalMet = done >= goal;

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView className="flex-1" edges={["top"]}>
        {/* Top bar — just the profile + the weekly goal */}
        <View className="flex-row items-center justify-between px-4 pb-3 pt-1">
          <Pressable
            onPress={() => {
              hapticLight();
              router.push("/parent");
            }}
            className="h-11 w-11 items-center justify-center rounded-2xl border-2 border-swan bg-polar"
          >
            <Text className="text-2xl">{child.avatar || "🌟"}</Text>
          </Pressable>
          <View className="flex-row items-center gap-1 rounded-xl border-2 border-swan bg-white px-3 py-1.5">
            <Text className="text-base">📅</Text>
            <Text className="text-base font-extrabold font-display text-feather-edge">
              {done}/{goal} this week
            </Text>
          </View>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 32, paddingTop: 8 }}
        >
          {/* Today's session — the hero */}
          <Pressable
            onPress={() => {
              hapticLight();
              router.push("/session");
            }}
            className="mx-4 overflow-hidden rounded-5xl bg-macaw"
          >
            <View className="px-5 pb-5 pt-6">
              <Text className="text-xs font-extrabold font-display uppercase tracking-widest text-white/80">
                Today&apos;s session
              </Text>
              <View className="mt-2 flex-row items-center gap-3">
                <View className="h-16 w-16 items-center justify-center rounded-3xl bg-white/25">
                  <Text className="text-3xl">🎙️</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-2xl font-extrabold font-display text-white">
                    Practice with {child.name}&apos;s coach
                  </Text>
                  <Text className="text-xs font-bold font-heading text-white/90">
                    Press go &amp; talk — about {child.sessionMinutes ?? 15} min
                  </Text>
                </View>
              </View>
              <View className="mt-4 items-center rounded-3xl bg-white py-3.5">
                <Text className="text-base font-extrabold font-display text-macaw">
                  ▶  Start session
                </Text>
              </View>
            </View>
          </Pressable>

          {/* Weekly goal */}
          <View className="mx-4 mt-4 rounded-4xl border-2 border-swan bg-polar p-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-extrabold font-display text-ink">
                This week
              </Text>
              <Text className="text-sm font-extrabold font-display text-feather-edge">
                {goalMet ? "Goal reached! 🎉" : `${done} of ${goal}`}
              </Text>
            </View>
            <View className="mt-3 flex-row gap-2">
              {Array.from({ length: goal }).map((_, i) => (
                <View
                  key={i}
                  className="h-3 flex-1 rounded-full"
                  style={{ backgroundColor: i < done ? "#58cc02" : "#e5e5e5" }}
                />
              ))}
            </View>
            <Text className="mt-2.5 text-xs font-bold font-heading text-wolf">
              {goalMet
                ? "Amazing consistency this week!"
                : `${goal - done} more session${goal - done === 1 ? "" : "s"} to hit ${child.name}'s goal.`}
            </Text>
          </View>

          {/* Find sounds — only until there's a plan (it personalizes sessions) */}
          {!hasPlan ? (
            <Pressable
              onPress={() => {
                hapticLight();
                router.push("/screener");
              }}
              className="mx-4 mt-4 flex-row items-center gap-3 rounded-4xl bg-brand-500 px-4 py-4"
            >
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-white/25">
                <Text className="text-2xl">🎧</Text>
              </View>
              <View className="flex-1">
                <Text className="text-lg font-extrabold font-display text-white">
                  Find {child.name}&apos;s sounds
                </Text>
                <Text className="text-xs font-bold font-heading text-white/90">
                  A quick check builds the personal plan
                </Text>
              </View>
              <Text className="text-2xl text-white">›</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

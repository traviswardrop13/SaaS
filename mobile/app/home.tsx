import { useRouter, usePathname } from "expo-router";
import { useEffect } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useStore, weeklySessionCount, weeklyGoal } from "@/lib/store";
import { Loading, Button, Coin } from "@/components/ui";
import { hapticLight } from "@/lib/haptics";
import { leoGreetHome } from "@/lib/leo";

/**
 * Session-first home. The hero is "today's session" with your coach; progress
 * is a humane weekly goal (not a guilt-inducing daily streak). The gamified
 * skill town + games have receded into the Practice tab — this screen stays
 * focused on the one thing that matters: press go and practice.
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

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView className="flex-1" edges={["top"]}>
        {/* Top bar */}
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
          <View className="flex-row items-center gap-2">
            <View className="flex-row items-center gap-1 rounded-xl border-2 border-swan bg-white px-2.5 py-1.5">
              <Text className="text-base">📅</Text>
              <Text className="text-base font-extrabold font-display text-feather-edge">
                {done}/{goal}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                hapticLight();
                router.push("/world");
              }}
              className="flex-row items-center gap-1 rounded-xl border-2 border-swan bg-white px-2.5 py-1.5"
            >
              <Coin size={16} />
              <Text className="text-base font-extrabold font-display text-bee-edge">
                {child.coins ?? 0}
              </Text>
            </Pressable>
          </View>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 100, paddingTop: 8 }}
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
              <View className="mt-4">
                <View className="items-center rounded-3xl bg-white py-3.5">
                  <Text className="text-base font-extrabold font-display text-macaw">
                    ▶  Start session
                  </Text>
                </View>
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
                {done >= goal ? "Goal reached! 🎉" : `${done} of ${goal}`}
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
          </View>

          {/* Find sounds — only if no plan yet */}
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

          {/* Extra practice → the Practice tab */}
          <Pressable
            onPress={() => {
              hapticLight();
              router.push("/library");
            }}
            className="mx-4 mt-4 flex-row items-center gap-3 rounded-4xl border-2 border-swan bg-white px-4 py-3.5"
          >
            <View className="h-11 w-11 items-center justify-center rounded-3xl bg-polar">
              <Text className="text-xl">🎯</Text>
            </View>
            <View className="flex-1">
              <Text className="text-base font-extrabold font-display text-ink">
                Extra practice
              </Text>
              <Text className="text-xs font-bold font-heading text-wolf">
                Games &amp; sound-by-sound practice
              </Text>
            </View>
            <Text className="text-xl text-hare">›</Text>
          </Pressable>
        </ScrollView>

        <BottomNav />
      </SafeAreaView>
    </View>
  );
}

function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const tabs: { icon: string; label: string; path: "/home" | "/library" | "/parent" }[] = [
    { icon: "🏠", label: "Home", path: "/home" },
    { icon: "🎯", label: "Practice", path: "/library" },
    { icon: "👤", label: "Parent", path: "/parent" },
  ];
  return (
    <View className="absolute bottom-0 left-0 right-0 border-t-2 border-swan bg-white">
      <View className="flex-row items-center justify-around px-2 py-2">
        {tabs.map((t, i) => {
          const active = pathname === t.path || (t.path === "/home" && pathname === "/");
          return (
            <Pressable
              key={i}
              onPress={() => {
                if (active) return;
                hapticLight();
                router.push(t.path);
              }}
              className={`flex-1 items-center rounded-2xl py-2 ${active ? "bg-macaw-50" : ""}`}
            >
              <Text className="text-2xl">{t.icon}</Text>
              <Text
                className={`mt-0.5 text-[10px] font-extrabold font-display uppercase tracking-wider ${
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

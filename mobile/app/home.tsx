import { useRouter, usePathname } from "expo-router";
import { useEffect, useRef } from "react";
import { View, Text, Pressable, ScrollView, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { type Skill } from "@/lib/lessons";
import { useStore, visibleSkills, isLessonUnlocked, type Child } from "@/lib/store";
import { Loading, Button, Coin } from "@/components/ui";
import { hapticLight } from "@/lib/haptics";
import { leoGreetHome } from "@/lib/leo";

/**
 * Town overview — the home. Stripped down per ABC-style design: minimal text,
 * each skill is a single "building" tile, no inline lesson trails. Tapping a
 * building opens its own screen (the path with locks). The cross-tracks
 * (Library, Leo's World, parent dashboard) live in the top-right + bottom nav.
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

  const skills = visibleSkills(activeChild);
  const hasPlan = (activeChild.focusAreas?.length ?? 0) > 0;

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView className="flex-1" edges={["top"]}>
        {/* Top bar — icon-driven, minimal text */}
        <View className="flex-row items-center justify-between px-4 pb-3 pt-1">
          <Pressable
            onPress={() => {
              hapticLight();
              router.push("/parent");
            }}
            className="h-11 w-11 items-center justify-center rounded-2xl border-2 border-swan bg-polar"
          >
            <Text className="text-2xl">{activeChild.avatar || "🦁"}</Text>
          </Pressable>
          <View className="flex-row items-center gap-2">
            <StatChip icon="🔥" value={String(activeChild.streak)} color="#ff9600" />
            <Pressable
              onPress={() => {
                hapticLight();
                router.push("/world");
              }}
            >
              <StatChip iconNode={<Coin size={16} />} value={String(activeChild.coins ?? 0)} color="#e0a800" />
            </Pressable>
            <Pressable
              onPress={() => {
                hapticLight();
                router.push("/library");
              }}
              className="h-11 w-11 items-center justify-center rounded-2xl border-2 border-macaw bg-macaw-50"
            >
              <Text className="text-xl">📚</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 100, paddingTop: 6 }}
        >
          {/* Flagship: the live session with Leo */}
          <Pressable
            onPress={() => {
              hapticLight();
              router.push("/session");
            }}
            className="mx-4 mb-4 overflow-hidden rounded-5xl bg-macaw"
          >
            <View className="flex-row items-center gap-3 px-5 py-5">
              <View className="h-16 w-16 items-center justify-center rounded-3xl bg-white/25">
                <Text className="text-3xl">🎙️</Text>
              </View>
              <View className="flex-1">
                <Text className="text-xl font-extrabold font-display text-white">
                  Practice with Leo
                </Text>
                <Text className="text-xs font-bold font-heading text-white/90">
                  A live coaching session — press go & talk
                </Text>
              </View>
              <View className="h-11 w-11 items-center justify-center rounded-full bg-white">
                <Text className="text-xl text-macaw">▶</Text>
              </View>
            </View>
          </Pressable>

          {/* Find sounds — prominent ONLY when there's no plan yet */}
          {!hasPlan ? (
            <Pressable
              onPress={() => {
                hapticLight();
                router.push("/screener");
              }}
              className="mx-4 mb-4 flex-row items-center gap-3 rounded-4xl bg-brand-500 px-4 py-4"
            >
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-white/25">
                <Text className="text-2xl">🎧</Text>
              </View>
              <View className="flex-1">
                <Text className="text-lg font-extrabold font-display text-white">
                  Find {activeChild.name}&apos;s sounds
                </Text>
                <Text className="text-xs font-bold font-heading text-white/90">
                  Leo listens and builds a personal plan
                </Text>
              </View>
              <Text className="text-2xl text-white">›</Text>
            </Pressable>
          ) : null}

          {/* The town — one building per skill */}
          <View className="px-3">
            {skills.map((skill, i) => (
              <Building
                key={skill.id}
                skill={skill}
                child={activeChild}
                index={i}
                onOpen={() => {
                  hapticLight();
                  router.push({ pathname: "/skill/[id]", params: { id: skill.id } });
                }}
              />
            ))}
          </View>
        </ScrollView>

        <BottomNav />
      </SafeAreaView>
    </View>
  );
}

function StatChip({
  icon,
  iconNode,
  value,
  color,
}: {
  icon?: string;
  iconNode?: React.ReactNode;
  value: string;
  color: string;
}) {
  return (
    <View className="flex-row items-center gap-1 rounded-xl border-2 border-swan bg-white px-2.5 py-1.5">
      {iconNode ?? <Text className="text-base">{icon}</Text>}
      <Text className="text-base font-extrabold font-display" style={{ color }}>
        {value}
      </Text>
    </View>
  );
}

/**
 * A "town building" tile — the icon-driven, text-free home representation of
 * one skill. Tap → opens the inside-a-level path screen.
 */
function Building({
  skill,
  child,
  index,
  onOpen,
}: {
  skill: Skill;
  child: Child;
  index: number;
  onOpen: () => void;
}) {
  const land = skillLandTint(skill.color);
  const earnedStars = skill.lessons.reduce(
    (n, l) => n + Math.min(3, child.progress[l.id]?.stars ?? 0),
    0,
  );
  const totalStars = skill.lessons.length * 3;
  const allLocked = skill.lessons.every(
    (l) => !isLessonUnlocked(child, l.id),
  );

  // Idle bob — odd buildings sway opposite for variety.
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const dir = index % 2 === 0 ? 1 : -1;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const translateY = bob.interpolate({
    inputRange: [0, 1],
    outputRange: [0, index % 2 === 0 ? -4 : 4],
  });

  return (
    <Pressable onPress={onOpen} disabled={allLocked}>
      {({ pressed }) => (
        <View
          className="mb-4 overflow-hidden rounded-5xl"
          style={{
            backgroundColor: land.sky,
            opacity: allLocked ? 0.55 : 1,
            transform: [{ scale: pressed ? 0.97 : 1 }],
            shadowColor: "#3c3c3c",
            shadowOpacity: 0.1,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 6 },
            elevation: 4,
          }}
        >
          {/* grass band */}
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 60,
              backgroundColor: land.grass,
            }}
          />
          {/* scenery */}
          <Text style={{ position: "absolute", right: 18, top: 16, fontSize: 22 }}>
            ☁️
          </Text>
          <Text style={{ position: "absolute", left: 14, top: 18, fontSize: 22 }}>
            ☁️
          </Text>

          {/* the "building" — gently bobs */}
          <View style={{ height: 200, alignItems: "center", justifyContent: "center" }}>
            <Animated.View style={{ transform: [{ translateY }] }}>
              <View
                style={{
                  width: 130,
                  height: 130,
                  borderRadius: 36,
                  backgroundColor: "rgba(255,255,255,0.75)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 84 }}>{skill.emoji}</Text>
              </View>
            </Animated.View>
          </View>

          {/* progress strip — the only text on the tile, tiny */}
          <View
            className="flex-row items-center justify-center gap-1 pb-3"
            style={{ position: "relative", zIndex: 1 }}
          >
            {allLocked ? (
              <Text className="text-xs">🔒</Text>
            ) : (
              <>
                <Text className="text-xs">⭐</Text>
                <Text
                  className="text-xs font-extrabold font-display"
                  style={{ color: land.label }}
                >
                  {earnedStars}/{totalStars}
                </Text>
              </>
            )}
          </View>
        </View>
      )}
    </Pressable>
  );
}

function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const tabs: { icon: string; label: string; path: "/home" | "/library" | "/world" }[] = [
    { icon: "🏠", label: "Learn", path: "/home" },
    { icon: "📚", label: "Library", path: "/library" },
    { icon: "🦁", label: "Leo's World", path: "/world" },
  ];
  return (
    <View className="absolute bottom-0 left-0 right-0 border-t-2 border-swan bg-white">
      <View className="flex-row items-center justify-around px-2 py-2">
        {tabs.map((t, i) => {
          const active =
            pathname === t.path || (t.path === "/home" && pathname === "/");
          return (
            <Pressable
              key={i}
              onPress={() => {
                if (active) return;
                hapticLight();
                router.push(t.path);
              }}
              className={`flex-1 items-center rounded-2xl py-2 ${
                active ? "bg-macaw-50" : ""
              }`}
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

function skillLandTint(bg: string): { sky: string; grass: string; label: string } {
  if (bg.includes("sky")) return { sky: "#eaf6ff", grass: "#cdeeb0", label: "#1899d6" };
  if (bg.includes("brand")) return { sky: "#fff3ea", grass: "#ffdcb8", label: "#c2410c" };
  if (bg.includes("grass")) return { sky: "#eefce2", grass: "#c5ebab", label: "#58a700" };
  return { sky: "#f3f2ff", grass: "#dfe6c8", label: "#7c6fd6" };
}

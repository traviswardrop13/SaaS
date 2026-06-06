import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useStore, visibleSkills, type Child } from "@/lib/store";
import { SKILLS, findSkill } from "@/lib/lessons";
import { Button, Loading, ProgressBar } from "@/components/ui";
import LeoImage from "@/components/LeoImage";
import { hapticLight } from "@/lib/haptics";

/**
 * Parent dashboard — the grown-up's view: progress at a glance, the current
 * plan, profile switching, and the controls a parent needs. Read-mostly; the
 * actions route into flows that already exist (screener, onboarding).
 */
export default function Parent() {
  const router = useRouter();
  const { ready, state, activeChild, setActiveChild } = useStore();

  if (!ready) return <Loading />;
  if (!activeChild) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-base text-wolf">No profile yet.</Text>
        <View className="mt-4 w-full max-w-xs">
          <Button label="Set up" onPress={() => router.replace("/welcome")} />
        </View>
      </SafeAreaView>
    );
  }

  const child = activeChild;
  const plan = visibleSkills(child);
  const mastered = Object.values(child.progress).filter(
    (p) => p.stars >= 2,
  ).length;
  const totalStars = Object.values(child.progress).reduce(
    (n, p) => n + Math.min(3, p.stars),
    0,
  );

  return (
    <SafeAreaView className="flex-1 bg-polar" edges={["top", "bottom"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between bg-white px-4 pb-3 pt-1">
        <Pressable
          onPress={() => router.replace("/home")}
          className="h-9 w-9 items-center justify-center rounded-full bg-polar"
        >
          <Text className="text-lg font-bold font-heading text-hare">✕</Text>
        </Pressable>
        <Text className="text-lg font-extrabold font-display text-ink">
          Parent Dashboard
        </Text>
        <View className="h-9 w-9" />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 36 }}>
        {/* Child summary */}
        <View className="flex-row items-center gap-3 rounded-4xl bg-white p-4">
          <View className="h-16 w-16 items-center justify-center rounded-3xl bg-polar">
            <Text style={{ fontSize: 34 }}>{child.avatar || "🦁"}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-xl font-extrabold font-display text-ink">
              {child.name}
            </Text>
            <Text className="text-xs font-bold font-heading text-wolf">
              {child.dailyGoalMinutes ?? 10} min/day goal
            </Text>
          </View>
        </View>

        {/* Stat tiles */}
        <View className="mt-3 flex-row gap-3">
          <StatTile icon="🔥" value={child.streak} label="Day streak" color="#ff9600" />
          <StatTile icon="⚡" value={child.xp} label="XP" color="#ffc800" />
        </View>
        <View className="mt-3 flex-row gap-3">
          <StatTile icon="⭐" value={totalStars} label="Stars" color="#ffc800" />
          <StatTile icon="✅" value={mastered} label="Mastered" color="#58cc02" />
          <StatTile icon="🪙" value={child.coins ?? 0} label="Coins" color="#e0a800" />
        </View>

        {/* Plan / progress */}
        <Text className="mb-2 mt-6 px-1 text-base font-extrabold font-display text-ink">
          {child.focusAreas && child.focusAreas.length > 0
            ? "Practice plan"
            : "All sounds"}
        </Text>
        <View className="gap-2.5">
          {plan.map((skill) => {
            const earned = skill.lessons.reduce(
              (n, l) => n + Math.min(3, child.progress[l.id]?.stars ?? 0),
              0,
            );
            const total = skill.lessons.length * 3;
            return (
              <View key={skill.id} className="rounded-4xl bg-white p-3.5">
                <View className="mb-2 flex-row items-center gap-2">
                  <Text className="text-xl">{skill.emoji}</Text>
                  <Text className="flex-1 text-sm font-extrabold font-display text-ink">
                    {skill.title}
                  </Text>
                  <Text className="text-xs font-extrabold font-display text-hare">
                    {earned}/{total}⭐
                  </Text>
                </View>
                <ProgressBar value={total ? earned / total : 0} height={12} />
              </View>
            );
          })}
        </View>

        {/* Plan actions */}
        <View className="mt-5 gap-3">
          <Button
            label="Re-run sound check"
            variant="secondary"
            icon="🎧"
            onPress={() => {
              hapticLight();
              router.push("/screener");
            }}
          />
        </View>

        {/* Profiles */}
        <Text className="mb-2 mt-7 px-1 text-base font-extrabold font-display text-ink">
          Profiles
        </Text>
        <View className="gap-2.5">
          {state.children.map((c) => (
            <ProfileRow
              key={c.id}
              child={c}
              active={c.id === child.id}
              onSelect={() => {
                if (c.id === child.id) return;
                hapticLight();
                setActiveChild(c.id);
              }}
            />
          ))}
          <Pressable
            onPress={() => {
              hapticLight();
              router.push("/welcome");
            }}
            className="flex-row items-center justify-center gap-2 rounded-4xl border-2 border-dashed border-swan bg-white py-3"
          >
            <Text className="text-lg">➕</Text>
            <Text className="text-sm font-extrabold font-display text-wolf">
              Add a child
            </Text>
          </Pressable>
        </View>

        {/* Credit */}
        <View className="mt-8 flex-row items-center justify-center gap-2 px-6">
          <LeoImage speaking={false} mood="idle" size={40} />
          <Text className="flex-1 text-[11px] font-bold font-heading text-hare">
            Sona is a speech & language practice app, designed with a licensed
            speech-language pathologist. It supports practice and is not a
            substitute for professional care.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatTile({
  icon,
  value,
  label,
  color,
}: {
  icon: string;
  value: number;
  label: string;
  color: string;
}) {
  return (
    <View className="flex-1 items-center rounded-4xl bg-white py-3">
      <Text className="text-2xl">{icon}</Text>
      <Text className="mt-1 text-xl font-extrabold font-display" style={{ color }}>
        {value}
      </Text>
      <Text className="text-[10px] font-extrabold font-display uppercase tracking-wider text-hare">
        {label}
      </Text>
    </View>
  );
}

function ProfileRow({
  child,
  active,
  onSelect,
}: {
  child: Child;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <Pressable
      onPress={onSelect}
      className={`flex-row items-center gap-3 rounded-4xl border-2 bg-white px-4 py-3 ${
        active ? "border-feather" : "border-swan"
      }`}
    >
      <View className="h-10 w-10 items-center justify-center rounded-2xl bg-polar">
        <Text className="text-xl">{child.avatar || "🦁"}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-base font-extrabold font-display text-ink">
          {child.name}
        </Text>
        <Text className="text-xs font-bold font-heading text-wolf">
          🔥 {child.streak} · ⚡ {child.xp}
        </Text>
      </View>
      {active ? (
        <View className="h-7 w-7 items-center justify-center rounded-full bg-feather">
          <Text className="text-sm font-extrabold text-white">✓</Text>
        </View>
      ) : (
        <Text className="text-sm font-extrabold font-display text-macaw">Switch</Text>
      )}
    </Pressable>
  );
}

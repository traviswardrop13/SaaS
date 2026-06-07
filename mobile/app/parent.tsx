import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useState, type ReactNode } from "react";
import { Alert } from "react-native";
import {
  useStore,
  visibleSkills,
  weeklySessionCount,
  weeklyGoal,
  type Child,
} from "@/lib/store";
import { findSkill } from "@/lib/lessons";
import { Button, Loading, ProgressBar } from "@/components/ui";
import LeoImage from "@/components/LeoImage";
import { hapticLight } from "@/lib/haptics";
import {
  requestNotifPermission,
  scheduleDailyReminder,
  cancelDailyReminder,
} from "@/lib/notifications";

/**
 * Parent dashboard — the grown-up's view: progress at a glance, the current
 * plan, profile switching, and the controls a parent needs. Read-mostly; the
 * actions route into flows that already exist (screener, onboarding).
 */
export default function Parent() {
  const router = useRouter();
  const { ready, state, activeChild, setActiveChild, setReminders, reset } = useStore();
  const [busy, setBusy] = useState(false);

  function startOver() {
    Alert.alert(
      "Start over?",
      "This clears all profiles and progress and takes you back to the beginning. (Good for trying the onboarding.)",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Start over",
          style: "destructive",
          onPress: () => {
            reset();
            router.replace("/welcome");
          },
        },
      ],
    );
  }

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

  async function toggleReminder() {
    if (busy) return;
    setBusy(true);
    hapticLight();
    try {
      if (child.remindersEnabled) {
        await cancelDailyReminder();
        setReminders(child.id, false);
      } else {
        const ok = await requestNotifPermission();
        if (!ok) {
          Alert.alert(
            "Notifications off",
            "Turn on notifications for Sona in your phone's Settings to get daily reminders.",
          );
          setBusy(false);
          return;
        }
        const hour = 17;
        await scheduleDailyReminder(child.name, hour, 0);
        setReminders(child.id, true);
      }
    } finally {
      setBusy(false);
    }
  }

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
              {child.sessionMinutes ?? 15} min · {child.sessionsPerWeek ?? 3}× a week
            </Text>
          </View>
        </View>

        {/* Stat tiles */}
        <View className="mt-3 flex-row gap-3">
          <StatTile icon="📅" value={weeklySessionCount(child)} label={`of ${weeklyGoal(child)} this week`} color="#58a700" />
          <StatTile icon="⚡" value={child.xp} label="XP" color="#ffc800" />
        </View>
        <View className="mt-3 flex-row gap-3">
          <StatTile icon="⭐" value={totalStars} label="Stars" color="#ffc800" />
          <StatTile icon="✅" value={mastered} label="Mastered" color="#58cc02" />
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
          <Pressable
            onPress={() => {
              hapticLight();
              router.push("/library");
            }}
            className="flex-row items-center gap-3 rounded-4xl border-2 border-swan bg-white px-4 py-3"
          >
            <Text className="text-xl">🎯</Text>
            <View className="flex-1">
              <Text className="text-base font-extrabold font-display text-ink">
                Extra practice
              </Text>
              <Text className="text-xs font-bold font-heading text-wolf">
                Optional games &amp; sound-by-sound activities
              </Text>
            </View>
            <Text className="text-xl text-hare">›</Text>
          </Pressable>
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

        {/* Settings */}
        <Text className="mb-2 mt-7 px-1 text-base font-extrabold font-display text-ink">
          Settings
        </Text>
        <Pressable
          onPress={toggleReminder}
          disabled={busy}
          className="flex-row items-center gap-3 rounded-4xl bg-white px-4 py-3.5"
        >
          <Text className="text-2xl">🔔</Text>
          <View className="flex-1">
            <Text className="text-base font-extrabold font-display text-ink">
              Daily reminder
            </Text>
            <Text className="text-xs font-bold font-heading text-wolf">
              {child.remindersEnabled
                ? "On — a gentle nudge at 5:00 PM"
                : "Off — turn on a daily practice nudge"}
            </Text>
          </View>
          {/* pill toggle */}
          <View
            className="h-7 w-12 justify-center rounded-full px-0.5"
            style={{ backgroundColor: child.remindersEnabled ? "#58cc02" : "#e5e5e5" }}
          >
            <View
              className="h-6 w-6 rounded-full bg-white"
              style={{ alignSelf: child.remindersEnabled ? "flex-end" : "flex-start" }}
            />
          </View>
        </Pressable>

        {/* Start over (also the way to experience onboarding again) */}
        <Pressable
          onPress={startOver}
          className="mt-4 items-center rounded-4xl border-2 border-swan bg-white py-3.5"
        >
          <Text className="text-sm font-extrabold font-display text-cardinal">
            Start over
          </Text>
        </Pressable>

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
  iconNode,
  value,
  label,
  color,
}: {
  icon?: string;
  iconNode?: ReactNode;
  value: number;
  label: string;
  color: string;
}) {
  return (
    <View className="flex-1 items-center rounded-4xl bg-white py-3">
      {iconNode ?? <Text className="text-2xl">{icon}</Text>}
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
          📅 {weeklySessionCount(child)}/{weeklyGoal(child)} sessions this week
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

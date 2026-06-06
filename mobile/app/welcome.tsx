import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  DIAGNOSTIC_CHALLENGES,
  diagnosticToFocus,
  findSkill,
  GOAL_TILES,
  tilesToFocus,
} from "@/lib/lessons";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui";
import Mascot, { ChoiceCard } from "@/components/Mascot";

const AVATARS = ["🦁", "🐸", "🐼", "🦊", "🐨", "🐵", "🦄", "🐙", "🐧", "🦉"];
const DAILY_GOALS = [
  { minutes: 5, label: "5 min / day", subtitle: "Casual" },
  { minutes: 10, label: "10 min / day", subtitle: "Regular" },
  { minutes: 15, label: "15 min / day", subtitle: "Serious" },
  { minutes: 20, label: "20 min / day", subtitle: "Intense" },
];

type Step =
  | "parent"
  | "childName"
  | "childAvatar"
  | "pathChoice"
  | "goalTiles"
  | "diagnostic"
  | "focusReview"
  | "routineIntro"
  | "dailyGoal"
  | "motivation"
  | "reminders"
  | "done";

export default function Welcome() {
  const router = useRouter();
  const { state, setParent, addChild } = useStore();

  // Local-only form state (committed on the "done" step).
  const [parentName, setParentName] = useState(state.parent?.name ?? "");
  const [childName, setChildName] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [path, setPath] = useState<"diagnostic" | "manual" | null>(null);
  const [selectedTiles, setSelectedTiles] = useState<Set<string>>(new Set());
  const [challenges, setChallenges] = useState<Set<string>>(new Set());
  const [focus, setFocus] = useState<Set<string>>(new Set());
  const [dailyGoal, setDailyGoal] = useState(10);
  const [remindersEnabled, setRemindersEnabled] = useState<boolean | null>(
    null,
  );
  const [stepIdx, setStepIdx] = useState(0);

  const hasExistingParent = !!state.parent;

  // Build the step list — branches on whether a parent already exists (so
  // the same flow handles "add another child") and on the path choice
  // (diagnostic vs. tile picker).
  const steps = useMemo<Step[]>(() => {
    const base: Step[] = [];
    if (!hasExistingParent) base.push("parent");
    base.push("childName", "childAvatar", "pathChoice");
    if (path === "diagnostic") base.push("diagnostic");
    else if (path === "manual") base.push("goalTiles");
    base.push(
      "focusReview",
      "routineIntro",
      "dailyGoal",
      "motivation",
      "reminders",
      "done",
    );
    return base;
  }, [hasExistingParent, path]);

  // Keep focus auto-derived from whichever picker the parent used.
  useEffect(() => {
    if (path === "diagnostic") {
      setFocus(new Set(diagnosticToFocus(Array.from(challenges))));
    } else if (path === "manual") {
      setFocus(new Set(tilesToFocus(Array.from(selectedTiles))));
    } else {
      setFocus(new Set());
    }
  }, [challenges, selectedTiles, path]);

  const step = steps[stepIdx] ?? "done";
  const pct = Math.round(((stepIdx + 1) / Math.max(1, steps.length)) * 100);

  function go(delta: number) {
    setStepIdx((i) => Math.min(steps.length - 1, Math.max(0, i + delta)));
  }
  function back() {
    if (stepIdx > 0) go(-1);
    else if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  function toggleIn(set: Set<string>, id: string): Set<string> {
    const n = new Set(set);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  }

  // ─────── per-step CTA wiring ───────

  function canContinue(): boolean {
    switch (step) {
      case "parent":
        return parentName.trim().length > 0;
      case "childName":
        return childName.trim().length > 0;
      case "pathChoice":
        return path != null;
      case "goalTiles":
        return selectedTiles.size > 0;
      case "diagnostic":
        return challenges.size > 0;
      default:
        return true;
    }
  }

  function ctaLabel(): string {
    switch (step) {
      case "dailyGoal":
        return "I'm committed";
      case "reminders":
        return remindersEnabled === false ? "Continue" : "Yes, remind me";
      case "done":
        return `Let's start ${childName || "practicing"}!`;
      default:
        return "Continue";
    }
  }

  async function ctaPress() {
    // Special handling per step.
    if (step === "parent") {
      setParent({ name: parentName.trim(), email: "" });
    }
    if (step === "reminders" && remindersEnabled !== false) {
      // Native notification permission flow is deferred — store the intent
      // and prompt for real later. We mark intent here so the recap shows
      // the right pill.
      setRemindersEnabled(true);
    }
    if (step === "done") {
      finish();
      return;
    }
    go(1);
  }

  function finish() {
    const child = addChild({
      name: childName.trim() || "Friend",
      avatar,
      focusAreas: Array.from(focus),
      dailyGoalMinutes: dailyGoal,
      remindersEnabled: remindersEnabled ?? false,
    });
    router.replace({ pathname: "/home", params: { childId: child.id } });
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-4 pt-2">
        {/* Top bar */}
        <View className="mb-6 flex-row items-center gap-3">
          <Pressable
            onPress={back}
            className="h-9 w-9 items-center justify-center rounded-full bg-gray-100"
            accessibilityLabel="Back"
          >
            <Text className="text-gray-500">←</Text>
          </Pressable>
          <View className="h-3 flex-1 overflow-hidden rounded-full bg-gray-100">
            <View
              className="h-full rounded-full bg-grass-500"
              style={{ width: `${pct}%` }}
            />
          </View>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === "parent" && (
            <ParentStep
              name={parentName}
              onChange={setParentName}
            />
          )}
          {step === "childName" && (
            <ChildNameStep name={childName} onChange={setChildName} />
          )}
          {step === "childAvatar" && (
            <AvatarStep
              childName={childName}
              avatar={avatar}
              onPick={setAvatar}
            />
          )}
          {step === "pathChoice" && (
            <PathStep childName={childName} value={path} onPick={setPath} />
          )}
          {step === "goalTiles" && (
            <GoalTilesStep
              childName={childName}
              selected={selectedTiles}
              onToggle={(id) =>
                setSelectedTiles((prev) => toggleIn(prev, id))
              }
            />
          )}
          {step === "diagnostic" && (
            <DiagnosticStep
              childName={childName}
              selected={challenges}
              onToggle={(id) =>
                setChallenges((prev) => toggleIn(prev, id))
              }
            />
          )}
          {step === "focusReview" && (
            <FocusReviewStep
              childName={childName}
              focus={focus}
              onRemove={(id) =>
                setFocus((prev) => {
                  const n = new Set(prev);
                  n.delete(id);
                  return n;
                })
              }
            />
          )}
          {step === "routineIntro" && (
            <Mascot
              message={`Let's set up ${childName || "their"} learning routine!`}
            />
          )}
          {step === "dailyGoal" && (
            <DailyGoalStep value={dailyGoal} onPick={setDailyGoal} />
          )}
          {step === "motivation" && (
            <MotivationStep childName={childName} dailyGoal={dailyGoal} />
          )}
          {step === "reminders" && (
            <RemindersStep
              childName={childName}
              optedIn={remindersEnabled}
              onSkip={() => setRemindersEnabled(false)}
            />
          )}
          {step === "done" && (
            <DoneStep
              childName={childName}
              dailyGoal={dailyGoal}
              focusCount={focus.size}
              remindersEnabled={remindersEnabled === true}
            />
          )}
        </ScrollView>

        <View className="pb-4 pt-2">
          <Button
            label={ctaLabel()}
            onPress={ctaPress}
            disabled={!canContinue()}
          />
          {step === "reminders" && remindersEnabled !== false ? (
            <Pressable
              onPress={() => {
                setRemindersEnabled(false);
                go(1);
              }}
              className="mt-2 items-center py-2"
            >
              <Text className="font-extrabold font-display uppercase tracking-wide text-gray-400">
                Not now
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

// ───────────────────────── individual step bodies ─────────────────────────

function ParentStep({
  name,
  onChange,
}: {
  name: string;
  onChange: (s: string) => void;
}) {
  return (
    <View>
      <Mascot message="Hi grown-up! What should I call you?" />
      <Text className="mb-1 mt-6 font-extrabold font-display text-gray-700">Your name</Text>
      <TextInput
        value={name}
        onChangeText={onChange}
        placeholder="e.g. Sam"
        className="rounded-2xl border-2 border-gray-200 px-4 py-3 text-lg"
        autoFocus
      />
    </View>
  );
}

function ChildNameStep({
  name,
  onChange,
}: {
  name: string;
  onChange: (s: string) => void;
}) {
  return (
    <View>
      <Mascot message="Who are we practicing with?" />
      <Text className="mb-1 mt-6 font-extrabold font-display text-gray-700">
        Child&apos;s first name
      </Text>
      <TextInput
        value={name}
        onChangeText={onChange}
        placeholder="e.g. Mia"
        className="rounded-2xl border-2 border-gray-200 px-4 py-3 text-lg"
        autoFocus
      />
    </View>
  );
}

function AvatarStep({
  childName,
  avatar,
  onPick,
}: {
  childName: string;
  avatar: string;
  onPick: (a: string) => void;
}) {
  return (
    <View>
      <Mascot message={`Pick a buddy for ${childName || "your child"}!`} />
      <View className="mt-6 flex-row flex-wrap justify-between">
        {AVATARS.map((a) => (
          <Pressable
            key={a}
            onPress={() => onPick(a)}
            className={`mb-3 h-16 w-16 items-center justify-center rounded-2xl ${
              avatar === a
                ? "border-4 border-brand-500 bg-brand-100"
                : "bg-gray-50"
            }`}
          >
            <Text className="text-3xl">{a}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function PathStep({
  childName,
  value,
  onPick,
}: {
  childName: string;
  value: "diagnostic" | "manual" | null;
  onPick: (v: "diagnostic" | "manual") => void;
}) {
  return (
    <View>
      <Mascot message={`Where would you like to start with ${childName}?`} />
      <View className="mt-6">
        <ChoiceCard
          selected={value === "diagnostic"}
          onPress={() => onPick("diagnostic")}
          emoji="🧭"
          title={`Find ${childName || "their"} level`}
          description={`I'll ask a few questions about ${childName || "your child"}'s speech.`}
          recommended
        />
        <ChoiceCard
          selected={value === "manual"}
          onPress={() => onPick("manual")}
          emoji="📚"
          title="I know what to practice"
          description="Pick the sounds and skills myself."
        />
      </View>
    </View>
  );
}

function GoalTilesStep({
  childName,
  selected,
  onToggle,
}: {
  childName: string;
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <View>
      <Mascot
        message={`What does ${childName || "your child"} want to work on?`}
      />
      <View className="mt-6 flex-row flex-wrap justify-between">
        {GOAL_TILES.map((tile) => {
          const on = selected.has(tile.id);
          return (
            <Pressable
              key={tile.id}
              onPress={() => onToggle(tile.id)}
              className={`mb-3 w-[48%] items-center rounded-3xl border-4 p-3 ${
                on
                  ? "border-grass-500 bg-grass-500/10"
                  : "border-gray-100 bg-white"
              }`}
            >
              <Text className="text-4xl">{tile.emoji}</Text>
              <Text className="mt-1 text-center text-sm font-extrabold font-display text-gray-800">
                {tile.title}
              </Text>
              <Text className="text-center text-[11px] text-gray-500">
                {tile.subtitle}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function DiagnosticStep({
  childName,
  selected,
  onToggle,
}: {
  childName: string;
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <View>
      <Mascot
        message={`Which of these sounds like ${childName || "your child"}?`}
      />
      <Text className="mt-3 text-sm text-gray-500">
        Pick all that apply. We&apos;ll build a custom plan from these.
      </Text>
      <View className="mt-4">
        {DIAGNOSTIC_CHALLENGES.map((c) => (
          <ChoiceCard
            key={c.id}
            selected={selected.has(c.id)}
            onPress={() => onToggle(c.id)}
            emoji={c.emoji}
            title={c.label}
            description={c.example}
          />
        ))}
      </View>
    </View>
  );
}

function FocusReviewStep({
  childName,
  focus,
  onRemove,
}: {
  childName: string;
  focus: Set<string>;
  onRemove: (id: string) => void;
}) {
  const ids = Array.from(focus);
  return (
    <View>
      <Mascot
        message={
          focus.size > 0
            ? `Here's ${childName || "their"} starter plan!`
            : "We'll show everything for now."
        }
      />
      {focus.size === 0 ? (
        <Text className="mt-6 text-center text-gray-500">
          No worries — you can pick goals later from the parent dashboard.
        </Text>
      ) : (
        <View className="mt-6">
          {ids.map((id) => {
            const s = findSkill(id);
            if (!s) return null;
            return (
              <View
                key={id}
                className="mb-3 flex-row items-center gap-3 rounded-2xl border-2 border-gray-100 p-3"
              >
                <Text className="text-3xl">{s.emoji}</Text>
                <View className="flex-1">
                  <Text className="text-base font-extrabold font-display text-gray-800">
                    {s.title}
                  </Text>
                  <Text className="text-xs text-gray-500">{s.subtitle}</Text>
                </View>
                <Pressable
                  onPress={() => onRemove(id)}
                  className="rounded-full bg-gray-100 px-3 py-1"
                >
                  <Text className="text-xs font-extrabold font-display text-gray-500">
                    Remove
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function DailyGoalStep({
  value,
  onPick,
}: {
  value: number;
  onPick: (n: number) => void;
}) {
  return (
    <View>
      <Mascot message="What's your daily learning goal?" />
      <View className="mt-6">
        {DAILY_GOALS.map((g) => (
          <ChoiceCard
            key={g.minutes}
            selected={value === g.minutes}
            onPress={() => onPick(g.minutes)}
            title={g.label}
            description={g.subtitle}
            recommended={g.minutes === 10}
          />
        ))}
      </View>
    </View>
  );
}

function MotivationStep({
  childName,
  dailyGoal,
}: {
  childName: string;
  dailyGoal: number;
}) {
  const items: Array<{ emoji: string; title: string; body: string }> = [
    {
      emoji: "🗣️",
      title: "Clearer everyday speech",
      body: "Targeted practice on the exact sounds that need work.",
    },
    {
      emoji: "💪",
      title: "Confidence to speak up",
      body: "Short, fun wins so practice never feels like a chore.",
    },
    {
      emoji: "📅",
      title: "A daily speech habit",
      body: `Just ${dailyGoal} minutes a day keeps the streak alive.`,
    },
  ];
  return (
    <View>
      <Mascot message={`Here's what ${childName || "your child"} can build!`} />
      <View className="mt-6">
        {items.map((it) => (
          <View
            key={it.title}
            className="mb-3 flex-row items-start gap-3 rounded-2xl border-2 border-gray-100 p-4"
          >
            <Text className="text-3xl">{it.emoji}</Text>
            <View className="flex-1">
              <Text className="text-base font-extrabold font-display text-gray-800">
                {it.title}
              </Text>
              <Text className="text-sm text-gray-600">{it.body}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function RemindersStep({
  childName,
}: {
  childName: string;
  optedIn: boolean | null;
  onSkip: () => void;
}) {
  return (
    <View>
      <Mascot
        message={`I'll remind ${childName || "you"} to practice — so it becomes a habit!`}
      />
      <View className="mt-6 items-center rounded-3xl border-2 border-gray-100 p-6">
        <Text className="text-6xl">🔔</Text>
        <Text className="mt-3 text-2xl font-extrabold font-display text-gray-800">
          Daily reminder
        </Text>
        <Text className="mt-2 text-center text-gray-500">
          One gentle nudge a day. You can turn it off anytime.
        </Text>
      </View>
    </View>
  );
}

function DoneStep({
  childName,
  dailyGoal,
  focusCount,
  remindersEnabled,
}: {
  childName: string;
  dailyGoal: number;
  focusCount: number;
  remindersEnabled: boolean;
}) {
  return (
    <View className="items-center pt-6">
      <Text className="text-7xl">🎉</Text>
      <Text className="mt-4 text-4xl font-extrabold font-display text-brand-600">
        All set!
      </Text>
      <Text className="mt-3 text-center text-base text-gray-600">
        {childName || "Your child"} is ready to roar. Tap below to open their
        map and start the first lesson.
      </Text>
      <View className="mt-6 flex-row flex-wrap justify-center gap-2">
        <RecapPill text={`${dailyGoal} min/day`} />
        <RecapPill
          text={
            focusCount > 0
              ? `${focusCount} goal${focusCount === 1 ? "" : "s"} picked`
              : "All goals available"
          }
        />
        {remindersEnabled ? <RecapPill text="🔔 Reminders on" /> : null}
      </View>
    </View>
  );
}

function RecapPill({ text }: { text: string }) {
  return (
    <View className="rounded-full border-2 border-gray-100 bg-white px-3 py-1">
      <Text className="font-extrabold font-display text-gray-700">{text}</Text>
    </View>
  );
}

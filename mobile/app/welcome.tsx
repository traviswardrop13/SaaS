import { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useStore } from "@/lib/store";
import {
  GOALS,
  goalsWantScreener,
  SESSIONS_PER_WEEK,
  SESSION_MINUTES,
  RECOMMENDED_PER_WEEK,
  RECOMMENDED_MINUTES,
} from "@/lib/goals";
import { Button, ProgressBar } from "@/components/ui";
import { hapticLight } from "@/lib/haptics";

/**
 * Session-first onboarding. Short and simple: parent → child + age → goals →
 * coach → schedule → free first session. Practice-safe language throughout
 * (no "therapy"/"diagnosis" claims). Ends by dropping the family straight
 * into their free session — the magic moment.
 */
type Step = "parent" | "child" | "goals" | "coach" | "schedule" | "done";

const AGES = [3, 4, 5, 6, 7, 8, 9];

export default function Welcome() {
  const router = useRouter();
  const { state, setParent, addChild } = useStore();

  const [parentName, setParentName] = useState(state.parent?.name ?? "");
  const [childName, setChildName] = useState("");
  const [age, setAge] = useState<number | null>(null);
  const [goals, setGoals] = useState<Set<string>>(new Set());
  const [coach, setCoach] = useState<"animated" | "realistic" | null>(null);
  const [perWeek, setPerWeek] = useState<number>(RECOMMENDED_PER_WEEK);
  const [minutes, setMinutes] = useState<number>(RECOMMENDED_MINUTES);
  const [stepIdx, setStepIdx] = useState(0);

  const hasParent = !!state.parent;
  const steps = useMemo<Step[]>(() => {
    const s: Step[] = [];
    if (!hasParent) s.push("parent");
    s.push("child", "goals", "coach", "schedule", "done");
    return s;
  }, [hasParent]);

  const step = steps[stepIdx] ?? "done";
  const pct = (stepIdx + 1) / steps.length;

  // Suggest a coach style from age (younger → animated buddy).
  const suggested: "animated" | "realistic" = (age ?? 5) <= 6 ? "animated" : "realistic";

  function go(d: number) {
    setStepIdx((i) => Math.min(steps.length - 1, Math.max(0, i + d)));
  }
  function back() {
    if (stepIdx > 0) go(-1);
    else if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  function canContinue(): boolean {
    switch (step) {
      case "parent":
        return parentName.trim().length > 0;
      case "child":
        return childName.trim().length > 0 && age != null;
      case "goals":
        return goals.size > 0;
      case "coach":
        return coach != null;
      default:
        return true;
    }
  }

  function toggleGoal(id: string) {
    hapticLight();
    setGoals((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function next() {
    hapticLight();
    if (step === "parent" && parentName.trim()) {
      setParent({ name: parentName.trim(), email: "" });
    }
    if (step === "done") {
      finish();
      return;
    }
    // entering coach step with nothing picked → preselect the suggestion
    if (steps[stepIdx + 1] === "coach" && coach == null) setCoach(suggested);
    go(1);
  }

  function finish() {
    const goalIds = Array.from(goals);
    addChild({
      name: childName.trim() || "Friend",
      avatar: "🌟",
      age: age ?? undefined,
      goals: goalIds,
      coachStyle: coach ?? suggested,
      sessionsPerWeek: perWeek,
      sessionMinutes: minutes,
      focusAreas: [],
    });
    // Speech/unsure goals → personalize with the sound check first; otherwise
    // drop straight into the free session.
    if (goalsWantScreener(goalIds)) {
      router.replace("/screener");
    } else {
      router.replace("/session");
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-5 pt-2">
        {/* Top bar */}
        <View className="mb-6 flex-row items-center gap-3">
          <Pressable
            onPress={back}
            className="h-9 w-9 items-center justify-center rounded-full bg-polar"
          >
            <Text className="text-lg font-extrabold font-display text-hare">←</Text>
          </Pressable>
          <ProgressBar value={pct} />
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === "parent" && (
            <Field
              title="Hi! Who's setting this up?"
              label="Your name"
              value={parentName}
              onChange={setParentName}
              placeholder="e.g. Sam"
            />
          )}

          {step === "child" && (
            <View>
              <H title="Who are we practicing with?" />
              <Text className="mb-1 mt-5 font-extrabold font-display text-ink">
                Child&apos;s first name
              </Text>
              <TextInput
                value={childName}
                onChangeText={setChildName}
                placeholder="e.g. Mia"
                className="rounded-2xl border-2 border-swan px-4 py-3 text-lg"
                autoFocus
              />
              <Text className="mb-2 mt-6 font-extrabold font-display text-ink">
                How old?
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {AGES.map((a) => (
                  <Pressable
                    key={a}
                    onPress={() => {
                      hapticLight();
                      setAge(a);
                    }}
                    className={`h-12 w-12 items-center justify-center rounded-2xl border-2 ${
                      age === a ? "border-macaw bg-macaw-50" : "border-swan bg-white"
                    }`}
                  >
                    <Text
                      className={`text-lg font-extrabold font-display ${
                        age === a ? "text-macaw" : "text-ink"
                      }`}
                    >
                      {a}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {step === "goals" && (
            <View>
              <H
                title={`What should we work on with ${childName || "your child"}?`}
                sub="Pick all that apply."
              />
              <View className="mt-5 gap-3">
                {GOALS.map((g) => {
                  const on = goals.has(g.id);
                  return (
                    <Pressable
                      key={g.id}
                      onPress={() => toggleGoal(g.id)}
                      className={`flex-row items-center gap-3 rounded-4xl border-2 px-4 py-3.5 ${
                        on ? "border-feather bg-feather-50" : "border-swan bg-white"
                      }`}
                    >
                      <Text className="text-2xl">{g.emoji}</Text>
                      <Text className="flex-1 text-base font-extrabold font-display text-ink">
                        {g.label}
                      </Text>
                      <View
                        className={`h-7 w-7 items-center justify-center rounded-full ${
                          on ? "bg-feather" : "bg-swan"
                        }`}
                      >
                        {on ? (
                          <Text className="text-sm font-extrabold text-white">✓</Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {step === "coach" && (
            <View>
              <H
                title="Choose your coach"
                sub="You can change this later."
              />
              <View className="mt-5 gap-3">
                <CoachCard
                  emoji="🦁"
                  title="Animated buddy"
                  desc="A friendly character — great for younger kids."
                  recommended={suggested === "animated"}
                  selected={coach === "animated"}
                  onPress={() => {
                    hapticLight();
                    setCoach("animated");
                  }}
                />
                <CoachCard
                  emoji="🧑‍🏫"
                  title="Realistic coach"
                  desc="A lifelike on-screen coach — best for older kids."
                  recommended={suggested === "realistic"}
                  selected={coach === "realistic"}
                  onPress={() => {
                    hapticLight();
                    setCoach("realistic");
                  }}
                />
              </View>
            </View>
          )}

          {step === "schedule" && (
            <View>
              <H
                title="How often?"
                sub="Short and consistent beats long and rare. 3 a week is the sweet spot."
              />
              <Text className="mb-2 mt-6 font-extrabold font-display text-ink">
                Sessions per week
              </Text>
              <View className="flex-row gap-2">
                {SESSIONS_PER_WEEK.map((n) => (
                  <Chip
                    key={n}
                    label={`${n}`}
                    sub={n === RECOMMENDED_PER_WEEK ? "best" : undefined}
                    selected={perWeek === n}
                    onPress={() => {
                      hapticLight();
                      setPerWeek(n);
                    }}
                  />
                ))}
              </View>
              <Text className="mb-2 mt-6 font-extrabold font-display text-ink">
                Session length
              </Text>
              <View className="flex-row gap-2">
                {SESSION_MINUTES.map((m) => (
                  <Chip
                    key={m}
                    label={`${m} min`}
                    sub={m === RECOMMENDED_MINUTES ? "best" : undefined}
                    selected={minutes === m}
                    onPress={() => {
                      hapticLight();
                      setMinutes(m);
                    }}
                  />
                ))}
              </View>
            </View>
          )}

          {step === "done" && (
            <View className="items-center pt-6">
              <Text className="text-7xl">🎉</Text>
              <Text className="mt-4 text-center text-3xl font-extrabold font-display text-brand-600">
                {childName || "Your child"} is all set!
              </Text>
              <Text className="mt-3 text-center text-base font-bold font-heading text-wolf">
                {perWeek} sessions a week · {minutes} min each. The first one&apos;s
                on us — free.
              </Text>
              <Text className="mt-6 text-center text-xs font-bold font-heading text-hare">
                Sona is speech &amp; language practice designed with a licensed
                speech-language pathologist. It supports practice and is not a
                substitute for professional care.
              </Text>
            </View>
          )}
        </ScrollView>

        <View className="pb-4 pt-2">
          <Button
            label={step === "done" ? "Start free session" : "Continue"}
            onPress={next}
            disabled={!canContinue()}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function H({ title, sub }: { title: string; sub?: string }) {
  return (
    <View>
      <Text className="text-2xl font-extrabold font-display text-ink">{title}</Text>
      {sub ? (
        <Text className="mt-1 text-sm font-bold font-heading text-wolf">{sub}</Text>
      ) : null}
    </View>
  );
}

function Field({
  title,
  label,
  value,
  onChange,
  placeholder,
}: {
  title: string;
  label: string;
  value: string;
  onChange: (s: string) => void;
  placeholder: string;
}) {
  return (
    <View>
      <H title={title} />
      <Text className="mb-1 mt-5 font-extrabold font-display text-ink">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        className="rounded-2xl border-2 border-swan px-4 py-3 text-lg"
        autoFocus
      />
    </View>
  );
}

function CoachCard({
  emoji,
  title,
  desc,
  recommended,
  selected,
  onPress,
}: {
  emoji: string;
  title: string;
  desc: string;
  recommended?: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-3 rounded-4xl border-2 px-4 py-4 ${
        selected ? "border-macaw bg-macaw-50" : "border-swan bg-white"
      }`}
    >
      <View className="h-14 w-14 items-center justify-center rounded-3xl bg-polar">
        <Text className="text-3xl">{emoji}</Text>
      </View>
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-base font-extrabold font-display text-ink">{title}</Text>
          {recommended ? (
            <Text className="rounded-full bg-feather px-2 py-0.5 text-[10px] font-extrabold font-display uppercase tracking-wide text-white">
              Suggested
            </Text>
          ) : null}
        </View>
        <Text className="mt-0.5 text-xs font-bold font-heading text-wolf">{desc}</Text>
      </View>
      <View
        className={`h-6 w-6 items-center justify-center rounded-full ${
          selected ? "bg-macaw" : "bg-swan"
        }`}
      >
        {selected ? <Text className="text-xs font-extrabold text-white">✓</Text> : null}
      </View>
    </Pressable>
  );
}

function Chip({
  label,
  sub,
  selected,
  onPress,
}: {
  label: string;
  sub?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 items-center rounded-2xl border-2 py-3 ${
        selected ? "border-macaw bg-macaw-50" : "border-swan bg-white"
      }`}
    >
      <Text
        className={`text-lg font-extrabold font-display ${
          selected ? "text-macaw" : "text-ink"
        }`}
      >
        {label}
      </Text>
      {sub ? (
        <Text className="text-[10px] font-extrabold font-display uppercase tracking-wide text-feather-edge">
          {sub}
        </Text>
      ) : null}
    </Pressable>
  );
}

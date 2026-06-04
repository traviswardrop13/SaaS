import { useState } from "react";
import { useRouter } from "expo-router";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GOAL_TILES, tilesToFocus } from "@/lib/lessons";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui";

const AVATARS = ["🦁", "🐸", "🐼", "🦊", "🐨", "🐵", "🦄", "🐙", "🐧", "🦉"];
const DAILY_GOALS = [
  { minutes: 5, label: "5 min / day", subtitle: "Casual" },
  { minutes: 10, label: "10 min / day", subtitle: "Regular" },
  { minutes: 15, label: "15 min / day", subtitle: "Serious" },
  { minutes: 20, label: "20 min / day", subtitle: "Intense" },
];

type Step = "parent" | "childName" | "avatar" | "goals" | "daily";
const ORDER: Step[] = ["parent", "childName", "avatar", "goals", "daily"];

export default function Welcome() {
  const router = useRouter();
  const { state, setParent, addChild } = useStore();

  const [stepIdx, setStepIdx] = useState(state.parent ? 1 : 0);
  const [parentName, setParentName] = useState(state.parent?.name ?? "");
  const [childName, setChildName] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [tiles, setTiles] = useState<Set<string>>(new Set());
  const [daily, setDaily] = useState(10);

  const step = ORDER[stepIdx];
  const pct = Math.round(((stepIdx + 1) / ORDER.length) * 100);

  function next() {
    if (step === "parent" && parentName.trim()) {
      setParent({ name: parentName.trim(), email: "" });
    }
    if (stepIdx < ORDER.length - 1) {
      setStepIdx((i) => i + 1);
    } else {
      finish();
    }
  }
  function back() {
    if (stepIdx > 0) setStepIdx((i) => i - 1);
    else router.back();
  }
  function finish() {
    const child = addChild({
      name: childName.trim() || "Friend",
      avatar,
      focusAreas: tilesToFocus(Array.from(tiles)),
      dailyGoalMinutes: daily,
    });
    router.replace({ pathname: "/home", params: { childId: child.id } });
  }

  const canContinue =
    step === "parent"
      ? parentName.trim().length > 0
      : step === "childName"
        ? childName.trim().length > 0
        : step === "goals"
          ? tiles.size > 0
          : true;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-4 pt-2">
        {/* Progress */}
        <View className="mb-6 flex-row items-center gap-3">
          <Pressable
            onPress={back}
            className="h-9 w-9 items-center justify-center rounded-full bg-gray-100"
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

        <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
          {step === "parent" && (
            <Bubble text="Hi grown-up! What should I call you?">
              <TextInput
                value={parentName}
                onChangeText={setParentName}
                placeholder="e.g. Sam"
                className="mt-6 rounded-2xl border-2 border-gray-200 px-4 py-3 text-lg"
                autoFocus
              />
            </Bubble>
          )}

          {step === "childName" && (
            <Bubble text="Who are we practicing with?">
              <TextInput
                value={childName}
                onChangeText={setChildName}
                placeholder="Child's first name"
                className="mt-6 rounded-2xl border-2 border-gray-200 px-4 py-3 text-lg"
                autoFocus
              />
            </Bubble>
          )}

          {step === "avatar" && (
            <Bubble text={`Pick a buddy for ${childName || "your child"}!`}>
              <View className="mt-6 flex-row flex-wrap justify-between">
                {AVATARS.map((a) => (
                  <Pressable
                    key={a}
                    onPress={() => setAvatar(a)}
                    className={`mb-3 h-16 w-16 items-center justify-center rounded-2xl ${
                      avatar === a
                        ? "bg-brand-100 border-4 border-brand-500"
                        : "bg-gray-50"
                    }`}
                  >
                    <Text className="text-3xl">{a}</Text>
                  </Pressable>
                ))}
              </View>
            </Bubble>
          )}

          {step === "goals" && (
            <Bubble text={`What does ${childName || "your child"} want to work on?`}>
              <View className="mt-6 flex-row flex-wrap justify-between">
                {GOAL_TILES.map((tile) => {
                  const on = tiles.has(tile.id);
                  return (
                    <Pressable
                      key={tile.id}
                      onPress={() =>
                        setTiles((prev) => {
                          const n = new Set(prev);
                          if (n.has(tile.id)) n.delete(tile.id);
                          else n.add(tile.id);
                          return n;
                        })
                      }
                      className={`mb-3 w-[48%] items-center rounded-3xl border-4 p-3 ${
                        on
                          ? "border-grass-500 bg-grass-500/10"
                          : "border-gray-100 bg-white"
                      }`}
                    >
                      <Text className="text-4xl">{tile.emoji}</Text>
                      <Text className="mt-1 text-center text-sm font-extrabold text-gray-800">
                        {tile.title}
                      </Text>
                      <Text className="text-center text-[11px] text-gray-500">
                        {tile.subtitle}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Bubble>
          )}

          {step === "daily" && (
            <Bubble text="What's your daily goal?">
              <View className="mt-6">
                {DAILY_GOALS.map((g) => {
                  const on = daily === g.minutes;
                  return (
                    <Pressable
                      key={g.minutes}
                      onPress={() => setDaily(g.minutes)}
                      className={`mb-3 flex-row items-center justify-between rounded-3xl border-4 p-4 ${
                        on
                          ? "border-grass-500 bg-grass-500/10"
                          : "border-gray-100 bg-white"
                      }`}
                    >
                      <Text className="text-lg font-extrabold text-gray-800">
                        {g.label}
                      </Text>
                      <Text className="text-sm text-gray-500">{g.subtitle}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Bubble>
          )}
        </ScrollView>

        <View className="pb-4 pt-2">
          <Button
            label={step === "daily" ? "I'm committed" : "Continue"}
            onPress={next}
            disabled={!canContinue}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function Bubble({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <View>
      <View className="flex-row items-end gap-2">
        <Text className="text-6xl">🦁</Text>
        <View className="flex-1 rounded-3xl rounded-bl-md border-2 border-gray-100 bg-white px-4 py-3">
          <Text className="text-lg font-extrabold text-gray-800">{text}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

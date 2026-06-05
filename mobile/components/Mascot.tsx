import React, { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import TalkingFace from "./TalkingFace";

/**
 * Friendly mascot with a chat-bubble caption. The lion does a gentle idle
 * bounce so the onboarding screens feel alive. Used across the native
 * onboarding to mirror the web "Mascot" component.
 */
export default function Mascot({
  message,
  align = "left",
}: {
  message?: string;
  align?: "left" | "center";
}) {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setOffset((v) => (v === 0 ? -4 : 0));
    }, 1100);
    return () => clearInterval(id);
  }, []);
  return (
    <View
      className={`w-full flex-row items-end gap-2 ${
        align === "center" ? "justify-center" : "justify-start"
      }`}
    >
      <View style={{ transform: [{ translateY: offset }] }}>
        <TalkingFace speaking={false} size={72} />
      </View>
      {message ? (
        <View className="max-w-[260px] flex-1 rounded-3xl rounded-bl-md border-2 border-gray-100 bg-white px-4 py-3">
          <Text className="text-lg font-extrabold text-gray-800">
            {message}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** Full-width selectable card — mirrors web's ChoiceCard. */
export function ChoiceCard({
  selected,
  onPress,
  emoji,
  title,
  description,
  recommended,
}: {
  selected: boolean;
  onPress: () => void;
  emoji?: string;
  title: string;
  description?: string;
  recommended?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`mb-3 flex-row items-center gap-3 rounded-3xl border-4 p-4 ${
        selected
          ? "border-grass-500 bg-grass-500/10"
          : "border-gray-100 bg-white"
      }`}
    >
      {emoji ? <Text className="text-4xl">{emoji}</Text> : null}
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-lg font-extrabold text-gray-800">{title}</Text>
          {recommended ? (
            <View className="rounded-full bg-sky-500 px-2 py-0.5">
              <Text className="text-[10px] font-extrabold uppercase tracking-wider text-white">
                Recommended
              </Text>
            </View>
          ) : null}
        </View>
        {description ? (
          <Text className="text-sm text-gray-500">{description}</Text>
        ) : null}
      </View>
      {selected ? (
        <View className="h-6 w-6 items-center justify-center rounded-full bg-grass-500">
          <Text className="text-xs font-bold text-white">✓</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

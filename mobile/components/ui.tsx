import React from "react";
import { Pressable, Text, View, ActivityIndicator } from "react-native";

/** Chunky Duolingo-style primary button. */
export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "warn";
  disabled?: boolean;
}) {
  const bg =
    disabled
      ? "bg-gray-300"
      : variant === "primary"
        ? "bg-grass-500"
        : variant === "secondary"
          ? "bg-sky-500"
          : variant === "warn"
            ? "bg-brand-500"
            : "bg-white border-2 border-gray-200";
  const fg =
    variant === "ghost" ? "text-gray-700" : disabled ? "text-gray-500" : "text-white";
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      className={`w-full items-center rounded-2xl py-4 ${bg}`}
      style={({ pressed }) => ({
        transform: [{ translateY: pressed && !disabled ? 2 : 0 }],
      })}
    >
      <Text className={`text-base font-extrabold uppercase tracking-wide ${fg}`}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Loading() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator size="large" color="#f97316" />
    </View>
  );
}

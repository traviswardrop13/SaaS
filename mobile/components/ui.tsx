import React from "react";
import { Pressable, Text, View, ActivityIndicator } from "react-native";

/**
 * Sona's design system — chunky, rounded, Duolingo-flavored primitives.
 *
 * The signature element is the 3D button: a colored "face" sitting on a
 * darker "edge". At rest the edge peeks out the bottom; on press the face
 * drops down onto the edge so it feels physically clickable.
 */

type Variant = "primary" | "secondary" | "ghost" | "warn" | "danger";

const VARIANTS: Record<
  Exclude<Variant, "ghost">,
  { face: string; edge: string; text: string }
> = {
  primary: { face: "#58cc02", edge: "#58a700", text: "#ffffff" },
  secondary: { face: "#1cb0f6", edge: "#1899d6", text: "#ffffff" },
  warn: { face: "#ff9600", edge: "#e08600", text: "#ffffff" },
  danger: { face: "#ff4b4b", edge: "#e63232", text: "#ffffff" },
};

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  icon,
  size = "lg",
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  icon?: string;
  size?: "lg" | "md";
}) {
  const pad = size === "lg" ? 17 : 13;
  const radius = 22;

  // Ghost = flat outlined button (used for secondary "Try again" actions).
  if (variant === "ghost") {
    return (
      <Pressable
        onPress={disabled ? undefined : onPress}
        style={({ pressed }) => ({
          opacity: disabled ? 0.5 : 1,
          transform: [{ translateY: pressed ? 1 : 0 }],
          borderRadius: radius,
        })}
        className="w-full items-center border-2 border-swan bg-white"
      >
        <View style={{ paddingVertical: pad }} className="flex-row items-center gap-2">
          {icon ? <Text className="text-lg">{icon}</Text> : null}
          <Text className="text-lg font-extrabold font-display text-wolf">
            {label}
          </Text>
        </View>
      </Pressable>
    );
  }

  const v = disabled
    ? { face: "#e5e5e5", edge: "#cfcfcf", text: "#afafaf" }
    : VARIANTS[variant];

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={{ width: "100%" }}
    >
      {({ pressed }) => (
        <View style={{ backgroundColor: v.edge, borderRadius: radius }}>
          <View
            className="w-full flex-row items-center justify-center gap-2"
            style={{
              backgroundColor: v.face,
              borderRadius: radius,
              paddingVertical: pad,
              transform: [{ translateY: pressed ? 5 : 0 }],
              marginBottom: pressed ? 0 : 5,
            }}
          >
            {icon ? <Text className="text-lg">{icon}</Text> : null}
            <Text
              style={{ color: v.text }}
              className="text-lg font-extrabold font-display"
            >
              {label}
            </Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

/** Chunky rounded progress bar with an inner highlight. value: 0..1 */
export function ProgressBar({
  value,
  color = "#58cc02",
  height = 16,
}: {
  value: number;
  color?: string;
  height?: number;
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View
      className="flex-1 overflow-hidden rounded-full bg-swan"
      style={{ height }}
    >
      <View
        style={{ width: `${pct}%`, backgroundColor: color, height }}
        className="rounded-full"
      >
        {/* glossy highlight */}
        {pct > 6 ? (
          <View
            className="rounded-full bg-white/40"
            style={{ height: Math.max(2, height * 0.22), marginHorizontal: 6, marginTop: 4 }}
          />
        ) : null}
      </View>
    </View>
  );
}

/** Small rounded stat/label pill, e.g. "120 XP" or "5 🔥". */
export function Pill({
  children,
  color = "#fff7ed",
  text = "#ea580c",
}: {
  children: React.ReactNode;
  color?: string;
  text?: string;
}) {
  return (
    <View
      className="flex-row items-center gap-1 rounded-full px-3 py-1"
      style={{ backgroundColor: color }}
    >
      <Text className="text-sm font-extrabold font-display" style={{ color: text }}>
        {children}
      </Text>
    </View>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <View
      className={`rounded-4xl bg-white p-4 ${className}`}
      style={CARD_SHADOW}
    >
      {children}
    </View>
  );
}

/** Soft drop shadow used on chunky, ABC-style cards (replaces hard borders). */
export const CARD_SHADOW = {
  shadowColor: "#3c3c3c",
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
} as const;

export function Loading() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator size="large" color="#58cc02" />
    </View>
  );
}

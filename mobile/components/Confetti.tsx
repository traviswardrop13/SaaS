import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";

/**
 * A lightweight celebratory burst. Bump `fireKey` (any changing number) to set
 * off a spray of coins/sparkles from the center of whatever container it's in.
 * Uses the core Animated API (no Reanimated/babel plugin needed) so it's safe
 * everywhere.
 */
const EMOJI = ["✨", "🪙", "⭐", "🎉", "💫"];

export default function Confetti({ fireKey }: { fireKey: number }) {
  const t = useRef(new Animated.Value(0)).current;
  const [pieces] = useState(() =>
    Array.from({ length: 18 }).map((_, i) => ({
      angle: (i / 18) * Math.PI * 2 + Math.random() * 0.4,
      dist: 70 + Math.random() * 90,
      emoji: EMOJI[i % EMOJI.length],
    })),
  );

  useEffect(() => {
    if (!fireKey) return;
    t.setValue(0);
    Animated.timing(t, {
      toValue: 1,
      duration: 950,
      useNativeDriver: true,
    }).start();
  }, [fireKey, t]);

  if (!fireKey) return null;

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}
    >
      {pieces.map((p, i) => {
        const translateX = t.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.cos(p.angle) * p.dist],
        });
        const translateY = t.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.sin(p.angle) * p.dist - 50],
        });
        const opacity = t.interpolate({
          inputRange: [0, 0.7, 1],
          outputRange: [1, 1, 0],
        });
        const scale = t.interpolate({
          inputRange: [0, 0.3, 1],
          outputRange: [0.3, 1.2, 0.9],
        });
        return (
          <Animated.Text
            key={i}
            style={{
              position: "absolute",
              fontSize: 22,
              opacity,
              transform: [{ translateX }, { translateY }, { scale }],
            }}
          >
            {p.emoji}
          </Animated.Text>
        );
      })}
    </View>
  );
}

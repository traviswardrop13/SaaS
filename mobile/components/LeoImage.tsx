import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from "react-native";

/**
 * Leo, rendered from the real illustrated art (Nano Banana / Gemini). Drop-in
 * replacement for the old SVG <TalkingFace>: same props (`speaking`, `mood`,
 * `size`), so screens swap over with no other changes.
 *
 * - `speaking` cross-fades between the talking-open and talking-closed poses
 *   so his mouth moves in time with TTS.
 * - `mood` accepts the legacy TalkingFace moods (neutral/happy/celebrate/
 *   encourage/sad) AND the real pose names, so callers can ask for a specific
 *   pose (e.g. "holding-star" on a 3-star win) when they want one.
 * - When idle (not speaking, neutral/happy mood) Leo does a gentle breathing
 *   bob so he reads as alive rather than a static sticker.
 */
export type LeoPose =
  | "idle"
  | "talking-open"
  | "talking-closed"
  | "listening"
  | "celebrate"
  | "encourage"
  | "cheer-again"
  | "holding-star"
  | "sleeping"
  | "hero";

// Legacy <TalkingFace> moods so existing callers keep working unchanged.
export type LeoMood =
  | "neutral"
  | "happy"
  | "celebrate"
  | "encourage"
  | "sad"
  | LeoPose;

const POSES: Record<LeoPose, ImageSourcePropType> = {
  idle: require("../assets/leo/idle.png"),
  "talking-open": require("../assets/leo/talking-open.png"),
  "talking-closed": require("../assets/leo/talking-closed.png"),
  listening: require("../assets/leo/listening.png"),
  celebrate: require("../assets/leo/celebrate.png"),
  encourage: require("../assets/leo/encourage.png"),
  "cheer-again": require("../assets/leo/cheer-again.png"),
  "holding-star": require("../assets/leo/holding-star.png"),
  sleeping: require("../assets/leo/sleeping.png"),
  hero: require("../assets/leo/hero.png"),
};

const MOOD_TO_POSE: Record<string, LeoPose> = {
  neutral: "idle",
  happy: "idle",
  celebrate: "celebrate",
  encourage: "encourage",
  // No sad pose by design — a friendly wave is kinder for "try again" than a
  // frowning mascot.
  sad: "cheer-again",
};

function resolvePose(mood?: LeoMood): LeoPose {
  if (!mood) return "idle";
  if (mood in POSES) return mood as LeoPose;
  return MOOD_TO_POSE[mood] ?? "idle";
}

export default function LeoImage({
  speaking = false,
  mood,
  size = 120,
  style,
}: {
  speaking?: boolean;
  mood?: LeoMood;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [openMouth, setOpenMouth] = useState(true);
  const bob = useRef(new Animated.Value(0)).current;

  // Mouth flap while talking.
  useEffect(() => {
    if (!speaking) return;
    setOpenMouth(true);
    const id = setInterval(() => setOpenMouth((o) => !o), 180);
    return () => clearInterval(id);
  }, [speaking]);

  const pose = resolvePose(mood);
  const isIdleLike = !speaking && (pose === "idle" || pose === "listening");

  // Gentle breathing bob when idle so he feels alive.
  useEffect(() => {
    if (!isIdleLike) {
      bob.stopAnimation();
      bob.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: 1400,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isIdleLike, bob]);

  const source = speaking
    ? POSES[openMouth ? "talking-open" : "talking-closed"]
    : POSES[pose];

  const translateY = bob.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -size * 0.03],
  });

  return (
    <Animated.View style={[{ transform: [{ translateY }] }, style]}>
      <Image
        source={source}
        style={{ width: size, height: size }}
        resizeMode="contain"
        // Poses already share framing; fadeDuration 0 avoids a flash on the
        // talking flap (Android).
        fadeDuration={0}
      />
    </Animated.View>
  );
}

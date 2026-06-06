import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import Svg, { Path, Circle, Ellipse, Rect, G } from "react-native-svg";
import type { TargetSound } from "@/lib/scoring";

/**
 * Sagittal (side-view) mouth cross-section — the standard SLP teaching
 * visual. Tongue shape, lip state, and airflow change per target sound so
 * the child sees *where the tongue goes* and *where the air comes out*.
 * Ported from the web SVG to react-native-svg; same path data.
 */

const TONGUE_PATHS: Record<TargetSound, string> = {
  S: "M 78 195 Q 100 178 130 174 Q 155 174 160 168 Q 162 175 158 184 L 158 198 L 90 198 Z",
  R: "M 78 198 Q 100 186 122 174 Q 140 176 150 188 L 158 200 L 90 200 Z",
  L: "M 78 195 Q 105 176 145 168 Q 158 168 162 178 L 162 198 L 90 198 Z",
  SH: "M 78 196 Q 100 186 130 184 Q 152 188 162 196 L 90 200 Z",
  TH: "M 78 192 Q 105 178 145 178 Q 165 184 175 192 L 90 200 Z",
  CH: "M 78 195 Q 105 180 135 180 Q 155 184 162 192 L 90 200 Z",
  K: "M 78 200 Q 95 196 115 190 Q 140 178 158 168 Q 165 174 162 184 L 162 200 L 90 202 Z",
  G: "M 78 200 Q 95 196 115 190 Q 140 178 158 168 Q 165 174 162 184 L 162 200 L 90 202 Z",
  F: "M 78 200 Q 105 196 140 198 Q 158 200 162 202 L 90 204 Z",
  P: "M 78 200 Q 105 196 140 198 Q 158 200 162 202 L 90 204 Z",
  T: "M 78 195 Q 100 184 140 178 Q 158 180 162 188 L 162 200 L 90 200 Z",
  M: "M 78 200 Q 105 196 140 198 Q 158 200 162 202 L 90 204 Z",
  N: "M 78 195 Q 100 184 140 178 Q 158 180 162 188 L 162 200 L 90 200 Z",
};

const HINTS: Partial<Record<TargetSound, string>> = {
  S: "Tongue tip up behind your top teeth. Air whistles out the front.",
  R: "Pull your tongue back and bunch it up high inside.",
  L: "Tongue tip up — touch the bumpy spot behind your top teeth.",
  SH: "Tongue pulled back, lips rounded forward — like a fish.",
  TH: "Stick your tongue tip between your teeth — barely poking out.",
  CH: "Tongue tip behind top teeth, then pop and release — choo choo!",
  K: "Back of your tongue lifts up to the back roof of your mouth.",
  G: "Like K, but turn your voice on.",
  F: "Top teeth on your bottom lip — then blow softly.",
  P: "Lips closed, then pop them open with a puff of air.",
  T: "Tongue tip behind your top teeth — tap and release.",
  M: "Lips closed — humming sound through your nose.",
  N: "Tongue tip up — humming sound through your nose.",
};

function lipState(
  sound: TargetSound,
): "closed" | "rounded" | "labiodental" | "open" {
  if (sound === "P" || sound === "M") return "closed";
  if (sound === "SH" || sound === "CH") return "rounded";
  if (sound === "F") return "labiodental";
  return "open";
}

export default function MouthDiagram({
  sound,
  size = 220,
  showHint = true,
  showAirflow = true,
}: {
  sound: TargetSound;
  size?: number;
  showHint?: boolean;
  showAirflow?: boolean;
}) {
  const lips = lipState(sound);
  const hasAirflow =
    showAirflow &&
    (sound === "S" || sound === "SH" || sound === "TH" || sound === "F");

  // Lightweight airflow pulse without reanimated dependency.
  const [airOpacity, setAirOpacity] = useState(1);
  useEffect(() => {
    if (!hasAirflow) return;
    let up = false;
    const id = setInterval(() => {
      up = !up;
      setAirOpacity(up ? 0.3 : 1);
    }, 650);
    return () => clearInterval(id);
  }, [hasAirflow]);

  return (
    <View className="items-center">
      <Svg viewBox="0 0 240 240" width={size} height={size}>
        {/* Head profile facing right */}
        <Path
          d="M 110 30 Q 75 35 60 70 Q 50 105 55 145 Q 60 180 78 200 Q 88 215 105 220 Q 130 222 150 218 Q 165 215 168 205 L 178 200 Q 195 185 198 160 Q 210 130 200 95 Q 188 55 155 38 Q 130 28 110 30 Z"
          fill="#fde68a"
          stroke="#b45309"
          strokeWidth={2}
        />
        <Path
          d="M 88 45 Q 90 22 130 22 Q 175 24 198 50 Q 200 70 192 80 Q 180 60 145 55 Q 110 52 88 60 Z"
          fill="#7c2d12"
        />
        <Ellipse
          cx={172}
          cy={115}
          rx={6}
          ry={11}
          fill="#fcd34d"
          stroke="#b45309"
          strokeWidth={1.5}
        />
        <Ellipse cx={118} cy={108} rx={3.5} ry={4} fill="#1f2937" />
        <Circle cx={119} cy={106} r={1.2} fill="#ffffff" />
        <Path
          d="M 107 96 Q 118 91 130 95"
          stroke="#7c2d12"
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
        />
        <Path
          d="M 95 135 Q 70 142 70 158 Q 72 168 90 165"
          fill="#fde68a"
          stroke="#b45309"
          strokeWidth={2}
        />

        {/* Mouth cavity */}
        <Path
          d="M 70 178 Q 80 184 100 186 L 162 174 L 175 180 L 170 198 L 100 206 Q 80 204 65 196 Z"
          fill="#7f1d1d"
        />
        <Path
          d="M 92 178 Q 130 168 168 175"
          stroke="#fef3c7"
          strokeWidth={3.5}
          fill="none"
          strokeLinecap="round"
        />

        {/* Upper teeth */}
        <G fill="white" stroke="#e5e7eb" strokeWidth={0.5}>
          <Rect x={92} y={176} width={6} height={10} rx={1} />
          <Rect x={100} y={176} width={6} height={10} rx={1} />
          <Rect x={108} y={176} width={6} height={10} rx={1} />
        </G>
        {/* Lower teeth */}
        <G fill="white" stroke="#e5e7eb" strokeWidth={0.5}>
          <Rect x={92} y={192} width={6} height={10} rx={1} />
          <Rect x={100} y={192} width={6} height={10} rx={1} />
          <Rect x={108} y={192} width={6} height={10} rx={1} />
        </G>

        {/* Tongue (per-sound) */}
        <Path
          d={TONGUE_PATHS[sound]}
          fill="#fb7185"
          stroke="#9f1239"
          strokeWidth={1.5}
        />

        {/* Lips */}
        {lips === "closed" && (
          <Path
            d="M 60 184 Q 75 178 90 184 L 90 192 Q 75 198 60 192 Z"
            fill="#dc2626"
          />
        )}
        {lips === "open" && (
          <>
            <Path
              d="M 60 178 Q 75 172 90 176 L 90 182 Q 75 184 60 184 Z"
              fill="#dc2626"
            />
            <Path
              d="M 60 196 Q 75 204 90 200 L 90 192 Q 75 192 60 192 Z"
              fill="#dc2626"
            />
          </>
        )}
        {lips === "rounded" && (
          <>
            <Path
              d="M 52 184 Q 65 175 82 180 L 82 188 Q 70 195 52 196 Z"
              fill="#dc2626"
            />
            <Path
              d="M 52 196 Q 65 205 82 200 L 82 188 L 52 188 Z"
              fill="#b91c1c"
            />
          </>
        )}
        {lips === "labiodental" && (
          <>
            <Path
              d="M 60 178 Q 75 172 90 176 L 90 182 Q 75 184 60 184 Z"
              fill="#dc2626"
            />
            <Path
              d="M 70 192 Q 82 184 100 188 Q 95 196 75 198 Z"
              fill="#dc2626"
            />
          </>
        )}

        {/* Airflow for fricatives */}
        {hasAirflow && (
          <G
            stroke="#0ea5e9"
            strokeWidth={2.5}
            fill="none"
            strokeLinecap="round"
            opacity={airOpacity}
          >
            <Path d="M 60 188 Q 40 188 25 184" strokeDasharray="4 4" />
            <Path d="M 25 184 L 32 180 M 25 184 L 32 188" />
          </G>
        )}
      </Svg>

      {showHint && HINTS[sound] && (
        <Text className="mt-3 max-w-xs text-center text-sm font-bold font-heading text-gray-700">
          {HINTS[sound]}
        </Text>
      )}
    </View>
  );
}

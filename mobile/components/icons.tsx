import React from "react";
import Svg, { Path, Rect } from "react-native-svg";

/** A clean microphone glyph (replaces the 🎤 emoji for a premium look). */
export function MicIcon({
  size = 30,
  color = "#ffffff",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Rect x={9} y={2} width={6} height={12} rx={3} fill={color} />
      <Path
        d="M5 11 a7 7 0 0 0 14 0"
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
      <Path d="M12 18 v3" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M8.5 21 h7" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

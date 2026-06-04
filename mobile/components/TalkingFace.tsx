import React, { useEffect, useState } from "react";
import Svg, { Circle, Ellipse, Path, Rect, G } from "react-native-svg";

/**
 * Friendly lion face with a mouth that opens/closes while speaking, so kids
 * see the mouth move as they hear the word. Mouth height is driven by a
 * simple interval (no reanimated dependency) for reliability.
 */
export default function TalkingFace({
  speaking,
  size = 220,
}: {
  speaking: boolean;
  size?: number;
}) {
  const [mouthRy, setMouthRy] = useState(5);

  useEffect(() => {
    if (!speaking) {
      setMouthRy(5);
      return;
    }
    const frames = [4, 18, 8, 15, 6];
    let i = 0;
    const id = setInterval(() => {
      setMouthRy(frames[i % frames.length]);
      i += 1;
    }, 130);
    return () => clearInterval(id);
  }, [speaking]);

  const tuftCount = 12;

  return (
    <Svg viewBox="0 0 240 240" width={size} height={size}>
      <Circle cx={120} cy={120} r={115} fill="#fb923c" />
      <G fill="#f97316">
        {Array.from({ length: tuftCount }).map((_, i) => {
          const angle = (i * Math.PI * 2) / tuftCount;
          return (
            <Circle
              key={i}
              cx={120 + Math.cos(angle) * 110}
              cy={120 + Math.sin(angle) * 110}
              r={14}
            />
          );
        })}
      </G>

      <Circle cx={120} cy={120} r={82} fill="#fef3c7" />
      <Ellipse cx={68} cy={140} rx={14} ry={9} fill="#fbcfe8" />
      <Ellipse cx={172} cy={140} rx={14} ry={9} fill="#fbcfe8" />

      <Circle cx={92} cy={108} r={10} fill="#1f2937" />
      <Circle cx={148} cy={108} r={10} fill="#1f2937" />
      <Circle cx={95} cy={104} r={3.5} fill="#ffffff" />
      <Circle cx={151} cy={104} r={3.5} fill="#ffffff" />

      <Path d="M114 132 L126 132 L120 144 Z" fill="#c2410c" />

      {/* Mouth */}
      <Ellipse cx={120} cy={172} rx={30} ry={mouthRy} fill="#7c2d12" />
      {speaking && mouthRy > 8 && (
        <Ellipse cx={120} cy={178} rx={18} ry={mouthRy / 3} fill="#ef4444" />
      )}
      <Rect x={100} y={168} width={40} height={3} fill="#fef3c7" rx={1.5} />
    </Svg>
  );
}

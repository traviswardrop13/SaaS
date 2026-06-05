import React, { useEffect, useState } from "react";
import Svg, { Circle, Ellipse, Path, G } from "react-native-svg";

/**
 * Sona's mascot lion. This matches the app logo (assets/splash.svg) exactly
 * and only adds an animated mouth: while `speaking` is true the mouth cycles
 * open/closed so a child sees it move as they hear the sound; otherwise it
 * rests in the logo's gentle smile.
 *
 * The look is proofed in scripts/preview-mascot.js (renders states to PNG).
 */
const MANE: [number, number][] = [
  [240, 0], [208, 120], [120, 208], [0, 240], [-120, 208], [-208, 120],
  [-240, 0], [-208, -120], [-120, -208], [0, -240], [120, -208], [208, -120],
];

// Frames of mouth-openness (px ry) cycled while speaking.
const FRAMES = [4, 12, 22, 14, 24, 8];

export default function TalkingFace({
  speaking,
  size = 200,
}: {
  speaking: boolean;
  size?: number;
}) {
  const [open, setOpen] = useState(0);

  useEffect(() => {
    if (!speaking) {
      setOpen(0);
      return;
    }
    let i = 0;
    const id = setInterval(() => {
      setOpen(FRAMES[i % FRAMES.length]);
      i += 1;
    }, 120);
    return () => clearInterval(id);
  }, [speaking]);

  return (
    <Svg viewBox="-256 -256 512 512" width={size} height={size}>
      {/* Mane */}
      <Circle r={240} fill="#ea580c" />
      <G fill="#c2410c">
        {MANE.map(([x, y], i) => (
          <Circle key={i} cx={x} cy={y} r={38} />
        ))}
      </G>

      {/* Face */}
      <Circle r={172} fill="#fef3c7" />
      <Ellipse cx={-99} cy={40} rx={30} ry={19} fill="#fbcfe8" />
      <Ellipse cx={99} cy={40} rx={30} ry={19} fill="#fbcfe8" />

      {/* Eyes */}
      <Circle cx={-62} cy={-30} r={21} fill="#1f2937" />
      <Circle cx={62} cy={-30} r={21} fill="#1f2937" />
      <Circle cx={-56} cy={-38} r={8} fill="#ffffff" />
      <Circle cx={69} cy={-38} r={8} fill="#ffffff" />

      {/* Nose */}
      <Path d="M-14 19 L14 19 L0 43 Z" fill="#c2410c" />

      {/* Mouth */}
      {open === 0 ? (
        <Path
          d="M-43 73 Q0 112 43 73"
          stroke="#7c2d12"
          strokeWidth={9}
          strokeLinecap="round"
          fill="none"
        />
      ) : (
        <>
          <Ellipse cx={0} cy={82} rx={34} ry={open} fill="#7c2d12" />
          <Ellipse
            cx={0}
            cy={82 + open * 0.4}
            rx={22}
            ry={Math.max(3, open * 0.5)}
            fill="#fb7185"
          />
        </>
      )}
    </Svg>
  );
}

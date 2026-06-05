import React, { useEffect, useState } from "react";
import Svg, { Circle, Ellipse, Path, G } from "react-native-svg";

/**
 * Sona's mascot lion. A clean, flat character whose mouth animates open and
 * closed while speaking so a child sees the mouth move as they hear the
 * sound. Designed in scripts/preview-mascot.js and ported here.
 *
 * `speaking` drives the mouth: when true it cycles through open states on a
 * short interval; when false it rests in a gentle closed smile.
 */
const MANE_OUTER = Array.from({ length: 14 }).map((_, i) => {
  const a = (i / 14) * Math.PI * 2;
  return { cx: 176 + Math.cos(a) * 132, cy: 168 + Math.sin(a) * 132 };
});
const MANE_INNER = Array.from({ length: 12 }).map((_, i) => {
  const a = (i / 12) * Math.PI * 2 + 0.26;
  return { cx: 176 + Math.cos(a) * 104, cy: 168 + Math.sin(a) * 104 };
});

// Frames of mouth-openness (in px ry) cycled while speaking.
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
    <Svg viewBox="0 0 352 352" width={size} height={size}>
      {/* Mane */}
      <G>
        {MANE_OUTER.map((p, i) => (
          <Circle key={`o${i}`} cx={p.cx} cy={p.cy} r={34} fill="#d9620a" />
        ))}
        <Circle cx={176} cy={168} r={140} fill="#ef7c1a" />
        {MANE_INNER.map((p, i) => (
          <Circle key={`i${i}`} cx={p.cx} cy={p.cy} r={26} fill="#f59e0b" />
        ))}
      </G>

      {/* Ears */}
      <Circle cx={96} cy={92} r={26} fill="#f4b942" />
      <Circle cx={256} cy={92} r={26} fill="#f4b942" />
      <Circle cx={96} cy={92} r={13} fill="#e07b39" />
      <Circle cx={256} cy={92} r={13} fill="#e07b39" />

      {/* Face */}
      <Circle cx={176} cy={168} r={98} fill="#ffe7a8" />

      {/* Cheeks */}
      <Ellipse cx={104} cy={186} rx={22} ry={14} fill="#ffb3a7" opacity={0.75} />
      <Ellipse cx={248} cy={186} rx={22} ry={14} fill="#ffb3a7" opacity={0.75} />

      {/* Eyes */}
      <Ellipse cx={138} cy={146} rx={24} ry={28} fill="#ffffff" />
      <Ellipse cx={214} cy={146} rx={24} ry={28} fill="#ffffff" />
      <Circle cx={142} cy={150} r={13} fill="#2b2118" />
      <Circle cx={210} cy={150} r={13} fill="#2b2118" />
      <Circle cx={146} cy={145} r={4.5} fill="#ffffff" />
      <Circle cx={214} cy={145} r={4.5} fill="#ffffff" />

      {/* Brows */}
      <Path
        d="M120 116 Q138 106 158 114"
        stroke="#b45309"
        strokeWidth={7}
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d="M194 114 Q214 106 232 116"
        stroke="#b45309"
        strokeWidth={7}
        fill="none"
        strokeLinecap="round"
      />

      {/* Muzzle */}
      <Ellipse cx={176} cy={196} rx={66} ry={52} fill="#fff4d6" />
      <Path
        d="M160 168 Q176 160 192 168 Q188 182 176 186 Q164 182 160 168 Z"
        fill="#7c3a12"
      />
      <Path
        d="M176 186 L176 198"
        stroke="#7c3a12"
        strokeWidth={5}
        strokeLinecap="round"
      />

      {/* Mouth */}
      {open === 0 ? (
        <Path
          d="M150 178 Q176 196 202 178"
          stroke="#7c3a12"
          strokeWidth={7}
          fill="none"
          strokeLinecap="round"
        />
      ) : (
        <>
          <Ellipse cx={176} cy={184} rx={30} ry={open} fill="#7c2d12" />
          <Ellipse
            cx={176}
            cy={184 + open * 0.35}
            rx={20}
            ry={Math.max(3, open * 0.55)}
            fill="#fb6f92"
          />
          <Path
            d={`M146 184 Q176 ${184 - open} 206 184`}
            fill="#ffffff"
            opacity={0.95}
          />
        </>
      )}
    </Svg>
  );
}

import React, { useEffect, useState } from "react";
import Svg, { Circle, Ellipse, Path, G } from "react-native-svg";

/**
 * Sona's mascot lion. Matches the app logo (assets/splash.svg) and adds:
 *  - an animated mouth while `speaking` (cycles open/closed as audio plays)
 *  - emotional `mood`s for feedback moments (happy / celebrate / encourage /
 *    sad), driving the eyes and mouth.
 *
 * Proofed in scripts/preview-mascot.js (renders every state to PNG).
 */
export type Mood = "neutral" | "happy" | "celebrate" | "encourage" | "sad";

const MANE: [number, number][] = [
  [240, 0], [208, 120], [120, 208], [0, 240], [-120, 208], [-208, 120],
  [-240, 0], [-208, -120], [-120, -208], [0, -240], [120, -208], [208, -120],
];

const FRAMES = [4, 12, 22, 14, 24, 8];

export default function TalkingFace({
  speaking,
  size = 200,
  mood = "neutral",
}: {
  speaking: boolean;
  size?: number;
  mood?: Mood;
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

  const happyEyes = mood === "happy" || mood === "celebrate";

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

      {/* Cheeks — rosier when happy */}
      <Ellipse
        cx={-99}
        cy={40}
        rx={mood === "celebrate" ? 34 : 30}
        ry={mood === "celebrate" ? 22 : 19}
        fill="#fbcfe8"
      />
      <Ellipse
        cx={99}
        cy={40}
        rx={mood === "celebrate" ? 34 : 30}
        ry={mood === "celebrate" ? 22 : 19}
        fill="#fbcfe8"
      />

      {/* Eyes */}
      {happyEyes ? (
        <>
          <Path
            d="M-84 -34 Q-62 -58 -40 -34"
            stroke="#1f2937"
            strokeWidth={11}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M40 -34 Q62 -58 84 -34"
            stroke="#1f2937"
            strokeWidth={11}
            strokeLinecap="round"
            fill="none"
          />
        </>
      ) : (
        <>
          <Circle cx={-62} cy={mood === "sad" ? -24 : -30} r={21} fill="#1f2937" />
          <Circle cx={62} cy={mood === "sad" ? -24 : -30} r={21} fill="#1f2937" />
          <Circle cx={-56} cy={mood === "sad" ? -32 : -38} r={8} fill="#ffffff" />
          <Circle cx={69} cy={mood === "sad" ? -32 : -38} r={8} fill="#ffffff" />
          {mood === "sad" ? (
            <>
              {/* gentle worried brows */}
              <Path d="M-84 -52 Q-62 -60 -44 -50" stroke="#b45309" strokeWidth={8} strokeLinecap="round" fill="none" />
              <Path d="M44 -50 Q62 -60 84 -52" stroke="#b45309" strokeWidth={8} strokeLinecap="round" fill="none" />
            </>
          ) : null}
        </>
      )}

      {/* Nose */}
      <Path d="M-14 19 L14 19 L0 43 Z" fill="#c2410c" />

      {/* Mouth */}
      {speaking ? (
        open === 0 ? (
          <Smile />
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
        )
      ) : (
        <MoodMouth mood={mood} />
      )}
    </Svg>
  );
}

function Smile() {
  return (
    <Path
      d="M-43 73 Q0 112 43 73"
      stroke="#7c2d12"
      strokeWidth={9}
      strokeLinecap="round"
      fill="none"
    />
  );
}

function MoodMouth({ mood }: { mood: Mood }) {
  if (mood === "happy" || mood === "celebrate") {
    // Big open grin with tongue.
    return (
      <>
        <Path d="M-52 66 Q0 140 52 66 Z" fill="#7c2d12" />
        <Path d="M-30 96 Q0 124 30 96 Z" fill="#fb7185" />
      </>
    );
  }
  if (mood === "sad") {
    // Gentle, kind frown (never harsh).
    return (
      <Path
        d="M-36 96 Q0 72 36 96"
        stroke="#7c2d12"
        strokeWidth={9}
        strokeLinecap="round"
        fill="none"
      />
    );
  }
  return <Smile />;
}

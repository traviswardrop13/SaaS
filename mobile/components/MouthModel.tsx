import React, { useEffect, useState } from "react";
import Svg, { Ellipse, Path, Rect, Line } from "react-native-svg";
import type { TargetSound } from "@/lib/scoring";

/**
 * Articulation mouth model — a realistic close-up mouth that shows HOW to make
 * each target sound (lips, teeth, tongue), so a child can mirror it. This is
 * the teaching visual for the speech track; Leo stays the coach/mascot.
 *
 * When `playing`, it loops rest → target → rest so the child sees the mouth
 * *move into* position. Designed/verified by rendering each position to PNG.
 * Phase 1 = these illustrated positions; Phase 2 swaps in real SLP mouth-video.
 */
const SKIN = "#e7b189";
const SKIN2 = "#dca074";
const LIP = "#c86a5e";
const LIPHI = "#d98a7d";
const DARK = "#3a1212";
const TEETH = "#fdfcf7";
const TLINE = "#d8d3c8";
const TONGUE = "#e07a86";
const TONGUEHI = "#ef9aa3";
const mx = 150;
const my = 172;

type Viseme =
  | "rest"
  | "closed"
  | "ah"
  | "s"
  | "round"
  | "f"
  | "th"
  | "tipUp"
  | "r"
  | "back";

const MAP: Record<TargetSound, Viseme> = {
  S: "s",
  R: "r",
  L: "tipUp",
  SH: "round",
  TH: "th",
  CH: "round",
  K: "back",
  G: "back",
  F: "f",
  Z: "s",
  V: "f",
  J: "round",
  P: "closed",
  T: "tipUp",
  M: "closed",
  N: "tipUp",
};

function TeethTop({ w, y }: { w: number; y: number }) {
  const lines = [];
  for (let i = 1; i < 5; i++) {
    const x = mx - w / 2 + i * (w / 5);
    lines.push(
      <Line key={i} x1={x} y1={y} x2={x} y2={y + 13} stroke={TLINE} strokeWidth={1.5} />,
    );
  }
  return (
    <>
      <Rect x={mx - w / 2} y={y} width={w} height={14} rx={4} fill={TEETH} />
      {lines}
    </>
  );
}

function Lips({ rx, ry, cy }: { rx: number; ry: number; cy: number }) {
  return (
    <>
      <Ellipse cx={mx} cy={cy} rx={rx + 12} ry={ry + 10} fill={LIP} />
      <Ellipse cx={mx} cy={cy - 2} rx={rx + 7} ry={ry + 5} fill={LIPHI} />
      <Ellipse cx={mx} cy={cy} rx={rx} ry={ry} fill={DARK} />
    </>
  );
}

function Mouth({ v }: { v: Viseme }) {
  switch (v) {
    case "ah":
      return (
        <>
          <Lips rx={46} ry={58} cy={my + 4} />
          <TeethTop w={70} y={my - 46} />
          <Ellipse cx={mx} cy={my + 40} rx={40} ry={22} fill={TONGUE} />
          <Ellipse cx={mx} cy={my + 36} rx={30} ry={13} fill={TONGUEHI} />
        </>
      );
    case "s":
      return (
        <>
          <Ellipse cx={mx} cy={my} rx={62} ry={22} fill={LIP} />
          <Ellipse cx={mx} cy={my - 1} rx={56} ry={17} fill={LIPHI} />
          <Rect x={mx - 50} y={my - 12} width={100} height={24} rx={6} fill={DARK} />
          <TeethTop w={96} y={my - 11} />
          <Rect x={mx - 48} y={my + 2} width={96} height={11} rx={4} fill={TEETH} />
        </>
      );
    case "round":
      return (
        <>
          <Ellipse cx={mx} cy={my + 2} rx={40} ry={40} fill={LIP} />
          <Ellipse cx={mx} cy={my} rx={32} ry={32} fill={LIPHI} />
          <Ellipse cx={mx} cy={my + 2} rx={20} ry={20} fill={DARK} />
        </>
      );
    case "f":
      return (
        <>
          <Path
            d={`M92 ${my + 14} Q150 ${my + 42} 208 ${my + 14} Q150 ${my + 30} 92 ${my + 14} Z`}
            fill={LIP}
          />
          <Path
            d={`M96 ${my + 15} Q150 ${my + 34} 204 ${my + 15} Q150 ${my + 24} 96 ${my + 15} Z`}
            fill={LIPHI}
          />
          <TeethTop w={84} y={my - 2} />
          <Path
            d={`M100 ${my - 4} Q150 ${my - 18} 200 ${my - 4}`}
            stroke={LIP}
            strokeWidth={10}
            fill="none"
            strokeLinecap="round"
          />
        </>
      );
    case "th":
      return (
        <>
          <TeethTop w={84} y={my - 22} />
          <Ellipse cx={mx} cy={my + 10} rx={34} ry={20} fill={TONGUE} />
          <Ellipse cx={mx} cy={my + 6} rx={24} ry={12} fill={TONGUEHI} />
          <Path
            d={`M98 ${my + 24} Q150 ${my + 44} 202 ${my + 24}`}
            stroke={LIP}
            strokeWidth={11}
            fill="none"
            strokeLinecap="round"
          />
        </>
      );
    case "tipUp":
      return (
        <>
          <Lips rx={42} ry={50} cy={my + 6} />
          <TeethTop w={64} y={my - 38} />
          <Path
            d={`M${mx - 22} ${my + 44} Q${mx} ${my - 28} ${mx + 22} ${my + 44} Q${mx} ${my + 30} ${mx - 22} ${my + 44} Z`}
            fill={TONGUE}
          />
          <Path
            d={`M${mx - 13} ${my + 40} Q${mx} ${my - 18} ${mx + 13} ${my + 40}`}
            fill={TONGUEHI}
          />
        </>
      );
    case "r":
      return (
        <>
          <Lips rx={38} ry={40} cy={my + 4} />
          <Path
            d={`M${mx - 30} ${my + 18} Q${mx} ${my - 32} ${mx + 30} ${my + 18} Q${mx} ${my + 30} ${mx - 30} ${my + 18} Z`}
            fill={TONGUE}
          />
          <Ellipse cx={mx} cy={my - 2} rx={20} ry={13} fill={TONGUEHI} />
        </>
      );
    case "back":
      return (
        <>
          <Lips rx={44} ry={52} cy={my + 6} />
          <TeethTop w={66} y={my - 42} />
          <Path
            d={`M${mx - 34} ${my + 2} Q${mx} ${my - 40} ${mx + 34} ${my + 2} Q${mx} ${my + 18} ${mx - 34} ${my + 2} Z`}
            fill={TONGUE}
          />
          <Path
            d={`M${mx - 30} ${my + 34} Q${mx} ${my + 50} ${mx + 30} ${my + 34}`}
            fill={TONGUEHI}
            opacity={0.8}
          />
        </>
      );
    case "closed":
      return (
        <>
          <Path
            d={`M96 ${my} C122 ${my - 14} 178 ${my - 14} 204 ${my} C178 ${my - 4} 122 ${my - 4} 96 ${my} Z`}
            fill={LIP}
          />
          <Path
            d={`M96 ${my} C122 ${my + 14} 178 ${my + 14} 204 ${my} C178 ${my + 4} 122 ${my + 4} 96 ${my} Z`}
            fill={LIPHI}
          />
          <Path d={`M104 ${my} L196 ${my}`} stroke={DARK} strokeWidth={2.5} strokeLinecap="round" />
        </>
      );
    case "rest":
    default:
      return (
        <>
          <Path
            d={`M96 ${my} C120 ${my - 20} 138 ${my - 16} 150 ${my - 8} C162 ${my - 16} 180 ${my - 20} 204 ${my} C180 ${my + 6} 162 ${my + 4} 150 ${my + 3} C138 ${my + 4} 120 ${my + 6} 96 ${my} Z`}
            fill={LIP}
          />
          <Path
            d={`M96 ${my} C120 ${my + 26} 180 ${my + 26} 204 ${my} C180 ${my + 14} 120 ${my + 14} 96 ${my} Z`}
            fill={LIPHI}
          />
          <Path d={`M104 ${my} Q150 ${my + 5} 196 ${my}`} stroke={DARK} strokeWidth={2.5} fill="none" />
        </>
      );
  }
}

export default function MouthModel({
  sound,
  playing,
  size = 200,
}: {
  sound: TargetSound;
  playing: boolean;
  size?: number;
}) {
  const target = MAP[sound] ?? "ah";
  const [showTarget, setShowTarget] = useState(true);

  useEffect(() => {
    if (!playing) {
      setShowTarget(true);
      return;
    }
    let on = true;
    setShowTarget(true);
    const id = setInterval(() => {
      on = !on;
      setShowTarget(on);
    }, 750);
    return () => clearInterval(id);
  }, [playing, sound]);

  const rest: Viseme = target === "closed" ? "ah" : "rest";

  return (
    <Svg viewBox="0 0 300 300" width={size} height={size}>
      {/* skin + soft shading */}
      <Rect width={300} height={300} rx={28} fill={SKIN} />
      <Ellipse cx={150} cy={255} rx={150} ry={70} fill={SKIN2} opacity={0.35} />
      <Ellipse cx={150} cy={55} rx={150} ry={60} fill="#f3c9a6" opacity={0.4} />
      {/* nose hint for orientation */}
      <Ellipse cx={132} cy={108} rx={7} ry={5} fill={SKIN2} />
      <Ellipse cx={168} cy={108} rx={7} ry={5} fill={SKIN2} />
      <Path d="M150 96 L150 120" stroke={SKIN2} strokeWidth={3} strokeLinecap="round" opacity={0.5} />
      <Mouth v={showTarget ? target : rest} />
    </Svg>
  );
}

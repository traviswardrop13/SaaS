import React, { useEffect, useState } from "react";
import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";
import type { TargetSound } from "@/lib/scoring";

/**
 * Articulation mouth model — a friendly, stylized front-view face whose mouth
 * shows HOW to make the target sound (lips, teeth, tongue). This is the
 * teaching visual for the speech track; Leo stays the coach/mascot.
 *
 * When `playing`, it loops rest → target → rest so the child sees the mouth
 * *move into* the position, the way you'd model a sound in person. Designed in
 * scripts (rendered to PNG) before porting here.
 *
 * Phase 1 = these illustrated positions. Phase 2 (later) swaps in real
 * mouth-video clips recorded by an SLP for the highest fidelity.
 */
const SKIN = "#ffd9b3";
const LIP = "#df7a5e";
const TEETH = "#ffffff";
const DARK = "#5c2018";
const TONGUE = "#f1899f";
const CHEEK = "#ffb3a7";
const EYE = "#2b2118";
const my = 195;
const cx = 140;

type Viseme =
  | "rest"
  | "closed"
  | "s"
  | "open"
  | "openBack"
  | "round"
  | "f"
  | "th"
  | "tipUp"
  | "r";

// Which mouth position teaches each target sound.
const MAP: Record<TargetSound, Viseme> = {
  S: "s",
  R: "r",
  L: "tipUp",
  SH: "round",
  TH: "th",
  CH: "round",
  K: "openBack",
  G: "openBack",
  F: "f",
  P: "closed",
  T: "tipUp",
  M: "closed",
  N: "tipUp",
};

function Mouth({ v }: { v: Viseme }) {
  switch (v) {
    case "closed":
      return (
        <Path
          d={`M104 ${my} L176 ${my}`}
          stroke={LIP}
          strokeWidth={13}
          strokeLinecap="round"
        />
      );
    case "s":
      return (
        <>
          <Ellipse cx={cx} cy={my} rx={52} ry={17} fill={LIP} />
          <Rect x={cx - 44} y={my - 9} width={88} height={18} rx={6} fill={DARK} />
          <Rect x={cx - 42} y={my - 8} width={84} height={7} rx={3} fill={TEETH} />
          <Rect x={cx - 42} y={my + 1} width={84} height={7} rx={3} fill={TEETH} />
        </>
      );
    case "open":
      return (
        <>
          <Ellipse cx={cx} cy={my + 4} rx={42} ry={50} fill={LIP} />
          <Ellipse cx={cx} cy={my + 4} rx={33} ry={41} fill={DARK} />
          <Rect x={cx - 27} y={my - 34} width={54} height={14} rx={5} fill={TEETH} />
          <Ellipse cx={cx} cy={my + 34} rx={27} ry={16} fill={TONGUE} />
        </>
      );
    case "openBack":
      return (
        <>
          <Ellipse cx={cx} cy={my + 4} rx={42} ry={48} fill={LIP} />
          <Ellipse cx={cx} cy={my + 4} rx={33} ry={39} fill={DARK} />
          <Rect x={cx - 27} y={my - 32} width={54} height={13} rx={5} fill={TEETH} />
          <Path
            d={`M${cx - 30} ${my - 8} Q${cx} ${my - 34} ${cx + 30} ${my - 8} Q${cx} ${my + 6} ${cx - 30} ${my - 8} Z`}
            fill={TONGUE}
          />
        </>
      );
    case "round":
      return (
        <>
          <Circle cx={cx} cy={my + 2} r={31} fill={LIP} />
          <Circle cx={cx} cy={my + 2} r={15} fill={DARK} />
        </>
      );
    case "f":
      return (
        <>
          <Path
            d={`M96 ${my + 16} Q140 ${my + 40} 184 ${my + 16} Q140 ${my + 28} 96 ${my + 16} Z`}
            fill={LIP}
          />
          <Rect x={cx - 40} y={my + 2} width={80} height={16} rx={6} fill={TEETH} />
          <Path
            d={`M100 ${my} Q140 ${my - 12} 180 ${my}`}
            stroke={LIP}
            strokeWidth={8}
            fill="none"
            strokeLinecap="round"
          />
        </>
      );
    case "th":
      return (
        <>
          <Rect x={cx - 40} y={my - 18} width={80} height={15} rx={5} fill={TEETH} />
          <Path
            d={`M112 ${my + 18} Q140 ${my - 6} 168 ${my + 18} Q140 ${my + 34} 112 ${my + 18} Z`}
            fill={TONGUE}
          />
          <Path
            d={`M100 ${my + 26} Q140 ${my + 44} 180 ${my + 26}`}
            stroke={LIP}
            strokeWidth={9}
            fill="none"
            strokeLinecap="round"
          />
        </>
      );
    case "tipUp":
      return (
        <>
          <Ellipse cx={cx} cy={my + 4} rx={40} ry={44} fill={LIP} />
          <Ellipse cx={cx} cy={my + 4} rx={31} ry={35} fill={DARK} />
          <Rect x={cx - 26} y={my - 28} width={52} height={12} rx={4} fill={TEETH} />
          <Path d={`M${cx - 16} ${my + 30} Q${cx} ${my - 20} ${cx + 16} ${my + 30} Z`} fill={TONGUE} />
        </>
      );
    case "r":
      return (
        <>
          <Ellipse cx={cx} cy={my + 2} rx={34} ry={34} fill={LIP} />
          <Ellipse cx={cx} cy={my + 2} rx={25} ry={25} fill={DARK} />
          <Path
            d={`M${cx - 22} ${my + 6} Q${cx} ${my - 22} ${cx + 22} ${my + 6} Q${cx} ${my + 20} ${cx - 22} ${my + 6} Z`}
            fill={TONGUE}
          />
        </>
      );
    case "rest":
    default:
      return (
        <Path
          d={`M110 ${my} Q140 ${my + 14} 170 ${my}`}
          stroke={LIP}
          strokeWidth={10}
          fill="none"
          strokeLinecap="round"
        />
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
  const target = MAP[sound] ?? "open";
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
    }, 700);
    return () => clearInterval(id);
  }, [playing, sound]);

  return (
    <Svg viewBox="0 0 280 280" width={size} height={size}>
      <Circle cx={140} cy={145} r={115} fill={SKIN} />
      <Circle cx={103} cy={118} r={10} fill={EYE} />
      <Circle cx={177} cy={118} r={10} fill={EYE} />
      <Circle cx={99} cy={114} r={3} fill="#ffffff" />
      <Circle cx={173} cy={114} r={3} fill="#ffffff" />
      <Ellipse cx={84} cy={170} rx={18} ry={11} fill={CHEEK} opacity={0.7} />
      <Ellipse cx={196} cy={170} rx={18} ry={11} fill={CHEEK} opacity={0.7} />
      <Mouth v={showTarget ? target : "rest"} />
    </Svg>
  );
}

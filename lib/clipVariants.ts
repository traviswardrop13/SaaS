import type { TargetSound, SoundPosition } from "./wordSounds";

/**
 * Error patterns we want labelled recordings for, grouped by target sound.
 * Each variant maps to a clean filename slug + a short human-readable label
 * so the recording UI can prompt with "Now say it with cluster reduction…"
 *
 * "correct" is implicit — every word gets a correct-production slot.
 */
export type ClipVariant = {
  id: string;
  label: string;
  /** short instruction shown to the recorder ("the SLP") in the UI */
  howToSayIt: string;
};

const SINGLE_SOUND_VARIANTS: Partial<Record<TargetSound, ClipVariant[]>> = {
  R: [
    {
      id: "gliding_w",
      label: "R→W gliding",
      howToSayIt: "Substitute a W sound for the R (e.g. “wabbit” for “rabbit”).",
    },
  ],
  L: [
    {
      id: "gliding_w",
      label: "L→W gliding",
      howToSayIt: "Substitute a W for the L (e.g. “wion” for “lion”).",
    },
    {
      id: "gliding_y",
      label: "L→Y gliding",
      howToSayIt: "Substitute a Y for the L (e.g. “yion” for “lion”).",
    },
  ],
  S: [
    {
      id: "frontal_lisp",
      label: "Frontal lisp (S→TH)",
      howToSayIt: "Push the tongue forward so it sounds like TH (e.g. “thun” for “sun”).",
    },
    {
      id: "lateral_lisp",
      label: "Lateral (slushy) lisp",
      howToSayIt: "Let air escape over the sides of the tongue — a wet, slushy S.",
    },
  ],
  TH: [
    { id: "stopping_d", label: "TH→D stopping", howToSayIt: "Use a D sound for the TH (e.g. “dum” for “thumb”)." },
    { id: "th_f", label: "TH→F", howToSayIt: "Use an F sound for the TH (e.g. “fum” for “thumb”)." },
  ],
  SH: [
    { id: "sh_s", label: "SH→S", howToSayIt: "Substitute an S for the SH (e.g. “sip” for “ship”)." },
  ],
  CH: [
    { id: "ch_sh", label: "CH→SH", howToSayIt: "Use a SH for the CH (e.g. “ship” for “chip”)." },
    { id: "ch_t", label: "CH→T", howToSayIt: "Use a T for the CH (e.g. “tip” for “chip”)." },
  ],
  K: [
    { id: "fronting_t", label: "K→T fronting", howToSayIt: "Push the sound forward so K becomes T (e.g. “tat” for “cat”)." },
  ],
  G: [
    { id: "fronting_d", label: "G→D fronting", howToSayIt: "Push the sound forward so G becomes D (e.g. “dot” for “got”)." },
  ],
  F: [
    { id: "stopping_p", label: "F→P stopping", howToSayIt: "Use a P sound for the F (e.g. “pish” for “fish”)." },
  ],
};

/**
 * Resolve which variants we want recorded for a given lesson. Always includes
 * "correct", then any extras driven by the lesson's targetSound + structural
 * features (cluster, final-position deletion).
 */
export function variantsForLesson(opts: {
  targetSound: TargetSound;
  position: SoundPosition;
  blend?: string;
}): ClipVariant[] {
  const out: ClipVariant[] = [
    {
      id: "correct",
      label: "Correct",
      howToSayIt: "Say it the normal/correct way — clear adult production.",
    },
  ];

  if (opts.blend && opts.blend.length === 2) {
    const [first, second] = opts.blend.split("");
    out.push({
      id: `cluster_reduce_drop_${first}`,
      label: `Cluster reduction (drops ${first.toUpperCase()})`,
      howToSayIt: `Skip the ${first.toUpperCase()} so it sounds like just the ${second.toUpperCase()}-word (e.g. dropping the ${first.toUpperCase()} from “${opts.blend}…”).`,
    });
    out.push({
      id: `cluster_reduce_drop_${second}`,
      label: `Cluster reduction (drops ${second.toUpperCase()})`,
      howToSayIt: `Skip the ${second.toUpperCase()} so only the ${first.toUpperCase()} sound is heard.`,
    });
  }

  if (opts.position === "final") {
    out.push({
      id: "final_deletion",
      label: "Final consonant deletion",
      howToSayIt: "Drop the final consonant entirely (e.g. “ca” for “cat”).",
    });
  }

  const subs = SINGLE_SOUND_VARIANTS[opts.targetSound] ?? [];
  for (const v of subs) out.push(v);

  return out;
}

export function clipFilename(wordText: string, variantId: string): string {
  const w = wordText
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${w || "clip"}__${variantId}.webm`;
}

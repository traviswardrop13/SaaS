import LeoImage, { type LeoMood } from "./LeoImage";

/**
 * The session coach's face — the single seam where the avatar lives.
 *
 * - "animated"  → our illustrated coach (LeoImage), working today.
 * - "realistic" → Phase 2: a realtime photoreal avatar (Sarah) driven by the
 *   same TTS audio via a provider (Tavus / HeyGen / Simli). That needs a
 *   provider account + the avatar asset + a streaming integration, none of
 *   which exist yet — so for now the realistic choice gracefully renders the
 *   animated coach. When the avatar is ready, ONLY this component changes;
 *   the whole session flow stays the same.
 */
export default function CoachFace({
  style,
  speaking = false,
  mood,
  size = 130,
}: {
  style?: "animated" | "realistic";
  speaking?: boolean;
  mood?: LeoMood;
  size?: number;
}) {
  // TODO(Phase 2): if (style === "realistic") return <RealtimeAvatar … />;
  return <LeoImage speaking={speaking} mood={mood} size={size} />;
}

import Anthropic from "@anthropic-ai/sdk";
import { kvCmd } from "@/lib/slpAuth";
import { WRITER_SYSTEM, checkScript } from "@/lib/socialRules";

/**
 * Sona's daily short video, made and posted with nobody in the loop
 * (Travis, 11 Nov 2026). Three services, each doing one job:
 *
 *   1. Claude writes the script from today's topic (lib/socialRules TOPICS),
 *      and lib/socialRules checkScript must pass it — or nothing is made.
 *   2. HeyGen renders it as a 9:16 talking-avatar video with burned-in
 *      captions (POST /v3/videos, type "avatar").
 *   3. Upload-Post publishes the finished file to TikTok, Instagram Reels,
 *      YouTube Shorts and Facebook Reels in one call.
 *
 * Why Upload-Post rather than each network's own API: TikTok and YouTube
 * keep every post from an app they have not audited private ("only me")
 * until it passes a review that takes weeks. Upload-Post's app has passed
 * them; Sona's accounts are connected once in its dashboard.
 *
 * Every post is labelled AI-generated (the avatar is synthetic, and the
 * networks require the label) and declared NOT made for kids: the audience
 * is parents, and a made-for-kids flag would also switch off comments.
 *
 * State is one JSON record per day in KV (`social:day:<YYYY-MM-DD>`), so
 * each step can be re-run safely and the founder can read what happened.
 */

export type DayRecord = {
  day: string;
  topic: string;
  stage: "writing" | "write_failed" | "blocked" | "rendering" | "render_failed" | "posting" | "posted" | "post_failed";
  title?: string;
  script?: string;
  caption?: string;
  hashtags?: string[];
  problems?: string[];      // why the checker stopped the script, if it did
  videoId?: string;         // HeyGen
  postRequestId?: string;   // Upload-Post
  error?: string;
  createdAt: string;
  updatedAt: string;
};

const DAY_TTL = 60 * 60 * 24 * 60; // keep 60 days of history

export const dayRecordKey = (day: string) => `social:day:${day}`;

export async function readDay(day: string): Promise<DayRecord | null> {
  const raw = await kvCmd(["GET", dayRecordKey(day)]);
  if (typeof raw !== "string") return null;
  try { return JSON.parse(raw) as DayRecord; } catch { return null; }
}

export async function writeDay(rec: DayRecord): Promise<void> {
  rec.updatedAt = new Date().toISOString();
  await kvCmd(["SET", dayRecordKey(rec.day), JSON.stringify(rec), "EX", DAY_TTL]);
}

/** The env each step needs; a run with any missing does nothing, loudly. */
export const REQUIRED_ENV = [
  "ANTHROPIC_API_KEY",
  "HEYGEN_VIDEO_API_KEY",
  "HEYGEN_AVATAR_ID",
  "HEYGEN_VOICE_ID",
  "UPLOADPOST_API_KEY",
  "UPLOADPOST_USER",
] as const;

export function missingEnv(): string[] {
  return REQUIRED_ENV.filter((k) => !process.env[k]);
}

/** SOCIAL_PAUSED=1 in Vercel stops every step without a redeploy of code. */
export function paused(): boolean {
  return ["1", "true", "yes"].includes(String(process.env.SOCIAL_PAUSED || "").toLowerCase());
}

// ── 1. the writer ────────────────────────────────────────────────────────

export type Script = { title: string; script: string; caption: string; hashtags: string[] };

const SCRIPT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    script: { type: "string" },
    caption: { type: "string" },
    hashtags: { type: "array", items: { type: "string" } },
  },
  required: ["title", "script", "caption", "hashtags"],
  additionalProperties: false,
};

/** Everything a viewer will read or hear, as one string for the checker. */
export function publicText(s: Script): string {
  return [s.title, s.script, s.caption, s.hashtags.join(" ")].join("\n");
}

/**
 * Write today's script. If the checker rejects the first draft, the writer
 * gets the reasons and one more try; a second failure returns the problems
 * and the day is skipped rather than posting something that breaks a rule.
 */
export async function writeScript(topic: string): Promise<{ script?: Script; problems: string[] }> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: `Today's topic: ${topic}` },
  ];
  let problems: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    // The server-side fallback re-runs a refused request on another model in
    // the same call. SDK 0.101 predates the field's types, hence the cast;
    // the beta create sends every non-`betas` key as body.
    const params = {
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCRIPT_SCHEMA } },
      system: WRITER_SYSTEM,
      messages,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    } as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming;
    const msg = await client.beta.messages.create(params);
    if (msg.stop_reason === "refusal") return { problems: ["the writer declined this topic"] };
    if (msg.stop_reason === "max_tokens") return { problems: ["the writer ran out of room"] };
    const text = msg.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    let s: Script;
    try {
      const j = JSON.parse(text) as Script;
      s = {
        title: String(j.title || "").replace(/#/g, "").trim().slice(0, 100),
        script: String(j.script || "").trim(),
        caption: String(j.caption || "").trim(),
        hashtags: (Array.isArray(j.hashtags) ? j.hashtags : [])
          .map((h) => String(h).replace(/[^A-Za-z0-9_]/g, ""))
          .filter(Boolean)
          .slice(0, 5),
      };
    } catch {
      problems = ["the writer's answer was not readable"];
      continue;
    }
    if (!s.title || !s.script) { problems = ["the writer left the title or script empty"]; continue; }
    problems = checkScript(publicText(s));
    if (!problems.length) return { script: s, problems };
    messages.push(
      { role: "assistant", content: msg.content as unknown as Anthropic.Beta.BetaContentBlockParam[] },
      { role: "user", content: `That breaks these rules: ${problems.join("; ")}. Rewrite it so it breaks none of them.` },
    );
  }
  return { problems };
}

// ── 2. the video maker (HeyGen) ──────────────────────────────────────────

const HEYGEN = "https://api.heygen.com";

function heygenHeaders(): Record<string, string> {
  return { "x-api-key": String(process.env.HEYGEN_VIDEO_API_KEY), "Content-Type": "application/json" };
}

/** Start rendering; returns HeyGen's video id. */
export async function startVideo(script: Script, day: string): Promise<string> {
  const r = await fetch(`${HEYGEN}/v3/videos`, {
    method: "POST",
    headers: heygenHeaders(),
    body: JSON.stringify({
      type: "avatar",
      avatar_id: process.env.HEYGEN_AVATAR_ID,
      voice_id: process.env.HEYGEN_VOICE_ID,
      script: script.script,
      title: `Sona daily ${day}`,
      aspect_ratio: "9:16",
      resolution: "1080p",
      // Most short-form is watched muted: burn the captions into a second
      // render (captioned_video_url); video_url stays clean.
      caption: { file_format: "srt", style: "default" },
    }),
  });
  const j = (await r.json().catch(() => ({}))) as { data?: { video_id?: string }; error?: unknown; message?: string };
  const id = j?.data?.video_id;
  if (!r.ok || !id) throw new Error(`HeyGen ${r.status}: ${JSON.stringify(j?.error ?? j?.message ?? j).slice(0, 300)}`);
  return id;
}

export type VideoState = { status: string; url?: string; error?: string };

/** Ask HeyGen how the render is going. URLs are presigned: use them at once. */
export async function videoState(videoId: string): Promise<VideoState> {
  const r = await fetch(`${HEYGEN}/v3/videos/${encodeURIComponent(videoId)}`, { headers: heygenHeaders() });
  const j = (await r.json().catch(() => ({}))) as {
    data?: { status?: string; video_url?: string; captioned_video_url?: string; failure_code?: string; failure_message?: string };
  };
  if (!r.ok || !j.data) return { status: "unknown", error: `HeyGen ${r.status}` };
  const d = j.data;
  return {
    status: String(d.status || "unknown"),
    url: d.captioned_video_url || d.video_url,
    error: d.failure_message || d.failure_code,
  };
}

// ── 3. the mailman (Upload-Post) ─────────────────────────────────────────

const UPLOADPOST = "https://api.upload-post.com";
export const PLATFORMS = ["tiktok", "instagram", "youtube", "facebook"] as const;

/**
 * Hand the finished video to Upload-Post for all four networks. Async, so
 * the call returns in seconds and Upload-Post fetches the file itself; the
 * day's own request id doubles as the idempotency key, so a retried run
 * can never post the same day twice.
 */
export async function postVideo(videoUrl: string, s: Script, day: string): Promise<string> {
  const requestId = `sona-daily-${day}`;
  const tags = s.hashtags.map((h) => "#" + h).join(" ");
  const caption = tags ? `${s.caption}\n\n${tags}` : s.caption;
  const f = new FormData();
  f.append("user", String(process.env.UPLOADPOST_USER));
  for (const p of PLATFORMS) f.append("platform[]", p);
  f.append("video", videoUrl);
  f.append("title", caption);                 // TikTok / Instagram / Facebook caption
  f.append("youtube_title", s.title);         // YouTube needs a real title
  f.append("facebook_title", s.title);
  f.append("description", caption);           // YouTube and Facebook description
  f.append("async_upload", "true");
  f.append("request_id", requestId);
  f.append("is_ai_generated", "true");        // TikTok, YouTube (containsSyntheticMedia), Instagram
  f.append("facebook_is_ai_generated", "true");
  f.append("selfDeclaredMadeForKids", "false"); // for parents; YouTube
  if (process.env.UPLOADPOST_FACEBOOK_PAGE_ID) f.append("facebook_page_id", process.env.UPLOADPOST_FACEBOOK_PAGE_ID);
  const r = await fetch(`${UPLOADPOST}/api/upload`, {
    method: "POST",
    headers: { Authorization: `Apikey ${process.env.UPLOADPOST_API_KEY}`, "Idempotency-Key": requestId },
    body: f,
  });
  const j = (await r.json().catch(() => ({}))) as { success?: boolean; request_id?: string; error?: string; message?: string };
  if (!r.ok || j.success === false) throw new Error(`Upload-Post ${r.status}: ${String(j.error || j.message || "").slice(0, 300)}`);
  return j.request_id || requestId;
}

/** Upload-Post's per-network results for a day's post. */
export async function postState(requestId: string): Promise<unknown> {
  const r = await fetch(`${UPLOADPOST}/api/uploadposts/status?request_id=${encodeURIComponent(requestId)}`, {
    headers: { Authorization: `Apikey ${process.env.UPLOADPOST_API_KEY}` },
  });
  return r.json().catch(() => ({ status: `unreadable (${r.status})` }));
}

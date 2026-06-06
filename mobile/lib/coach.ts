/**
 * Client for the Coach brain (/api/coach). Returns the warm spoken line Leo
 * says at each beat of a live session. Always resolves — if the network or the
 * model is slow/down, we fall back to a friendly canned line so the session
 * never stalls or breaks in front of a child.
 */
const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "https://sona-app.vercel.app";

export type CoachAction = "intro" | "praise" | "encourage" | "moveon" | "finish";

export type CoachInput = {
  childName?: string;
  targetWord?: string;
  targetSound?: string;
  action: CoachAction;
  transcript?: string;
  score?: number | null;
  attempt?: number;
  sessionStats?: { practiced?: number; great?: number };
};

function fallback(input: CoachInput): string {
  const word = input.targetWord ?? "it";
  switch (input.action) {
    case "intro":
      return `Let's try ${word}. Say it with me — ${word}!`;
    case "praise":
      return `Wow, that was great! Nice job saying ${word}.`;
    case "encourage":
      return `So close! Watch my mouth and let's try ${word} again.`;
    case "moveon":
      return `Good try! Let's do the next one.`;
    case "finish":
      return `You did so well today! I'm so proud of you.`;
  }
}

export async function coachLine(input: CoachInput): Promise<string> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 7000);
    const r = await fetch(`${API_URL}/api/coach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const json = (await r.json()) as { ok?: boolean; say?: string };
    if (json?.ok && json.say) return json.say;
  } catch {
    // fall through to canned line
  }
  return fallback(input);
}

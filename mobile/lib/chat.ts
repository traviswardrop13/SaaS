/**
 * "Talk with Leo" client — sends the conversation so far to our backend, which
 * runs Leo's brain (Claude) with kid-safe guardrails and returns his next
 * spoken line. The API key lives only on the server.
 */
import type { TargetSound } from "./scoring";

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "https://sona-app.vercel.app";

export type ChatTurn = { role: "user" | "leo"; text: string };

export async function talkToLeo(opts: {
  history: ChatTurn[];
  child?: { name?: string; sound?: TargetSound; focus?: string };
}): Promise<{ ok: boolean; reply?: string; error?: string }> {
  try {
    const r = await fetch(`${API_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: opts.history, child: opts.child }),
    });
    const json = await r.json();
    if (!json.ok) return { ok: false, error: json.error ?? "Chat failed." };
    return { ok: true, reply: json.reply as string };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Network error" };
  }
}

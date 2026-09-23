import { NextRequest, NextResponse } from "next/server";
import { readSession, kvCmd } from "@/lib/slpAuth";
import { rateLimit } from "@/lib/rateLimit";

/** Feedback and requests to connect go only to the team's feedback inbox.
 * A 2xx means at least one destination accepted the message, never just that
 * the browser submitted it. KV retains the latest 500 messages for one year.
 * Optional notifications: SLACK_FEEDBACK_WEBHOOK_URL or FEEDBACK_WEBHOOK_URL.
 */
export const runtime = "nodejs";

const CATEGORIES = new Set([
  "dashboard", "app", "question", "affiliate", "general", "bug", "feature", "content", "praise",
]);
// Keep the append, cap and expiry together so a failed second request cannot
// leave feedback stored indefinitely. This preserves the existing inbox key.
const STORE_FEEDBACK = `
  local count = redis.call('RPUSH', KEYS[1], ARGV[1])
  redis.call('LTRIM', KEYS[1], -500, -1)
  redis.call('EXPIRE', KEYS[1], ARGV[2])
  return count
`;

export async function POST(req: NextRequest) {
  let session;
  try { session = readSession(req); } catch { session = null; }
  if (!session || typeof session.email !== "string" || !session.email) {
    return NextResponse.json({ ok: false, error: "Please sign in to send your message." }, { status: 401 });
  }

  const limited = await rateLimit(req, { key: "slpfeedback", limit: 30, windowSec: 3600 });
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    const value = await req.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid body");
    body = value;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const kind = body.kind === undefined ? "feedback" : body.kind;
  if (kind !== "feedback" && kind !== "call") {
    return NextResponse.json({ ok: false, error: "Choose feedback or a call request." }, { status: 400 });
  }
  for (const [field, max] of [["text", 2000], ["availability", 240], ["timezone", 80]] as const) {
    if (body[field] !== undefined && (typeof body[field] !== "string" || (body[field] as string).length > max)) {
      return NextResponse.json({ ok: false, error: `Please keep ${field} to ${max} characters.` }, { status: 400 });
    }
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (kind === "feedback" && !text) {
    return NextResponse.json({ ok: false, error: "Please add your feedback or question." }, { status: 400 });
  }

  // A caller can submit feedback before finishing their profile. The signed
  // session still provides a reply address; never trust identity in the body.
  let account: Record<string, unknown> = {};
  try {
    const raw = await kvCmd(["GET", "slpacct:" + session.email]);
    const parsed = raw ? JSON.parse(String(raw)) : null;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) account = parsed;
  } catch { /* the session's reply address is enough */ }
  const rec = {
    kind,
    text: text || "I'd like to connect with Rachel and the Sona team.",
    category: typeof body.category === "string" && CATEGORIES.has(body.category) ? body.category : "general",
    availability: typeof body.availability === "string" ? body.availability.trim() : "",
    timezone: typeof body.timezone === "string" ? body.timezone.trim() : "",
    replyEmail: session.email,
    slpName: typeof account.name === "string" ? account.name.slice(0, 120) : "",
    slpCode: typeof account.code === "string" ? account.code.slice(0, 48) : "",
    at: new Date().toISOString(),
  };

  // Store valid JSON in full. Slicing a serialized record can corrupt it and
  // lose both the message and the address needed to reply.
  const saved = await kvCmd([
    "EVAL", STORE_FEEDBACK, 1, "slp-feedback:" + (rec.slpCode || session.email),
    JSON.stringify(rec), 60 * 60 * 24 * 365,
  ]);
  const stored = typeof saved === "number" && saved > 0;

  let slackSent = false;
  const slackUrl = process.env.SLACK_FEEDBACK_WEBHOOK_URL;
  if (slackUrl) {
    try {
      const response = await fetch(slackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: rec.kind === "call" ? "SLP call request" : "SLP feedback",
          blocks: [
            { type: "header", text: { type: "plain_text", text: rec.kind === "call" ? "SLP call request" : "SLP feedback" } },
            { type: "section", fields: [
              { type: "plain_text", text: `From: ${rec.slpName || "SLP"}\nReply to: ${rec.replyEmail}` },
              { type: "plain_text", text: `About: ${rec.category}\nCode: ${rec.slpCode || "profile not finished"}` },
            ] },
            { type: "section", text: { type: "plain_text", text: rec.text } },
            ...(rec.kind === "call" ? [{ type: "section", text: { type: "plain_text", text: `Availability: ${rec.availability || "Ask by email"}\nTime zone: ${rec.timezone || "Ask by email"}` } }] : []),
            { type: "context", elements: [{ type: "plain_text", text: `Sent at ${rec.at}` }] },
          ],
        }),
        signal: AbortSignal.timeout(5000),
      });
      slackSent = response.ok;
    } catch { /* the dedicated fallback or stored inbox may still succeed */ }
  }

  let delivered = slackSent;
  const hook = process.env.FEEDBACK_WEBHOOK_URL;
  if (!delivered && hook) {
    try {
      const response = await fetch(hook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...rec, source: "slp-feedback" }),
        signal: AbortSignal.timeout(5000),
      });
      delivered = response.ok;
    } catch { /* a confirmed KV save is still a received message */ }
  }

  if (!stored && !delivered) {
    return NextResponse.json({ ok: false, error: "We couldn't receive your message. Please try again shortly." }, { status: 503 });
  }
  return NextResponse.json({ ok: true, stored, delivered, slackSent });
}

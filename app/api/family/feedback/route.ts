import { NextRequest, NextResponse } from "next/server";
import { kvCmd } from "@/lib/slpAuth";
import { rateLimit } from "@/lib/rateLimit";

/**
 * "TALK TO US" FROM THE FAMILY APP (29 Sep 2026) — public/talk.html posts
 * here: a parent's feedback, or a request for a call.
 *
 * Why this is its own route and not either of the two that already exist:
 *  - Not /api/slp/feedback: families never sign in, so there is no session to
 *    say who wrote or where to reply. The reply address is whatever the parent
 *    types, it is optional for feedback and required for a call, and it is
 *    used ONLY to reply. It never reaches /api/lead, Kit, or the lead/pilot
 *    webhooks: asking for help must not sign a parent up for marketing email,
 *    and the page promises exactly that ("It isn't added to any mailing list").
 *  - Not /api/feedback: that route falls back to PILOT_WEBHOOK_URL and
 *    LEAD_WEBHOOK_URL (the old CRM slots), keys its storage by the clinician
 *    code the phone sends, has no rate limit or origin check, and answers
 *    ok:true whether or not anything received the message. Here a 2xx means
 *    the store kept it or a notification accepted it — otherwise the page
 *    keeps the parent's draft and says so.
 *  - Nothing about a child, ever. The record is built field by field from an
 *    allowlist, so a childName, slpCode, childId or pilot code in the body is
 *    dropped, never stored or forwarded. A reply email kept beside a
 *    clinician's code would also be the attribution trail the creator-only
 *    affiliate rule forbids.
 *  - With no sign-in, anyone can post: same-origin only, a 20 KB body cap,
 *    ten an hour per address, and a honeypot field no parent ever sees (a
 *    filled one gets a quiet ok and nothing is kept or sent).
 *
 * KV keeps the latest 1000 messages under `family-feedback`, for a year after
 * the last one. /leads.html shows them (app/api/founders/feedback).
 * Notification: SLACK_FEEDBACK_WEBHOOK_URL only. There is deliberately no
 * FEEDBACK_WEBHOOK_URL fallback: the privacy policy names Upstash and Slack
 * as where these messages go, and a generic hook would be a third place a
 * parent's reply email lands that the policy doesn't name.
 */
export const runtime = "nodejs";

const MAX_BODY = 20000;
const KEY = "family-feedback";
// Both chip sets talk.html can show: the family one and, on the web, the
// clinician one. Anything else is dropped rather than stored as free text.
const CHIPS = new Set([
  "More games", "New sounds to practice", "Progress reports", "Easier for my kid", "Something's broken", "Something else",
  "More sounds", "Better progress data", "Easier to assign", "More game variety",
]);
const RECOMMEND = new Set(["Definitely", "Maybe", "Not yet", ""]);
const PREFER = new Set(["phone", "video", "email", ""]);
const PREFER_LABEL: Record<string, string> = { phone: "Phone call", video: "Video call", email: "Just email", "": "Not said" };
const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
// A lone UTF-16 surrogate passes EMAIL but makes encodeURIComponent throw
// wherever the address is later turned into a mailto: link.
const LONE_SURROGATE = /\p{Cs}/u;
// Append, cap and expiry in one step, so a failed second request can never
// leave the inbox stored indefinitely (the same shape as the SLP inbox).
const STORE_FEEDBACK = `
  local count = redis.call('RPUSH', KEYS[1], ARGV[1])
  redis.call('LTRIM', KEYS[1], -1000, -1)
  redis.call('EXPIRE', KEYS[1], ARGV[2])
  return count
`;

function fail(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(req: NextRequest) {
  // A missing Origin is refused too: a browser always sends one on a POST, so
  // only a script leaves it off.
  if (req.headers.get("origin") !== new URL(req.url).origin) {
    return fail("Please send this from the Sona app.", 403);
  }
  if (Number(req.headers.get("content-length")) > MAX_BODY) return fail("Please shorten your message.", 413);
  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_BODY) return fail("Please shorten your message.", 413);
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("shape");
    body = value;
  } catch {
    return fail("Invalid JSON.");
  }

  // The honeypot, before anything touches the network: a bot that filled the
  // hidden field is told "ok" and nothing is counted, stored or sent.
  const trap = body.website;
  const trapped = typeof trap === "string" ? trap.trim() !== "" : trap !== undefined && trap !== null;
  if (trapped) return NextResponse.json({ ok: true });

  const limited = await rateLimit(req, { key: "familyfeedback", limit: 10, windowSec: 3600 });
  if (limited) return limited;

  const kind = body.kind;
  if (kind !== "feedback" && kind !== "call") return fail("Choose feedback or a call request.");
  for (const [field, max] of [["text", 2000], ["email", 254], ["availability", 240], ["timezone", 80]] as const) {
    if (body[field] !== undefined && (typeof body[field] !== "string" || (body[field] as string).length > max)) {
      return fail(`Please keep ${field} to ${max} characters.`);
    }
  }
  if (body.chips !== undefined && (!Array.isArray(body.chips) || body.chips.length > 6)) {
    return fail("Please pick up to six topics.");
  }
  const chips: string[] = [];
  for (const c of (body.chips as unknown[] | undefined) || []) {
    if (typeof c === "string" && CHIPS.has(c) && !chips.includes(c)) chips.push(c);
  }
  const recommend = body.recommend === undefined ? "" : body.recommend;
  if (typeof recommend !== "string" || !RECOMMEND.has(recommend)) return fail("Please choose Definitely, Maybe or Not yet.");
  const prefer = body.prefer === undefined ? "" : body.prefer;
  if (typeof prefer !== "string" || !PREFER.has(prefer)) return fail("Choose a phone call, a video call or email.");
  const app = body.app === undefined ? "web" : body.app;
  if (app !== "ios" && app !== "web") return fail("Unknown app.");
  // Who is writing: a clinician using the family app on the web sees the
  // clinician question, so their note is filed as theirs, not a parent's.
  const from = body.from === undefined ? "family" : body.from;
  if (from !== "family" && from !== "slp") return fail("Unknown sender.");

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (email && (!EMAIL.test(email) || LONE_SURROGATE.test(email))) return fail("Please check your email address.");
  if (kind === "call" && !email) return fail("Please add an email so we can reply.");
  if (kind === "feedback" && !chips.length && !text) return fail("Pick a topic or write a quick thought first.");

  const rec = {
    kind,
    chips,
    text,
    recommend,
    replyEmail: email,
    prefer,
    availability: typeof body.availability === "string" ? body.availability.trim() : "",
    // Only a call request keeps a time zone — it is there to find a time.
    timezone: kind === "call" && typeof body.timezone === "string" ? body.timezone.trim() : "",
    app,
    from,
    at: new Date().toISOString(),
  };

  // Stored whole: slicing a serialized record could corrupt it and lose both
  // the message and the address needed to reply.
  const saved = await kvCmd(["EVAL", STORE_FEEDBACK, 1, KEY, JSON.stringify(rec), 60 * 60 * 24 * 365]);
  const stored = typeof saved === "number" && saved > 0;

  // Slack, as plain_text only — never mrkdwn — so "<!channel>" or a link a
  // stranger typed shows as the characters they typed. The top-level `text`
  // (which Slack does parse, for the notification) is a fixed phrase.
  let slackSent = false;
  const slackUrl = process.env.SLACK_FEEDBACK_WEBHOOK_URL;
  if (slackUrl) {
    const sender = rec.from === "slp" ? "Clinician" : "Parent";
    const title = rec.kind === "call" ? `${sender} call request` : `${sender} feedback`;
    const who = `Reply to: ${rec.replyEmail || "no email given"}\nFrom: the ${rec.app === "ios" ? "iPhone app" : "web app"}`;
    const what = rec.kind === "call"
      ? `Prefers: ${PREFER_LABEL[rec.prefer]}\nGood time: ${rec.availability || "Ask by email"}\nTime zone: ${rec.timezone || "Ask by email"}`
      : `Topics: ${rec.chips.join(", ") || "none picked"}\nWould recommend: ${rec.recommend || "not answered"}`;
    try {
      const response = await fetch(slackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: title,
          blocks: [
            { type: "header", text: { type: "plain_text", text: title } },
            { type: "section", fields: [{ type: "plain_text", text: who }, { type: "plain_text", text: what }] },
            { type: "section", text: { type: "plain_text", text: rec.text || (rec.kind === "call" ? "No message: they'd like to talk." : "No message: topics only.") } },
            { type: "context", elements: [{ type: "plain_text", text: `Sent at ${rec.at}` }] },
          ],
        }),
        signal: AbortSignal.timeout(5000),
      });
      slackSent = response.ok;
    } catch { /* the stored inbox may still have it */ }
  }
  const delivered = slackSent;

  if (!stored && !delivered) {
    return fail("We couldn't receive your message. Please try again shortly.", 503);
  }
  return NextResponse.json({ ok: true, stored, delivered });
}

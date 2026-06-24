import { NextRequest, NextResponse } from "next/server";

/**
 * SLP Feedback endpoint — receives feedback from the SLP dashboard and
 * forwards it to the founder via Slack webhook. Also stores in KV if
 * configured.
 *
 * Environment variables:
 *   SLACK_FEEDBACK_WEBHOOK_URL — Slack incoming webhook URL for notifications
 *   KV_REST_API_URL / UPSTASH_REDIS_REST_URL — optional KV store
 *   KV_REST_API_TOKEN / UPSTASH_REDIS_REST_TOKEN — optional KV auth
 */
export const runtime = "nodejs";

async function kvCmd(cmd: (string | number)[]): Promise<unknown> {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const tok = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !tok) return undefined;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmd),
    });
    if (!r.ok) return undefined;
    const j = (await r.json()) as { result?: unknown };
    return j.result;
  } catch {
    return undefined;
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const text = String((body.text as string) || "").slice(0, 2000).trim();
  if (!text) {
    return NextResponse.json({ ok: false, error: "Empty feedback." }, { status: 400 });
  }

  const rec = {
    text,
    slpName: String((body.slpName as string) || "Unknown SLP").slice(0, 120),
    slpCode: String((body.slpCode as string) || "").slice(0, 48),
    category: String((body.category as string) || "general").slice(0, 40),
    at: new Date().toISOString(),
  };

  // ── Send to Slack ──────────────────────────────────────────────
  const slackUrl = process.env.SLACK_FEEDBACK_WEBHOOK_URL;
  let slackSent = false;

  if (slackUrl) {
    try {
      const categoryEmoji: Record<string, string> = {
        bug: "🐛",
        feature: "💡",
        content: "📝",
        general: "💬",
        praise: "🌟",
      };
      const emoji = categoryEmoji[rec.category] || "💬";

      const slackPayload = {
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: `${emoji} SLP Feedback — ${rec.category.charAt(0).toUpperCase() + rec.category.slice(1)}`,
              emoji: true,
            },
          },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*From:*\n${rec.slpName}` },
              { type: "mrkdwn", text: `*Code:*\n\`${rec.slpCode || "n/a"}\`` },
            ],
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Feedback:*\n> ${rec.text.replace(/\n/g, "\n> ")}`,
            },
          },
          {
            type: "context",
            elements: [
              { type: "mrkdwn", text: `Sent at ${rec.at}` },
            ],
          },
        ],
      };

      const slackRes = await fetch(slackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slackPayload),
      });
      slackSent = slackRes.ok;
    } catch {
      // Never fail the request because of Slack
    }
  }

  // ── Also try the generic webhook (fallback) ─────────────────────
  if (!slackSent) {
    const hook =
      process.env.FEEDBACK_WEBHOOK_URL ||
      process.env.PILOT_WEBHOOK_URL ||
      process.env.LEAD_WEBHOOK_URL;
    if (hook) {
      try {
        await fetch(hook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...rec, kind: "slp-feedback" }),
        });
      } catch {
        // best effort
      }
    }
  }

  // ── Store in KV ────────────────────────────────────────────────
  try {
    const key = "slp-feedback:" + (rec.slpCode || "unknown");
    await kvCmd(["RPUSH", key, JSON.stringify(rec).slice(0, 4000)]);
    await kvCmd(["LTRIM", key, -500, -1]);
    await kvCmd(["EXPIRE", key, 60 * 60 * 24 * 365]); // 1 year
  } catch {
    // best effort
  }

  return NextResponse.json({ ok: true, slackSent });
}

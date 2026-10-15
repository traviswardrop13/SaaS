import { NextRequest, NextResponse } from "next/server";
import { confirm, confirmOk } from "@/lib/report";

/**
 * The weekly progress report's confirm link (lib/report.ts): the address
 * says yes for one phone, and only then are that phone's numbers kept and
 * emailed.
 *
 * GET has no side effects (mail scanners open every link in an email): it
 * shows one button, which POSTs back here. POST checks the link's HMAC and
 * marks the phone confirmed. A bad link says so and reveals nothing.
 */
export const runtime = "nodejs";

function page(title: string, body: string, action?: string): NextResponse {
  const form = action
    ? `<form method="post" action="${action}" style="margin:18px 0 0;"><button type="submit" style="border:none;border-radius:14px;background:#ff8a3d;color:#fff;font-weight:800;font-size:15px;padding:13px 30px;cursor:pointer;">Yes, send me the report</button></form>`
    : "";
  return new NextResponse(
    `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Sona</title><body style="margin:0;background:#fff6e9;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;"><div style="background:#fff;border-radius:20px;padding:34px 28px;max-width:380px;margin:20px;text-align:center;"><div style="font-size:21px;font-weight:800;color:#4a2c14;">${title}</div><p style="margin:10px 0 0;font-size:14.5px;line-height:1.6;color:#6b5138;">${body}</p>${form}</div></body>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
}

const BAD = ["That link didn’t work", "It may be from an older email. Practice on Sona and we’ll send a fresh one, or reply to any Sona email."] as const;

function read(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  return confirmOk(q.get("e"), q.get("d"), q.get("k"));
}

export async function GET(req: NextRequest) {
  const v = read(req);
  if (!v) return page(...BAD);
  const q = req.nextUrl.searchParams;
  const action = `/api/report/confirm?e=${encodeURIComponent(v.email)}&d=${v.dev}&k=${encodeURIComponent(String(q.get("k")))}`;
  return page("Get the weekly progress report?", "Every Monday: last week’s practice, from Rachel. Days, reps and sounds, never your child’s name or voice.", action);
}

export async function POST(req: NextRequest) {
  const v = read(req);
  if (!v) return page(...BAD);
  if (!(await confirm(v.email, v.dev))) return page("Almost — one hiccup", "We couldn’t save that just now. Please tap the link in the email again in a minute.");
  return page("You’re all set", "Your first weekly progress report comes on Monday. Unsubscribe anytime from the email.");
}

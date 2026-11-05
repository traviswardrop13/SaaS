import { NextRequest, NextResponse } from "next/server";
import { kvConfigured } from "@/lib/slpAuth";
import { rateLimit } from "@/lib/rateLimit";
import { store, validate } from "@/lib/report";

/**
 * THE WEEKLY PROGRESS REPORT's numbers, from the phone (sona.js REPORT1;
 * lib/report.ts says what they are, who confirms them and what happens to
 * them).
 *
 * Only a household that asked for the report (setup's email step, or
 * Settings' switch since 23 Oct 2026) sends here; Settings' Turn off sends
 * `off`, which marks that phone off for the address and deletes its numbers
 * (its confirmation stays); a post saying `on` lifts the mark. The body is
 * an email address, the phone's random device id, and a few numbers a child
 * for this week and last: never a name, an age, a word
 * or a voice (validate() builds what is kept field by field, so anything
 * else in the body is dropped). Nothing is kept until the address has
 * confirmed this phone from the link it is emailed.
 *
 * With no sign-in, anyone can post. The Origin check keeps other websites'
 * pages out (a script can still send one, which is why confirmation exists);
 * the body is capped at 4 KB and an IP (an IPv6 /64) at 40 posts an hour.
 * The address is never logged.
 *
 * Answers: {ok:true}; {ok:true, pending:true} until the address confirms
 * this phone (also what an unsubscribed address gets from an unconfirmed
 * phone, so nobody learns who unsubscribed); {ok:true, off:true} to a
 * confirmed phone whose address unsubscribed (the phone stops); 400 for a
 * body that is not a report; 503 {retry:true} when the store did not answer.
 */
export const runtime = "nodejs";

const MAX_BODY = 4000;

function fail(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(req: NextRequest) {
  if (req.headers.get("origin") !== new URL(req.url).origin) return fail("Please send this from the Sona app.", 403);
  if (Number(req.headers.get("content-length")) > MAX_BODY) return fail("Too large.", 413);
  let body: unknown;
  try {
    const raw = await req.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_BODY) return fail("Too large.", 413);
    body = JSON.parse(raw);
  } catch {
    return fail("Invalid JSON.");
  }
  const limited = await rateLimit(req, { key: "report", limit: 40, windowSec: 3600, v6prefix: true });
  if (limited) return limited;
  const snap = validate(body);
  if (!snap) return fail("Not a report.");
  if (!kvConfigured()) return NextResponse.json({ ok: false, retry: true }, { status: 503 });
  const r = await store(snap);
  if (r === "off") return NextResponse.json({ ok: true, off: true });
  if (r === "pending") return NextResponse.json({ ok: true, pending: true });
  if (r === "error") return NextResponse.json({ ok: false, retry: true }, { status: 503 });
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { kvConfigured } from "@/lib/slpAuth";
import { rateLimit } from "@/lib/rateLimit";
import { store, validate } from "@/lib/report";

/**
 * THE WEEKLY PROGRESS REPORT's numbers, from the phone (sona.js REPORT1;
 * lib/report.ts says what they are and what happens to them).
 *
 * Only a household that asked for the report on setup's email step sends
 * here. The body is an email address, the phone's random device id, and a
 * few numbers a child for this week and last: never a name, an age, a word
 * or a voice (validate() builds what is kept field by field, so anything
 * else in the body is dropped).
 *
 * With no sign-in, anyone can post: same-origin only, a 4 KB body, 40 an
 * hour per address. The worst a stranger can do is add numbers to a report
 * for an address they already know, which its owner can unsubscribe from.
 * The address is never logged.
 *
 * Answers: {ok:true}; {ok:true, off:true} for an address that unsubscribed
 * (nothing kept; the phone stops sending); 400 for a body that is not a
 * report; 503 {retry:true} when the store did not answer.
 */
export const runtime = "nodejs";

const MAX_BODY = 4000;

function fail(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(req: NextRequest) {
  // a browser always sends an Origin on a POST; only a script leaves it off
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
  const limited = await rateLimit(req, { key: "report", limit: 40, windowSec: 3600 });
  if (limited) return limited;
  const snap = validate(body);
  if (!snap) return fail("Not a report.");
  if (!kvConfigured()) return NextResponse.json({ ok: false, retry: true }, { status: 503 });
  const r = await store(snap);
  if (r === "off") return NextResponse.json({ ok: true, off: true });
  if (r === "error") return NextResponse.json({ ok: false, retry: true }, { status: 503 });
  return NextResponse.json({ ok: true });
}

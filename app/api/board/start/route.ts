import { NextRequest } from "next/server";
import { kvCmd } from "@/lib/slpAuth";
import {
  BUDDY_IDS, EMAIL, LONE_SURROGATE, MAILTO_CAP, MAILTO_TTL, MAIL_CAP, DAY_TTL, PEND_TTL, REMOVE_KEEP, RETRY, SCRIPT_MAIL, SCRIPT_START,
  boardJson, cidHash, gateJson, hmget, mailKey, makeCode, makeId, offsetOk, overLimit, readSigned, runScript,
  sendBoardConfirmEmail, sign, utcDay,
} from "@/lib/board";

/**
 * PRACTICE BOARD: "Email me the link" (BOARD1, 11 Oct 2026; dark until
 * Travis's go). The grown-up types an address and ticks up to four children;
 * the phone sends only `{email, kids:[{buddy}], tz}`, never a name or an age.
 *
 * The server makes a pending request (`rid`) and, apart from it, a confirm
 * secret (`cid`) that only the email will ever carry: it keeps a hash of
 * `cid`, never `cid` and never the address. The address goes to Resend once,
 * for one email with a short code, a confirm link and a remove link; the
 * phone gets back only `{pend, code}`, a different kind of value that can
 * never confirm. No response ever carries a link.
 *
 * "Send it again" posts `pend` too: the same request, the same code, one
 * more confirm secret (three kept for confirming; every email's remove link
 * keeps working), and the request's 48 hours start again, so whichever email
 * the grown-up opens works as it says. At most two emails to one address a
 * day (a one-day HMAC of it is the only trace), at most 300 a day in all,
 * and ten requests an hour from one network.
 */
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const g = await gateJson(req, { pausable: true });
  if (!g.ok) return g.res;
  const { body, P, secret } = g;
  if (await overLimit(req, "board-start", 10, secret)) return boardJson({ ok: false, limit: true }, 429, { "Retry-After": "3600" });

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email || email.length > 254 || !EMAIL.test(email) || LONE_SURROGATE.test(email)) return boardJson({ ok: false, error: "email" }, 400);
  const kids = body.kids;
  if (!Array.isArray(kids) || kids.length < 1 || kids.length > 4) return boardJson({ ok: false, error: "kids" }, 400);
  const buddies = kids.map((k) => {
    const b = k && typeof k === "object" ? (k as Record<string, unknown>).buddy : undefined;
    return typeof b === "string" && BUDDY_IDS.includes(b) ? b : "fox";
  });
  if (!offsetOk(body.tz)) return boardJson({ ok: false, error: "tz" }, 400);
  const tz = body.tz;
  const now = Date.now();

  // "Send it again": a live request nobody has claimed yet keeps its id and code.
  let rid = "", code = "", n = buddies.length, again = false, pend = "";
  const asked = readSigned("p", body.pend);
  if (asked) {
    const f = hmget(await kvCmd(["HMGET", P + "pend:" + asked, "ok", "mids", "code", "n"]), 4);
    if (!f) return boardJson(RETRY, 503);
    if (f[2] && !f[1]) {
      // Already confirmed: nothing more to send; the phone's Finish will claim it.
      if (f[0] === "1") return boardJson({ ok: true, pend: body.pend as string, code: f[2], confirmed: true });
      rid = asked; code = f[2]; n = Number(f[3]) || n; again = true; pend = body.pend as string;
    }
  }

  // The caps, before anything is sent: everyone's today, then this address's.
  const day = utcDay(now);
  const caps = await runScript(SCRIPT_MAIL, [P + "mail:" + day, P + "mailto:" + mailKey(email, now)], [DAY_TTL, MAILTO_TTL, MAIL_CAP]);
  if (!Array.isArray(caps) || caps.length !== 2) return boardJson(RETRY, 503);
  if (Number(caps[0]) > MAIL_CAP) {
    console.warn("[board] mail cap");
    return boardJson({ ok: false, resting: true }, 503);
  }
  if (Number(caps[1]) > MAILTO_CAP) return boardJson({ ok: false, limit: true }, 429);

  const cid = makeId();
  let made = false;
  if (again) {
    const r = await runScript(SCRIPT_START, [P + "pend:" + rid], ["add", PEND_TTL, cidHash(cid), REMOVE_KEEP]);
    if (r === undefined) return boardJson(RETRY, 503);
    if (r !== 1) again = false; // claimed or gone in between: a new request instead
  }
  if (!again) {
    rid = makeId(); code = makeCode(); n = buddies.length; pend = sign("p", rid);
    const r = await runScript(SCRIPT_START, [P + "pend:" + rid], ["new", PEND_TTL, cidHash(cid), n, buddies.join(","), tz, code]);
    if (r !== 1) return boardJson(RETRY, 503);
    made = true;
  }

  const origin = new URL(req.url).origin;
  const sent = await sendBoardConfirmEmail(email, {
    confirm: origin + "/api/board/confirm?c=" + encodeURIComponent(sign("c", rid + "." + cid)),
    remove: origin + "/api/board/remove?x=" + encodeURIComponent(sign("x", rid + "." + cid)),
    code,
    n,
  });
  if (!sent.sent) {
    // A request nobody can confirm is not kept. (A resent one keeps its earlier emails.)
    if (made) await kvCmd(["DEL", P + "pend:" + rid]);
    return boardJson({ ok: false, error: "email-off" }, 503);
  }
  return boardJson({ ok: true, pend, code });
}

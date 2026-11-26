import crypto from "node:crypto";
import { kvCmd, rosterKey } from "@/lib/slpAuth";
import { metaKey, goneKey, invIndexKey, invDataKey, invClaimKey, readInviteIndex, DELETED_CODE } from "@/lib/roster";
import { hwKey } from "@/lib/homework";
import { gamesKey } from "@/lib/childGames";
import { loginKey, loginIndexKey, failKey, readLoginIndex } from "@/lib/familyLogin";
import { currentPlan, recordActive, planKey, accessKey, teamKey, teamOfKey, parseTeamRow, StoreUnavailable, type PlanKind } from "@/lib/caseload";
import { signInCodeKey, signInTryKey } from "@/lib/slpSignIn";
import { markUnsubscribed } from "@/lib/contacts";

/**
 * DELETE MY ACCOUNT (SLPAPP1, 16 Nov 2026). Apple accepts an app that makes
 * accounts only if the account can be deleted inside it, and a clinician
 * leaving Sona is owed it on the web too. One function, for both.
 *
 * What goes, for good: the account; every child on the caseload (the roster
 * row, the clinician's notes on it, every homework, the "removed" marks);
 * every invite and every family login made for one; the clinician's own
 * Premium links, plan notes and sign-up counters; their messages to Sona;
 * their community posts and replies (and reports that quote them), and their
 * block list (Community was removed on 17 Nov 2026; what it stored is still
 * someone's words, and still goes); their sign-in code. Their Sona Clinic
 * team (17 Nov 2026): an owner's team goes, and each member's link to it; a
 * member leaves the team they were on. Every session ends. The address
 * leaves the email list too (`email:unsub`, and Resend's contact).
 *
 * What stays, and why:
 *  - THE CLINIC CODE, reserved forever as `DELETED_CODE`. A family's phone
 *    holds a ticket for that code and syncs after every practice; a freed
 *    code claimed by someone else would receive those children's practice.
 *    /api/pilot drops a sync to a deleted code, so nothing comes back.
 *  - Stripe's own records (receipts and tax). Sona keeps no card.
 *  - The families' own phones, untouched: their Sona keeps working, and the
 *    Premium a clinician's plan gave them ends with the account.
 *
 * NOT WHILE A PAID PLAN STILL RENEWS. Deleting the account would leave Stripe
 * charging a card for a dashboard that no longer exists, so a plan that will
 * renew must be cancelled first (one that is cancelled and running out its
 * paid month is fine), a Sona Clinic owner's included. A member's clinic is
 * the owner's plan, not theirs, and never blocks it. A store that does not
 * answer deletes nothing.
 */
export { DELETED_CODE, codeDeleted } from "@/lib/roster";

type Kv = (cmd: (string | number)[]) => Promise<unknown>;

export type DeleteResult =
  | { ok: true }
  | { ok: false; why: "store" | "renews"; kinds?: PlanKind[] };

/** The community's own id for a member (app/api/slp/community: sha256 of the email). */
export function communityId(email: string): string {
  return crypto.createHash("sha256").update(email.toLowerCase()).digest("hex");
}
const COMMUNITY = "{slp-community}:";

// One step for the community: a member's posts go whole, their replies leave
// the posts they were on, and a report that quotes them goes. -- slpdelete:community
const SCRUB_COMMUNITY = `-- slpdelete:community
local posts = redis.call('HGETALL', KEYS[1])
local gone = 0
for i = 1, #posts, 2 do
  local id = posts[i]
  local ok, post = pcall(cjson.decode, posts[i + 1])
  if ok and type(post) == 'table' then
    if post.authorId == ARGV[1] then
      redis.call('HDEL', KEYS[1], id)
      redis.call('ZREM', KEYS[2], id)
      if type(post.category) == 'string' then redis.call('ZREM', KEYS[3] .. post.category, id) end
      gone = gone + 1
    elseif type(post.replies) == 'table' then
      local kept, changed = {}, false
      for _, r in ipairs(post.replies) do
        if type(r) == 'table' and r.authorId == ARGV[1] then changed = true; gone = gone + 1 else table.insert(kept, r) end
      end
      if changed then post.replies = kept; redis.call('HSET', KEYS[1], id, cjson.encode(post)) end
    end
  end
end
local reports = redis.call('LRANGE', KEYS[4], 0, -1)
for _, raw in ipairs(reports) do
  local ok, r = pcall(cjson.decode, raw)
  if ok and type(r) == 'table' and r.authorId == ARGV[1] then redis.call('LREM', KEYS[4], 0, raw) end
end
redis.call('DEL', KEYS[5], KEYS[6])
return gone`;

async function scanDel(pattern: string, kv: Kv): Promise<void> {
  let cursor = "0";
  for (let i = 0; i < 50; i++) {
    const res = (await kv(["SCAN", cursor, "MATCH", pattern, "COUNT", 500])) as [string, string[]] | undefined;
    if (!Array.isArray(res)) return;
    const keys = Array.isArray(res[1]) ? res[1].map(String) : [];
    if (keys.length) await kv(["DEL", ...keys]);
    cursor = String(res[0]);
    if (cursor === "0") return;
  }
}

export async function deleteClinicianAccount(
  rawEmail: string,
  opts: { kv?: Kv; now?: number; unsubscribe?: (email: string) => Promise<unknown> } = {},
): Promise<DeleteResult> {
  const kv = opts.kv || kvCmd;
  const now = opts.now ?? Date.now();
  const email = String(rawEmail || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, why: "store" };

  const raw = await kv(["GET", "slpacct:" + email]);
  if (raw === undefined) return { ok: false, why: "store" };
  let acct: Record<string, unknown> = {};
  try { acct = typeof raw === "string" ? JSON.parse(raw) : {}; } catch { acct = {}; }

  // A plan that will renew is cancelled first. Stripe is asked afresh; when it
  // does not answer, the last thing it said stands (lib/caseload currentPlan).
  const renewing: PlanKind[] = [];
  try {
    for (const kind of ["pro", "clinic", "caseload", "self"] as PlanKind[]) {
      const rec = await currentPlan(email, { kv, now, kind, force: true });
      if (recordActive(rec, now) && !rec!.cancelAtPeriodEnd) renewing.push(kind);
    }
  } catch (e) {
    if (e instanceof StoreUnavailable) return { ok: false, why: "store" };
    throw e;
  }
  if (renewing.length) return { ok: false, why: "renews", kinds: renewing };

  const code = String(acct.code || "").toLowerCase();
  const owner = code ? await kv(["GET", "slpcode:" + code]) : null;
  if (code && owner === undefined) return { ok: false, why: "store" };
  const ownsCode = !!code && (owner === email || owner === DELETED_CODE);

  if (ownsCode) {
    // The code is closed FIRST: from here no family sync writes to it again.
    if ((await kv(["SET", "slpcode:" + code, DELETED_CODE])) !== "OK") return { ok: false, why: "store" };
    const invites = await readInviteIndex(code, kv);
    for (const token of Object.keys(invites)) await kv(["DEL", invDataKey(code, token), invClaimKey(code, token)]);
    const logins = await readLoginIndex(code, kv);
    for (const user of Object.values(logins)) if (user) await kv(["DEL", loginKey(user), failKey(user)]);
    await kv(["DEL",
      rosterKey(code), "slp:" + code.toUpperCase(), hwKey(code), gamesKey(code), metaKey(code), goneKey(code),
      invIndexKey(code), loginIndexKey(code), "slpredeem:" + code, "slp-feedback:" + code,
    ]);
    await scanDel("slpself:" + code + ":*", kv);
  }

  await kv(["EVAL", SCRUB_COMMUNITY, 6,
    COMMUNITY + "posts", COMMUNITY + "index", COMMUNITY + "index:", COMMUNITY + "reports",
    COMMUNITY + "members", COMMUNITY + "blocks:" + communityId(email), communityId(email)]);

  // SONA CLINIC. As an owner: the team goes, and each member's link to it
  // (only where it still names this owner), so nobody is left pointing at a
  // plan that no longer has an account. As a member: off the owner's team.
  const team = await kv(["HGETALL", teamKey(email)]);
  if (team === undefined) return { ok: false, why: "store" };
  if (Array.isArray(team)) {
    for (let i = 0; i + 1 < team.length; i += 2) {
      const m = String(team[i]).toLowerCase();
      if ((await kv(["GET", teamOfKey(m)])) === email) await kv(["DEL", teamOfKey(m)]);
      // An invitation still out goes too (18 Nov 2026): its seat is gone.
      const row = parseTeamRow(team[i + 1]);
      if (row && row.inv) await kv(["DEL", "slpteaminv:" + row.inv]);
    }
  }
  const myOwner = await kv(["GET", teamOfKey(email)]);
  if (myOwner === undefined) return { ok: false, why: "store" };
  if (typeof myOwner === "string" && myOwner) await kv(["HDEL", teamKey(myOwner), email]);
  await kv(["DEL", teamKey(email), teamOfKey(email)]);

  await kv(["DEL",
    planKey(email, "caseload"), planKey(email, "self"), planKey(email, "pro"), planKey(email, "clinic"), accessKey(email),
    "slpredeem-owner:" + email, "slp-feedback:" + email, "slprl:" + email,
    signInCodeKey(email), signInTryKey(email),
  ]);
  // The account last: anything above that failed can be tried again.
  if (typeof (await kv(["DEL", "slpacct:" + email])) !== "number") return { ok: false, why: "store" };
  // Every session issued until now is over (lib/slpAuth liveSession). A new
  // sign-in later makes a new account, under a new code.
  await kv(["SET", "slpsessfrom:" + email, String(now + 1)]);
  try { await kv(["SADD", "email:unsub", email]); } catch { /* best effort */ }
  try { await (opts.unsubscribe || markUnsubscribed)(email); } catch { /* the daily run reconciles */ }
  return { ok: true };
}

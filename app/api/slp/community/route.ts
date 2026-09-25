import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { kvCmd, readSession } from "@/lib/slpAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PREFIX = "{slp-community}:";
const CATEGORIES = new Set(["discussions", "resources", "cf"]);
const ID = /^[a-f0-9-]{36}$/;
const REQUEST_ID = /^[a-zA-Z0-9_-]{8,80}$/;
const PAGE_SIZE = 20;
const WELCOME_ID = "71109159-5b68-4af1-851c-35c918bc3050";
const WELCOME_AUTHOR_ID = "sona-team-rachel";
type Member = { id: string; author: string; moderator: boolean };
type Reply = { id: string; authorId: string; author: string; text: string; createdAt: string };
type Post = Reply & { title: string; category: string; replies: Reply[] };

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
function fail(message: string, status = 400) { return response({ ok: false, error: message }, status); }
function unavailable() { return fail("Community is temporarily unavailable. Your draft has not been lost; please try again.", 503); }

async function member(req: NextRequest): Promise<Member | NextResponse> {
  let session;
  try { session = readSession(req); } catch { session = null; }
  if (!session || typeof session.email !== "string" || !session.email) return fail("Please sign in to open the community.", 401);
  const email = session.email.toLowerCase();
  const raw = await kvCmd(["GET", "slpacct:" + email]);
  if (raw === undefined) return unavailable();
  if (!raw) return fail("Please sign in to your SLP account.", 401);
  let account;
  try { account = JSON.parse(String(raw)); } catch { return unavailable(); }
  if (!account || typeof account !== "object" || Array.isArray(account) || account.email !== email) return fail("Please sign in to your SLP account.", 401);
  // Membership follows the real account, not profile completion or a caseload.
  // Only a first name is shared. Email, clinic, code and child data stay private.
  const first = typeof account.name === "string" ? account.name.trim().split(/\s+/)[0].slice(0, 40) : "";
  const author = /^[\p{L}\p{M}'’.-]+$/u.test(first) ? first : "SLP member";
  const moderators = (process.env.SLP_COMMUNITY_MODERATOR_EMAILS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  return { id: crypto.createHash("sha256").update(email).digest("hex"), author, moderator: moderators.includes(email) };
}

function publicReply(reply: Reply, viewer: Member) {
  return { id: reply.id, author: reply.author, text: reply.text, createdAt: reply.createdAt, canDelete: viewer.moderator || reply.authorId === viewer.id };
}
function publicPost(post: Post, viewer: Member) {
  return { ...publicReply(post, viewer), title: post.title, category: post.category, replies: (Array.isArray(post.replies) ? post.replies : []).map(r => publicReply(r, viewer)), ...(post.id === WELCOME_ID && post.authorId === WELCOME_AUTHOR_ID ? { pinned: true } : {}) };
}

// Reads and writes fail closed if Redis cannot enforce the limit. Using the
// account prevents callers from evading it by changing a supplied IP header.
const READ_LIMIT = `
  local n = redis.call('INCR', KEYS[1])
  if n == 1 then redis.call('EXPIRE', KEYS[1], 60) end
  return n
`;
const READ_POSTS = `
  local entries = redis.call('ZREVRANGEBYSCORE', KEYS[1], ARGV[1], '-inf', 'WITHSCORES', 'LIMIT', 0, ARGV[2])
  local rows = {}
  for i = 1, #entries, 2 do
    local post = redis.call('HGET', KEYS[2], entries[i])
    if post then table.insert(rows, post); table.insert(rows, entries[i + 1]) end
  end
  return rows
`;
// Seed once in the same hash as member posts, so existing reply and ownership
// rules apply. Keep the marker after deletion: a moderator's removal must stick.
// The welcome has no index entry and cannot consume a normal feed page slot.
const READ_WELCOME = `
  if redis.call('HSETNX', KEYS[1], ARGV[1] .. ':seeded', '1') == 1 then
    redis.call('HSETNX', KEYS[1], ARGV[1], ARGV[2])
  end
  return redis.call('HGET', KEYS[1], ARGV[1])
`;
function welcomePost(): Post {
  return {
    id: WELCOME_ID, authorId: WELCOME_AUTHOR_ID, author: "Rachel",
    title: "Hey everyone! 👋", category: "discussions", replies: [], createdAt: new Date().toISOString(),
    text: "I’m Rachel! My husband Travis and I started Sona, and I’m so happy you’re here.\n\nI’d love for this to be a place where we can swap ideas, share resources, and help each other make homework and planning a little easier. And if something in Sona is confusing or could work better, tell us—we’re building it with you.\n\nCome say hi! What setting do you work in, and what’s one thing you’d love help with right now?",
  };
}

export async function GET(req: NextRequest) {
  const viewer = await member(req);
  if (viewer instanceof NextResponse) return viewer;
  const query = new URL(req.url).searchParams;
  const category = query.get("category") || "";
  const cursor = query.get("cursor") || "";
  if (category && !CATEGORIES.has(category)) return fail("Choose a community category.");
  if (cursor && (!/^\d{1,15}$/.test(cursor) || Number(cursor) < 1)) return fail("Invalid community page.");
  const count = await kvCmd(["EVAL", READ_LIMIT, 1, PREFIX + "read:" + viewer.id]);
  if (typeof count !== "number") return unavailable();
  if (count > 120) return fail("Please wait a minute before refreshing again.", 429);
  if (query.get("reports") === "1") {
    if (!viewer.moderator) return fail("This inbox is available to community moderators only.", 403);
    const reports = await kvCmd(["LRANGE", PREFIX + "reports", 0, 99]);
    if (!Array.isArray(reports)) return unavailable();
    try { return response({ ok: true, reports: reports.map(v => JSON.parse(String(v))) }); } catch { return unavailable(); }
  }
  const rows = await kvCmd(["EVAL", READ_POSTS, 2, PREFIX + "index" + (category ? ":" + category : ""), PREFIX + "posts", cursor ? "(" + cursor : "+inf", PAGE_SIZE + 1]);
  if (!Array.isArray(rows) || rows.length % 2) return unavailable();
  const welcome = await kvCmd(["EVAL", READ_WELCOME, 1, PREFIX + "posts", WELCOME_ID, JSON.stringify(welcomePost())]);
  if (welcome !== null && typeof welcome !== "string") return unavailable();
  try {
    const posts = [];
    for (let i = 0; i < Math.min(rows.length, PAGE_SIZE * 2); i += 2) posts.push(publicPost(JSON.parse(String(rows[i])), viewer));
    const pinned = welcome === null ? [] : [publicPost(JSON.parse(welcome), viewer)];
    return response({ ok: true, pinned, posts, nextCursor: rows.length > PAGE_SIZE * 2 ? String(rows[PAGE_SIZE * 2 - 1]) : null });
  } catch { return unavailable(); }
}

// All mutation checks and writes are one Redis transaction. A successful retry
// returns its original receipt before consuming the rate budget. Replies cannot
// race and overwrite one another; deletion cannot be bypassed with stale reads.
const MUTATE = `
  local previous = redis.call('GET', KEYS[7])
  if previous then
    local receipt = cjson.decode(previous)
    if receipt.fingerprint ~= ARGV[8] then return cjson.encode({status=409}) end
    return cjson.encode({status=200,id=receipt.id,duplicate=true})
  end
  local action = ARGV[1]
  local post
  if action ~= 'post' then
    local raw = redis.call('HGET', KEYS[2], ARGV[3])
    if not raw then return cjson.encode({status=404}) end
    post = cjson.decode(raw)
  end
  local target = post
  local replyIndex
  if ARGV[4] ~= '' then
    for i, reply in ipairs(post.replies) do
      if reply.id == ARGV[4] then target = reply; replyIndex = i; break end
    end
    if not replyIndex then return cjson.encode({status=404}) end
  end
  if action == 'delete' and target.authorId ~= ARGV[2] and ARGV[9] ~= '1' then return cjson.encode({status=403}) end
  if action == 'reply' and #post.replies >= 50 then return cjson.encode({status=409,full=true}) end
  local count = redis.call('INCR', KEYS[6])
  if count == 1 then redis.call('EXPIRE', KEYS[6], 3600) end
  if count > 60 then return cjson.encode({status=429}) end
  local id = ARGV[3]
  if action == 'post' then
    local item = cjson.decode(ARGV[5])
    local seq = redis.call('INCR', KEYS[5])
    redis.call('HSET', KEYS[2], item.id, ARGV[5])
    redis.call('ZADD', KEYS[1], seq, item.id)
    redis.call('ZADD', KEYS[8] .. item.category, seq, item.id)
    id = item.id
  elseif action == 'reply' then
    local reply = cjson.decode(ARGV[5])
    table.insert(post.replies, reply)
    redis.call('HSET', KEYS[2], post.id, cjson.encode(post))
    id = reply.id
  elseif action == 'report' then
    local report = cjson.decode(ARGV[5])
    report.postId = post.id
    report.replyId = ARGV[4]
    report.text = target.text
    report.title = post.title
    report.authorId = target.authorId
    redis.call('LPUSH', KEYS[3], cjson.encode(report))
    redis.call('LTRIM', KEYS[3], 0, 999)
    redis.call('EXPIRE', KEYS[3], 31536000)
    id = report.id
  elseif action == 'delete' then
    if replyIndex then
      table.remove(post.replies, replyIndex)
      redis.call('HSET', KEYS[2], post.id, cjson.encode(post))
    else
      redis.call('HDEL', KEYS[2], post.id)
      redis.call('ZREM', KEYS[1], post.id)
      redis.call('ZREM', KEYS[8] .. post.category, post.id)
    end
  end
  if action ~= 'delete' then redis.call('SET', KEYS[7], cjson.encode({id=id,fingerprint=ARGV[8]}), 'EX', 86400) end
  return cjson.encode({status=200,id=id})
`;

async function mutate(req: NextRequest, deleting: boolean) {
  const viewer = await member(req);
  if (viewer instanceof NextResponse) return viewer;
  if (req.headers.get("origin") !== new URL(req.url).origin) return fail("Please submit from your Sona dashboard.", 403);
  let body: Record<string, unknown>;
  try {
    if (Number(req.headers.get("content-length")) > 20000) return fail("Please shorten your message.", 413);
    const raw = await req.text();
    if (raw.length > 20000) return fail("Please shorten your message.", 413);
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("shape");
    body = value;
  } catch { return fail("Invalid community request."); }
  const action = deleting ? "delete" : body.action;
  if (!["post", "reply", "report", "delete"].includes(String(action)) || (!deleting && action === "delete")) return fail("Choose a community action.");
  const requestId = typeof body.requestId === "string" ? body.requestId : "";
  if (!deleting && !REQUEST_ID.test(requestId)) return fail("Please retry this request from the dashboard.");
  const postId = typeof body.postId === "string" ? body.postId : "";
  const replyId = typeof body.replyId === "string" ? body.replyId : "";
  if (action !== "post" && !ID.test(postId)) return fail("Choose a community post.");
  if (body.replyId !== undefined && (!ID.test(replyId) || action === "reply" || action === "post")) return fail("Choose a community reply.");
  const limits: Record<string, number> = { title: 120, text: action === "reply" ? 2000 : 4000, reason: 500 };
  for (const [key, max] of Object.entries(limits)) {
    if (body[key] !== undefined && (typeof body[key] !== "string" || (body[key] as string).length > max)) return fail(`Please keep ${key} to ${max} characters.`);
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if ((action === "post" || action === "reply") && !text) return fail("Write a message before posting.");
  if (action === "post" && (!title || typeof body.category !== "string" || !CATEGORIES.has(body.category))) return fail("Add a title and choose a category.");
  const base = { id: crypto.randomUUID(), authorId: viewer.id, author: viewer.author, text, createdAt: new Date().toISOString() };
  const item = action === "post" ? { ...base, title, category: body.category, replies: [] }
    : action === "reply" ? base : action === "report" ? { id: base.id, reporterId: viewer.id, reason: typeof body.reason === "string" ? body.reason.trim() : "", createdAt: base.createdAt } : {};
  const fingerprint = crypto.createHash("sha256").update(JSON.stringify({ action, postId, replyId, title, text, category: body.category, reason: body.reason })).digest("hex");
  const raw = await kvCmd(["EVAL", MUTATE, 8, PREFIX + "index", PREFIX + "posts", PREFIX + "reports", PREFIX + "reserved", PREFIX + "sequence", PREFIX + "write:" + viewer.id, PREFIX + "request:" + viewer.id + ":" + (requestId || "delete"), PREFIX + "index:", String(action), viewer.id, postId, replyId, JSON.stringify(item), "", requestId, fingerprint, viewer.moderator ? "1" : "0"]);
  if (typeof raw !== "string") return unavailable();
  let result;
  try { result = JSON.parse(raw); } catch { return unavailable(); }
  if (result.status === 200) return response({ ok: true, id: result.id, ...(result.duplicate ? { duplicate: true } : {}) });
  if (result.status === 403) return fail("You can only delete your own posts and replies.", 403);
  if (result.status === 404) return fail("This post or reply is no longer available.", 404);
  if (result.status === 429) return fail("You've reached the community posting limit. Please try again in an hour.", 429);
  if (result.status === 409) return fail(result.full ? "This discussion has reached 50 replies. Please start a new post." : "This request has changed. Please submit it again.", 409);
  return unavailable();
}
export async function POST(req: NextRequest) { return mutate(req, false); }
export async function DELETE(req: NextRequest) { return mutate(req, true); }

import type { Session } from "./types";

/**
 * Session store with two drivers:
 *
 *  1. Upstash Redis (REST) — used when UPSTASH_REDIS_REST_URL/TOKEN (or the
 *     Vercel KV equivalents) are set. This is what makes multi-device work:
 *     every phone hits the same shared store. Mutations take a short per-session
 *     lock so simultaneous votes/submissions don't clobber each other.
 *
 *  2. In-memory Map — the zero-config fallback. Fine for a single screen (one
 *     laptop/tablet passed around or projected) and for local development, but
 *     it does NOT sync across devices because serverless instances don't share
 *     memory. `isShared()` reports which mode is active so the UI can warn.
 */

const URL_ENV =
  process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "";
const TOKEN_ENV =
  process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";

const SHARED = Boolean(URL_ENV && TOKEN_ENV);
const TTL_SECONDS = 60 * 60 * 24 * 2; // 2 days

export function isShared(): boolean {
  return SHARED;
}

function key(code: string): string {
  return `gq:session:${code}`;
}
function lockKey(code: string): string {
  return `gq:lock:${code}`;
}

// ── Upstash REST helpers ─────────────────────────────────────────────────────

async function redis(command: (string | number)[]): Promise<unknown> {
  const res = await fetch(URL_ENV, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN_ENV}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Redis command failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { result?: unknown; error?: string };
  if (data.error) throw new Error(`Redis error: ${data.error}`);
  return data.result;
}

// ── In-memory driver ─────────────────────────────────────────────────────────

const mem = new Map<string, Session>();

// ── Public API ───────────────────────────────────────────────────────────────

export async function putSession(session: Session): Promise<void> {
  if (SHARED) {
    await redis(["SET", key(session.code), JSON.stringify(session), "EX", TTL_SECONDS]);
  } else {
    mem.set(session.code, session);
  }
}

export async function getSession(code: string): Promise<Session | null> {
  if (SHARED) {
    const raw = (await redis(["GET", key(code)])) as string | null;
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Session;
    } catch {
      return null;
    }
  }
  return mem.get(code) ?? null;
}

/**
 * Read-modify-write a session under a short lock (shared mode) so concurrent
 * mutations don't lose updates. The mutator may return a new Session or mutate
 * in place; return `null` from the mutator to abort the write. The whole call
 * returns the session after the mutation, or null if it doesn't exist.
 */
export async function mutateSession(
  code: string,
  mutator: (s: Session) => Session | null | void,
): Promise<Session | null> {
  if (!SHARED) {
    const s = mem.get(code);
    if (!s) return null;
    const out = mutator(s);
    if (out === null) return s;
    const next = (out ?? s) as Session;
    mem.set(code, next);
    return next;
  }

  // Shared mode: acquire a lock, retrying briefly.
  const token = await acquireLock(code);
  try {
    const s = await getSession(code);
    if (!s) return null;
    const out = mutator(s);
    if (out === null) return s;
    const next = (out ?? s) as Session;
    await putSession(next);
    return next;
  } finally {
    if (token) await releaseLock(code);
  }
}

async function acquireLock(code: string): Promise<boolean> {
  for (let i = 0; i < 25; i++) {
    const r = (await redis(["SET", lockKey(code), "1", "NX", "PX", 4000])) as
      | string
      | null;
    if (r === "OK") return true;
    await sleep(80 + i * 15);
  }
  // Give up waiting; proceed without the lock rather than dropping the write.
  return false;
}

async function releaseLock(code: string): Promise<void> {
  try {
    await redis(["DEL", lockKey(code)]);
  } catch {
    // best effort
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

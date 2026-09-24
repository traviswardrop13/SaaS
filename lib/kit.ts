import { kvCmd } from "@/lib/slpAuth";

/**
 * KIT (formerly ConvertKit) — the email list every grown-up who gives Sona an
 * address joins, clinicians and parents tagged apart (24 Sep 2026: GoHighLevel
 * was deleted and Kit replaced it).
 *
 * Three calls, and only the first is load-bearing:
 *  1. create the subscriber (Kit treats this as an upsert, so a second
 *     sign-up is harmless) — if THIS fails, the lead did not reach Kit;
 *  2. add them to the Sona form (KIT_FORM_ID), if one is set;
 *  3. tag them sona-slp / sona-parent.
 * A failed 2 or 3 still leaves a real subscriber in Kit, so it is logged and
 * reported in `detail` (the founder leads page shows it) rather than counted
 * as a lost lead — a wrong form id should cost a tag, not an email address.
 *
 * What goes to Kit: the email address, a CLINICIAN's own first name (never a
 * parent's, never a child's — the caller only passes one for role "slp"), and
 * the role tag. Nothing about a child, ever.
 */
const KIT = "https://api.kit.com/v4";
const STEP_TIMEOUT_MS = 2500;

export type KitResult = { ok: boolean; status: number; detail: string };

export function kitConfigured(): boolean {
  return !!process.env.KIT_API_KEY;
}

type Call = { ok: boolean; status: number; json: Record<string, unknown> | null; text: string };

async function call(path: string, method: string, body?: unknown): Promise<Call> {
  const ctl = new AbortController();
  const fuse = setTimeout(() => ctl.abort(), STEP_TIMEOUT_MS);
  try {
    const r = await fetch(KIT + path, {
      method,
      headers: {
        "X-Kit-Api-Key": process.env.KIT_API_KEY || "",
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctl.signal,
    });
    const text = await r.text().catch(() => "");
    let json: Record<string, unknown> | null = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    return { ok: r.ok, status: r.status, json, text: text.slice(0, 300) };
  } catch (e) {
    return { ok: false, status: 0, json: null, text: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(fuse);
  }
}

/**
 * The id of a tag by name, creating it the first time. Cached in the store so
 * a sign-up costs one Kit call for its tag, not a lookup every time.
 */
async function tagId(name: string): Promise<number | null> {
  const cacheKey = "kit:tag:" + name;
  try {
    const cached = await kvCmd(["GET", cacheKey]);
    if (cached) return Number(cached);
  } catch { /* look it up */ }

  let after = "";
  for (let page = 0; page < 5; page++) {
    const r = await call("/tags?per_page=500" + (after ? "&after=" + encodeURIComponent(after) : ""), "GET");
    if (!r.ok || !r.json) break;
    const tags = (r.json.tags as { id: number; name: string }[] | undefined) || [];
    const hit = tags.find((t) => String(t.name).toLowerCase() === name.toLowerCase());
    if (hit) {
      try { await kvCmd(["SET", cacheKey, String(hit.id)]); } catch { /* uncached is fine */ }
      return Number(hit.id);
    }
    const p = r.json.pagination as { has_next_page?: boolean; end_cursor?: string } | undefined;
    if (!p || !p.has_next_page || !p.end_cursor) break;
    after = p.end_cursor;
  }
  const made = await call("/tags", "POST", { name });
  const id = made.json && (made.json.tag as { id?: number } | undefined)?.id;
  if (id) {
    try { await kvCmd(["SET", cacheKey, String(id)]); } catch { /* uncached is fine */ }
    return Number(id);
  }
  console.error("[kit] could not find or create tag", name, made.status, made.text);
  return null;
}

export async function kitSubscribe(o: { email: string; firstName?: string; tag?: string }): Promise<KitResult> {
  if (!kitConfigured()) return { ok: false, status: 0, detail: "not configured" };

  // The tag lookup runs alongside the subscriber call rather than after it.
  const tagP: Promise<number | null> = o.tag ? tagId(o.tag).catch(() => null) : Promise.resolve(null);

  const sub = await call("/subscribers", "POST", {
    email_address: o.email,
    ...(o.firstName ? { first_name: o.firstName } : {}),
  });
  if (!sub.ok) {
    console.error("[kit] subscriber was not created:", sub.status, sub.text);
    await tagP;
    return { ok: false, status: sub.status, detail: "subscriber " + sub.status };
  }

  const form = process.env.KIT_FORM_ID || "";
  const tid = await tagP;
  const [f, t] = await Promise.all([
    form ? call("/forms/" + encodeURIComponent(form) + "/subscribers", "POST", { email_address: o.email }) : Promise.resolve(null),
    tid ? call("/tags/" + tid + "/subscribers", "POST", { email_address: o.email }) : Promise.resolve(null),
  ]);

  const notes: string[] = [];
  if (f && !f.ok) notes.push("form " + f.status);
  if (o.tag && !tid) notes.push("tag not found");
  else if (t && !t.ok) notes.push("tag " + t.status);
  if (notes.length) console.error("[kit] subscriber added, but:", notes.join(", "), f && !f.ok ? f.text : "", t && !t.ok ? t.text : "");
  return { ok: true, status: sub.status, detail: notes.length ? "added (" + notes.join(", ") + ")" : "added" };
}

/** The tag a lead gets: clinicians apart from everyone else. */
export function kitTagFor(role: string): string {
  return role === "slp" ? "sona-slp" : "sona-parent";
}

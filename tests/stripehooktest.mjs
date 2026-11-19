// STRIPEHOOK1: Stripe tells GoHighLevel about Sona Pro (Travis, 17 Nov 2026:
// "add the stripe webhook too"). Played against the real route, the real
// Stripe signature check, an in-memory store behind the real kvCmd and a fake
// GoHighLevel webhook:
//   - only a correctly signed event gets in; no secret is a 503;
//   - only Sona Pro subscriptions say anything; a family plan, a retired
//     yearly clinician plan and an unrelated event are left alone;
//   - start (trial or paid), trial turned paid, a monthly renewal (never the
//     first charge), cancel, take-back, payment problem and the end each send
//     one line with the clinician's own email, nothing about money;
//   - the same event twice sends once; a start the checkout return already
//     told GoHighLevel about is not told again (the shared slpcrm-pro mark);
//   - GoHighLevel refusing gives the marks back and answers 503, so Stripe's
//     retry sends it.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const Stripe = require("stripe");
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { NextRequest } = require(path.join(REPO, "node_modules/next/server"));
let fails = 0, passes = 0;
const ok = (name, cond, info) => {
  if (cond) { passes++; console.log("PASS " + name); }
  else { fails++; console.log("FAIL " + name + (info === undefined ? "" : "  → " + JSON.stringify(info).slice(0, 600))); }
};

function loadTs(file, cache = new Map()) {
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} }; cache.set(file, mod);
  const js = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const req = (s) => (s.startsWith("@/") ? loadTs(path.join(REPO, s.slice(2) + ".ts"), cache)
    : s === "next/server" ? require(path.join(REPO, "node_modules/next/server")) : require(s));
  new Function("require", "module", "exports", js)(req, mod, mod.exports);
  return mod.exports;
}

const KV_URL = "https://kv.stripehook.test.invalid";
const HOOK = "https://services.leadconnectorhq.com/hooks/TEST/webhook-trigger/TEST";
const K = new Map();
let kvDown = false, crmStatus = 200, stripeDown = false, CUST_EMAIL = "New@Clinic.org";
const SENT = [], STRIPE = [];
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u === KV_URL) {
    if (kvDown) return new Response("{}", { status: 503 });
    const [op, ...a] = JSON.parse(init.body);
    let result = null;
    if (op === "SET") { if (a.includes("NX") && K.has(a[0])) result = null; else { K.set(a[0], String(a[1])); result = "OK"; } }
    else if (op === "DEL") result = K.delete(a[0]) ? 1 : 0;
    else if (op === "GET") result = K.get(a[0]) ?? null;
    else if (op === "EXPIRE") result = 1;
    else throw new Error("fake kv does not speak " + op);
    return Response.json({ result });
  }
  if (u.startsWith("https://api.stripe.com/")) {
    const pathOnly = new URL(u).pathname;
    STRIPE.push({ method: init.method || "GET", path: pathOnly, body: String(init.body || "") });
    if (stripeDown) return new Response(JSON.stringify({ error: { message: "down" } }), { status: 500, headers: { "content-type": "application/json" } });
    if (pathOnly.startsWith("/v1/customers/")) return Response.json({ id: pathOnly.split("/").pop(), object: "customer", email: CUST_EMAIL });
    if (pathOnly.startsWith("/v1/subscriptions/")) return Response.json({ id: pathOnly.split("/").pop(), object: "subscription", metadata: {} });
    throw new Error("fake stripe does not speak " + pathOnly);
  }
  if (u.startsWith(HOOK)) {
    SENT.push({ url: u, body: JSON.parse(init.body) });
    return new Response("{}", { status: crmStatus });
  }
  throw new Error("unexpected outbound call " + u);
};

const SECRET = "whsec_test_0123456789abcdef";
Object.assign(process.env, { KV_REST_API_URL: KV_URL, KV_REST_API_TOKEN: "t", LEAD_WEBHOOK_URL: HOOK, STRIPE_WEBHOOK_SECRET: SECRET,
  STRIPE_SECRET_KEY: "sk_test_fake", STRIPE_PRO_PRODUCT_IDS: "prod_GHLPRO, price_other" });
for (const k of ["RESEND_API_KEY", "GHL_API_TOKEN", "GHL_LOCATION_ID"]) delete process.env[k];
delete process.env.STRIPE_WEBHOOK_SECRET_PREV;

const route = loadTs(path.join(REPO, "app/api/stripe/webhook/route.ts"));
const { proEventFor, proProductIds, untaggedProSub } = loadTs(path.join(REPO, "lib/stripeHook.ts"));
const stripe = new Stripe("sk_test_unused");

let n = 0;
function evt(type, object, prev, livemode = true) {
  return { id: "evt_" + (++n), object: "event", type, livemode, data: { object, ...(prev ? { previous_attributes: prev } : {}) } };
}
const proSub = (over = {}) => ({ id: "sub_pro1", object: "subscription", status: "trialing", cancel_at_period_end: false, cancel_at: null,
  metadata: { plan: "slp-pro", slp: "Clin@Example.org" }, ...over });
async function post(e, secret = SECRET) {
  const raw = JSON.stringify(e);
  const sig = stripe.webhooks.generateTestHeaderString({ payload: raw, secret });
  const req = new NextRequest("https://www.speaksona.com/api/stripe/webhook", { method: "POST", body: raw, headers: { "stripe-signature": sig, "content-type": "application/json" } });
  const r = await route.POST(req);
  return { status: r.status, j: await r.json() };
}
const reset = () => { K.clear(); SENT.length = 0; STRIPE.length = 0; kvDown = false; crmStatus = 200; stripeDown = false; CUST_EMAIL = "New@Clinic.org"; };

// ── the meaning of each event (no network) ──
{
  const m = (type, o, prev) => proEventFor(evt(type, o, prev));
  ok("created on a trial is a start on the trial", m("customer.subscription.created", proSub())?.plan === "trial");
  ok("created paid is a paid start", m("customer.subscription.created", proSub({ status: "active" }))?.plan === "paid");
  ok("the address is the clinician's own, lower case", m("customer.subscription.created", proSub())?.email === "clin@example.org");
  ok("trial to active is converted", m("customer.subscription.updated", proSub({ status: "active" }), { status: "trialing" })?.event === "converted");
  ok("cancel at period end is cancelled", m("customer.subscription.updated", proSub({ status: "active", cancel_at_period_end: true }), { cancel_at_period_end: false })?.event === "cancelled");
  ok("cancel_at set is cancelled too", m("customer.subscription.updated", proSub({ status: "active", cancel_at: 1900000000 }), { cancel_at: null })?.event === "cancelled");
  ok("a cancel taken back is resumed", m("customer.subscription.updated", proSub({ status: "active" }), { cancel_at_period_end: true })?.event === "resumed");
  ok("past due is a payment problem", m("customer.subscription.updated", proSub({ status: "past_due" }), { status: "active" })?.event === "payment-problem");
  ok("an update that changes nothing we care about says nothing", m("customer.subscription.updated", proSub({ status: "active" }), { items: {} }) === null);
  ok("deleted is ended", m("customer.subscription.deleted", proSub({ status: "canceled" }))?.event === "ended");
  const inv = (over) => ({ object: "invoice", billing_reason: "subscription_cycle", amount_paid: 1999, subscription: "sub_pro1",
    parent: { subscription_details: { metadata: { plan: "slp-pro", slp: "clin@example.org" }, subscription: "sub_pro1" } }, ...over });
  ok("a monthly charge is renewed", m("invoice.paid", inv())?.event === "renewed");
  ok("the old invoice shape is read too", m("invoice.paid", inv({ parent: null, subscription_details: { metadata: { plan: "slp-pro", slp: "clin@example.org" } } }))?.event === "renewed");
  ok("the first charge is not a renewal", m("invoice.paid", inv({ billing_reason: "subscription_create" })) === null);
  ok("a $0 invoice is not a renewal", m("invoice.paid", inv({ amount_paid: 0 })) === null);
  ok("a family plan says nothing", m("customer.subscription.created", proSub({ metadata: { plan: "family", email: "mom@example.org" } })) === null);
  ok("a retired yearly clinician plan says nothing", m("customer.subscription.created", proSub({ metadata: { plan: "slp-self", slp: "clin@example.org" } })) === null);
  ok("a Pro sub with no clinician says nothing", m("customer.subscription.created", proSub({ metadata: { plan: "slp-pro" } })) === null);
  ok("an unrelated event says nothing", m("charge.refunded", { object: "charge" }) === null);
}

// ── the route ──
reset();
{
  const start = evt("customer.subscription.created", proSub());
  let r = await post(start);
  ok("a signed start is sent", r.status === 200 && r.j.sent === true, r);
  ok("one line reached GoHighLevel", SENT.length === 1);
  const b = SENT[0]?.body || {};
  ok("it says who and what, nothing else", JSON.stringify(Object.keys(b).sort()) === JSON.stringify(["at", "email", "event", "plan", "role", "source", "summary"]) &&
    b.email === "clin@example.org" && b.role === "slp" && b.source === "sona-pro" && b.event === "started" && b.plan === "trial", b);
  ok("the email rides in the address too", SENT[0]?.url === HOOK + "?email=clin%40example.org", SENT[0]?.url);
  ok("the start is marked for the checkout return", K.get("slpcrm-pro:sub_pro1") === "trial");

  r = await post(start);
  ok("the same event again sends nothing", r.j.ignored === "duplicate" && SENT.length === 1, r);

  reset(); K.set("slpcrm-pro:sub_pro1", "trial");
  r = await post(evt("customer.subscription.created", proSub()));
  ok("a start the checkout return already told is not told again", r.j.ignored === "already-told" && SENT.length === 0, r);

  reset();
  r = await post(evt("customer.subscription.created", proSub()), "whsec_someone_else_0123");
  ok("a wrong signature is refused", r.status === 400 && SENT.length === 0, r);

  reset();
  const raw = JSON.stringify(evt("customer.subscription.created", proSub()));
  const req = new NextRequest("https://www.speaksona.com/api/stripe/webhook", { method: "POST", body: raw, headers: { "content-type": "application/json" } });
  ok("no signature is refused", (await route.POST(req)).status === 400 && SENT.length === 0);

  reset();
  r = await post(evt("customer.subscription.created", proSub({ metadata: { plan: "family" } })));
  ok("a family subscription is ignored, nothing kept", r.j.ignored === "not-sona-pro" && SENT.length === 0 && K.size === 0, r);

  reset(); crmStatus = 500;
  const e = evt("customer.subscription.deleted", proSub({ status: "canceled" }));
  r = await post(e);
  ok("GoHighLevel refusing is a 503", r.status === 503, r);
  ok("…and the mark is given back", !K.has("stripe:evt:" + e.id));
  crmStatus = 200;
  r = await post(e);
  ok("…so Stripe's retry sends it", r.j.sent === true && SENT.at(-1)?.body.event === "ended", r);

  reset(); kvDown = true;
  r = await post(evt("customer.subscription.created", proSub()));
  ok("a store that does not answer is a 503, nothing sent", r.status === 503 && SENT.length === 0, r);

  reset();
  const save = process.env.STRIPE_WEBHOOK_SECRET; delete process.env.STRIPE_WEBHOOK_SECRET;
  r = await post(evt("customer.subscription.created", proSub()));
  ok("no secret set is a 503", r.status === 503 && SENT.length === 0, r);
  process.env.STRIPE_WEBHOOK_SECRET = save;

  reset();
  process.env.STRIPE_WEBHOOK_SECRET_PREV = save; process.env.STRIPE_WEBHOOK_SECRET = "whsec_new_secret_abcdef01";
  r = await post(evt("customer.subscription.created", proSub()), save);
  ok("the previous secret still works during a change", r.j.sent === true, r);
  process.env.STRIPE_WEBHOOK_SECRET = save; delete process.env.STRIPE_WEBHOOK_SECRET_PREV;

  const g = await (await route.GET()).json();
  ok("the health check says only yes or no", g.secret === true && g.crm === true && !JSON.stringify(g).includes("whsec"), g);
}

// ── GHLPRO1: Sona Pro bought on the GoHighLevel checkout ──
{
  const ids = proProductIds();
  ok("the product list keeps only Stripe ids", ids.has("prod_GHLPRO") && ids.has("price_other") && ids.size === 2 && proProductIds("junk, ,prod_x y").size === 0);
  const ghlSub = (over = {}) => ({ id: "sub_ghl1", object: "subscription", status: "trialing", customer: "cus_1", cancel_at_period_end: false, cancel_at: null,
    metadata: {}, items: { data: [{ price: { id: "price_ghl", product: "prod_GHLPRO" } }] }, ...over });
  ok("a subscription for the listed product is Sona Pro", untaggedProSub(ghlSub(), ids));
  ok("…matched by price id too", untaggedProSub(ghlSub({ items: { data: [{ price: { id: "price_other", product: "prod_x" } }] } }), ids));
  ok("another product is not", !untaggedProSub(ghlSub({ items: { data: [{ price: { id: "price_x", product: "prod_family" } }] } }), ids));
  ok("one already stamped is never claimed again", !untaggedProSub(ghlSub({ metadata: { plan: "family" } }), ids));
  ok("with no list, nothing is claimed", !untaggedProSub(ghlSub(), proProductIds("")));

  reset();
  const r = await post(evt("customer.subscription.created", ghlSub()));
  ok("a GoHighLevel start is claimed and sent", r.status === 200 && r.j.sent === true, r);
  const upd = STRIPE.find((x) => x.method === "POST" && x.path === "/v1/subscriptions/sub_ghl1");
  ok("…the subscription is stamped plan slp-pro, the customer's own email", !!upd && upd.body.includes("metadata[plan]=slp-pro") && upd.body.includes("metadata[slp]=new%40clinic.org"), STRIPE);
  ok("…GoHighLevel hears a Sona Pro trial for that email", SENT.length === 1 && SENT[0].body.email === "new@clinic.org" && SENT[0].body.event === "started" && SENT[0].body.plan === "trial", SENT);
  ok("…a sign-in link is made for that email, once", K.get("slpghlmail:sub_ghl1") === "1" && [...K.entries()].some(([k, v]) => k.startsWith("slptok:") && v === "new@clinic.org"));
  ok("…and any cached 'no plan' for them is dropped", !K.has("slpplan-pro:new@clinic.org"));
  const toks = [...K.keys()].filter((k) => k.startsWith("slptok:")).length;
  await post(evt("customer.subscription.created", ghlSub()));
  ok("a second delivery sends no second sign-in link", [...K.keys()].filter((k) => k.startsWith("slptok:")).length === toks);

  reset(); stripeDown = true;
  const r2 = await post(evt("customer.subscription.created", ghlSub()));
  ok("Stripe not answering the claim is a 503, nothing sent or marked", r2.status === 503 && SENT.length === 0 && !K.has("slpghlmail:sub_ghl1"), r2);

  reset(); CUST_EMAIL = "";
  const r3 = await post(evt("customer.subscription.created", ghlSub()));
  ok("a customer with no email is left alone", r3.j.ignored === "not-sona-pro" && !STRIPE.some((x) => x.method === "POST") && SENT.length === 0, r3);

  reset();
  await post(evt("customer.subscription.created", ghlSub({ items: { data: [{ price: { id: "price_x", product: "prod_family" } }] } })));
  ok("another product's subscription is never touched", STRIPE.length === 0 && SENT.length === 0);
}

// ── the source never logs an address or keeps money ──
{
  const src = readFileSync(path.join(REPO, "app/api/stripe/webhook/route.ts"), "utf8") + readFileSync(path.join(REPO, "lib/stripeHook.ts"), "utf8");
  ok("no console line carries an email", !/console\.[a-z]+\([^)]*email/i.test(src));
}

console.log(`\n${passes} passed, ${fails} failed`);
console.log(fails ? "FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);

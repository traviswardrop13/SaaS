// SETUPBUY1: a new family, end to end, on the REAL pages (5 Oct 2026, option B:
// Travis, "number B would be good ... you can do a full reset").
//
// The setup page and the price page are each played alone by their own suites
// (onboardingtest stubs the price page, pricescreentest stubs setup). This one
// joins them on one fake phone that has BOTH an App Store and a microphone
// (tests/_phone.mjs), because the hand-over between the two pages is the part
// neither can see:
//   - setup asks its four things, shows "<Name>'s practice is ready", and only
//     then the price, while the grown-up still holds the phone;
//   - the price is ONE plan with the store's own words, and no reminder is
//     promised (Sona sends none yet);
//   - a purchase comes BACK to setup for the microphone and "Hand the phone
//     to <Name>!", and only then opens the first game;
//   - "Not now" goes Home, with no microphone ask and no hand-off;
//   - a phone that cannot buy never sees a price and goes on in the page;
//   - the two answers a parent taps reach no request at all.
import { chromium, launchOpts } from "./_env.mjs";
import { serve, open, calm, IDS } from "./_phone.mjs";

const { base, close } = await serve();
const browser = await chromium.launch(launchOpts());
let failures = 0, assertions = 0;
function ok(name, pass, detail = "") { assertions++; if (!pass) failures++; console.log((pass ? "PASS " : "FAIL ") + name + (pass ? "" : " → " + JSON.stringify(detail))); }
async function scenario(name, fn) { try { await fn(); } catch (e) { ok(name + " has no harness/page exception", false, String(e && e.stack || e).split("\n").slice(0, 4).join(" | ")); } }

const tap = async (page, sel) => { await calm(page); try { await page.locator(sel).click(); } catch (e) {
  const at = await page.evaluate(() => ({ screen: document.body.getAttribute("data-setup-screen"), url: location.pathname + location.search, name: (document.getElementById("obName") || {}).value, sounds: [...document.querySelectorAll("#obSounds .on")].map((x) => x.dataset.sound) })).catch(() => ({}));
  throw new Error("tap " + sel + " at " + JSON.stringify(at) + ": " + String(e.message).split("\n")[0]); } };
const step = (page, key) => page.locator('[data-step="' + key + '"].on').waitFor();
const text = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, " ").trim() : null; }, sel);

// a parent's setup, as far as the ready screen
async function toReady(page, name) {
  await page.goto(base + "/onboarding.html");
  await page.waitForFunction(() => window.Sona && document.getElementById("nextBtn"));
  await tap(page, "#nextBtn");                                           // the hello
  await step(page, "who"); await tap(page, '.who-pick[data-role="parent"]');
  await step(page, "name"); await page.locator("#obName").fill(name); await tap(page, '#obAge [data-age="6"]'); await tap(page, "#nextBtn");
  await step(page, "why"); await tap(page, '#obWhy .ask-pick[data-val="w_therapist"]');
  await step(page, "sounds");                                            // R is the picker's own first pick: tap it only if it is not on
  if ((await page.locator('#obSounds [data-sound="R"]').getAttribute("aria-pressed")) !== "true") await tap(page, '#obSounds [data-sound="R"]');
  await tap(page, "#nextBtn");
  await step(page, "home"); await tap(page, '#obHome .ask-pick[data-val="h_hard"]');
  await step(page, "ready");
}

await scenario("a family that can buy", async () => {
  const { context, page, errors, requests } = await open(browser, base, { app: "buy", mic: "grant" });
  try {
    await toReady(page, "Mia");
    ok("setup ends on the ready screen: the child's name, and Rachel's line word for word",
      (await text(page, "#readyTitle")) === "Mia's practice is ready" &&
      (await text(page, "#readyRachel")) === "Built with Rachel, MS, CF-SLP, a pediatric speech-language pathologist in her clinical fellowship.",
      { title: await text(page, "#readyTitle"), rachel: await text(page, "#readyRachel") });
    ok("…and nothing has asked the phone for the microphone yet", (await page.evaluate(() => window.__phone.mic.requests.length)) === 0);
    await tap(page, "#nextBtn");
    await page.waitForURL(/\/subscribe\.html\?setup=1$/, { timeout: 12000 });
    await page.locator('#iapCard[data-state="free"]').waitFor({ timeout: 12000 });
    const card = await text(page, "#iapCard"), button = await text(page, "#iapBuy");
    ok("Continue goes to the price, while the grown-up still holds the phone: one plan, the store's own words",
      /3 days free, then \$9\.99 a month\./.test(card) && button === "Start 3 days free" && !/\$59\.99|a year|yearly/i.test(card), { card, button });
    ok("…with a two-row timeline (today, and the billing day) and Apple's cancel rule",
      (await page.locator("#iapTL li").count()) === 2 && /Today/.test(card) && /at least 24 hours before/.test(card) && /Settings\s*→\s*Subscriptions/.test(card), card);
    ok("…and no reminder is promised anywhere on the price screen (Sona sends none yet)",
      !/\b(remind|reminder|email|e-mail|notify|notification)/i.test(await text(page, "body")), await text(page, "body"));
    const ways = { notNow: await page.locator("#declineLink").waitFor({ state: "visible", timeout: 4000 }).then(() => true, () => false), restore: await page.locator("#iapRestore").isVisible(),
      terms: await page.locator('#iapLegal a[href="/terms"]').isVisible(), privacy: await page.locator('#iapLegal a[href="/privacy"]').isVisible(), notNowSays: await text(page, "#declineLink") };
    ok("…and \"Not now\", Restore, Terms and Privacy are all there", ways.notNow && ways.restore && ways.terms && ways.privacy && /^Not now/.test(ways.notNowSays || ""), ways);
    await tap(page, "#iapBuy");
    await page.waitForURL(/\/onboarding\.html$/, { timeout: 12000 });
    await step(page, "mic");
    const bought = await page.evaluate(() => ({ id: localStorage.getItem("__bought"), premium: !!(window.Sona && Sona.premium && Sona.premium()), game: sessionStorage.getItem("sona.firstgame.v1") }));
    ok("starting the free days buys the MONTHLY plan and comes back to setup on the microphone screen, not a game",
      bought.id === IDS.monthly && bought.premium && !bought.game, bought);
    await tap(page, "#nextBtn");                                         // Turn on Echo's ears
    await step(page, "achieve");
    ok("the microphone is asked for after the price, then \"Hand the phone to Mia!\"",
      /Hand the phone to\s*Mia!/.test(await text(page, '[data-step="achieve"]')) && (await page.evaluate(() => window.__phone.mic.requests.length)) >= 1, await text(page, '[data-step="achieve"]'));
    await tap(page, "#nextBtn");                                         // Let's play!
    await page.waitForURL(/\/charge\.html\?game=arcade-slice\.html$/, { timeout: 12000 });
    ok("\"Let's play!\" opens the first game (Fruit Slice's practice page for a six-year-old), open because Premium is on",
      /\/charge\.html\?game=arcade-slice\.html$/.test(page.url()), page.url());
    const leaked = requests.filter((r) => /w_therapist|h_hard|speech therapist|a struggle/i.test(r.url + " " + (r.body || "")));
    ok("the two answers the parent tapped are in no request, address or body, anywhere in the walk", leaked.length === 0, leaked.slice(0, 3));
    const named = requests.filter((r) => /\bMia\b/.test(decodeURIComponent(r.url) + " " + (r.body || "")));
    ok("…and neither is the child's name", named.length === 0, named.slice(0, 3));
    ok("a family that can buy: no page errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

await scenario("Not now", async () => {
  const { context, page, errors } = await open(browser, base, { app: "buy", mic: "grant" });
  try {
    await toReady(page, "Ben");
    await tap(page, "#nextBtn");
    await page.waitForURL(/\/subscribe\.html\?setup=1$/, { timeout: 12000 });
    await page.locator('#iapCard[data-state="free"]').waitFor({ timeout: 12000 });
    await tap(page, "#declineLink");
    await page.waitForURL(/\/today\.html$/, { timeout: 12000 });
    const st = await page.evaluate(() => ({ mic: window.__phone.mic.requests.length, marker: sessionStorage.getItem("sona.setupafter.v1"), bought: localStorage.getItem("__bought"), premium: !!Sona.premium(), slice: Sona.gameAccess("slice").allowed }));
    ok("\"Not now\" goes Home with nothing bought, no microphone ask, no hand-off waiting, and the games locked",
      st.mic === 0 && !st.marker && !st.bought && !st.premium && st.slice === false, st);
    ok("Not now: no page errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

await scenario("a phone that cannot buy", async () => {
  const { context, page, errors, requests } = await open(browser, base, { mic: "grant" });   // a browser: the website does not sell
  try {
    await toReady(page, "Zoe");
    await tap(page, "#nextBtn");
    await step(page, "mic");
    ok("with nothing to sell, Continue goes on in the page to the microphone: the price page is never asked for",
      !requests.some((r) => /subscribe\.html/.test(r.url)) && /\/onboarding\.html$/.test(page.url()), page.url());
    await tap(page, "#nextBtn");
    await step(page, "achieve");
    await tap(page, "#nextBtn");
    await page.waitForURL(/\/charge\.html\?game=arcade-slice\.html$/, { timeout: 12000 });
    ok("…then the hand-off and the first game, which the free version opens", /arcade-slice/.test(page.url()), page.url());
    ok("a phone that cannot buy: no page errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

await browser.close(); await close();
console.log(failures ? "\n" + failures + " FAILURES of " + assertions : "\nALL GREEN — " + assertions + " assertions");
process.exit(failures ? 1 : 0);

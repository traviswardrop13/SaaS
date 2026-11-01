// SETUPBUY1: a new family, end to end, on the REAL pages (5 Oct 2026, option B:
// Travis, "number B would be good ... you can do a full reset").
//
// The setup page and the price page are each played alone by their own suites
// (onboardingtest stubs the price page, pricescreentest stubs setup). This one
// joins them on one fake phone that has BOTH an App Store and a microphone
// (tests/_phone.mjs), because the hand-over between the two pages is the part
// neither can see:
//   - setup sells Sona (the games playing, Rachel on her own, then what the
//     child loves and their games: 22 Oct 2026; the problem slide went on 31
//     Oct 2026), asks its
//     questions, then the optional email (13 Oct 2026: before the price, so
//     the address is on the phone when a purchase tells the list), shows
//     "<Name>'s practice is ready!", and only then the price, while the
//     grown-up still holds the phone;
//   - the price is ONE plan with the store's own words, and no reminder is
//     promised (Sona sends none yet);
//   - a purchase comes BACK to setup for the microphone and "Hand the phone
//     to <Name>!", and then opens the first game, Fruit Slice, as the ready
//     screen's Day 1 says ("Play a game, then read a book."; 31 Oct 2026:
//     "go straight into either piano tiles or fruit slice. Because that's
//     what is advertised"; from 17 Oct it went Home, and that morning,
//     briefly, to today's story);
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

// a parent's setup, as far as the ready screen (an address on the email step, or Skip)
// (sold: the headings of the screens that sell, as the parent read them;
// rachelLine: Rachel's line on her own screen, 22 Oct 2026)
const sold = [];
let rachelLine = "";
async function toReady(page, name, email = "") {
  sold.length = 0; rachelLine = "";
  await page.goto(base + "/onboarding.html");
  await page.waitForFunction(() => window.Sona && document.getElementById("nextBtn"));
  await tap(page, "#nextBtn");                                           // the hello
  await step(page, "name"); await page.locator("#obName").fill(name); await tap(page, '#obAge [data-age="6"]'); await tap(page, "#nextBtn");
  for (const key of ["reel", "rachel"]) {                               // the name first since 1 Nov 2026
    await step(page, key); sold.push(await text(page, '[data-step="' + key + '"] h1'));
    if (key === "rachel") rachelLine = await page.evaluate(() => document.getElementById("rachelLine").textContent);
    await tap(page, "#nextBtn");
  }
  for (const key of ["interests", "games"]) { await step(page, key); sold.push(await text(page, '[data-step="' + key + '"] h1')); await tap(page, "#nextBtn"); }
  await step(page, "therapy"); await tap(page, '#obTherapy .ask-pick[data-val="t_yes"]');
  await step(page, "sounds");                                            // R is the picker's own first pick: tap it only if it is not on
  if ((await page.locator('#obSounds [data-sound="R"]').getAttribute("aria-pressed")) !== "true") await tap(page, '#obSounds [data-sound="R"]');
  await tap(page, "#nextBtn");
  await step(page, "minutes"); await tap(page, '#obMinutes .ask-pick[data-val="5"]');
  await step(page, "updates");
  if (email) { await page.locator("#updEmail").fill(email); await tap(page, "#nextBtn"); } else await tap(page, "#updSkip");
  await step(page, "ready");
}
const leads = (requests) => requests.filter((r) => r.method === "POST" && new URL(r.url).pathname === "/api/lead").map((r) => JSON.parse(r.body || "{}"));

await scenario("a family that can buy", async () => {
  const { context, page, errors, requests } = await open(browser, base, { app: "buy", mic: "grant" });
  try {
    await toReady(page, "Mia", "mia.mom@example.com");
    ok("nothing is sent from the email step itself", leads(requests).length === 0, leads(requests));
    ok("before the price, setup shows the Fruit Slice demo (under \"Speech practice. Through play.\"), Rachel, what the child loves and their games, and no problem slide or Piano Tiles demo",
      JSON.stringify(sold) === JSON.stringify(["Speech practice. Through play.", "Built with Rachel, MS, CF-SLP,", "What does Mia love?", "Games for Mia."]) &&
      (await page.locator('[data-step="problem"]').count()) === 0, sold);
    ok("Rachel's own screen carries her line word for word, and setup ends on the ready screen with the child's name",
      rachelLine === "Built with Rachel, MS, CF-SLP, a pediatric speech-language pathologist in her clinical fellowship." &&
      (await text(page, "#readyTitle")) === "Mia's practice is ready!",
      { title: await text(page, "#readyTitle"), rachel: rachelLine });
    ok("…and nothing has asked the phone for the microphone yet", (await page.evaluate(() => window.__phone.mic.requests.length)) === 0);
    // THE PLAN MOMENT (31 Oct 2026): the ready screen says Day 1 is a game,
    // then a book: Fruit Slice first, then the talking story in Mia's sound
    ok("the ready screen's plan card says Day 1 is \"Play a game, then read a book.\": Fruit Slice first, then Robo's Rocket for a child on R, and \"A new story every day.\"",
      (await page.evaluate(() => { const c = document.getElementById("planCard"); return !c.hidden && c.dataset.story + "|" + c.dataset.game; })) === "robo|slice" &&
      (await text(page, "#planTitle")) === "Play a game, then read a book." && (await text(page, "#planLine")) === "Fruit Slice first, then Robo's Rocket." &&
      (await text(page, "#planMore")) === "A new story every day.", await text(page, "#planCard"));
    await tap(page, "#nextBtn");
    await page.waitForURL(/\/subscribe\.html\?setup=1$/, { timeout: 12000 });
    {
      const first = leads(requests), at = requests.findIndex((r) => r.method === "POST" && new URL(r.url).pathname === "/api/lead"), price = requests.findIndex((r) => new URL(r.url).pathname === "/subscribe.html");
      ok("the email step's address reaches the list once, from inside the app, before the price is asked for",
        first.length === 1 && first[0].email === "mia.mom@example.com" && first[0].source === "app-setup" && first[0].role === "parent" && at > -1 && price > at, { first, at, price });
    }
    await page.locator('#iapCard[data-state="free"]').waitFor({ timeout: 12000 });
    const card = await text(page, "#iapCard"), button = await text(page, "#iapBuy");
    ok("Continue goes to the price, while the grown-up still holds the phone: one plan, the store's own words",
      /3 days free, then \$9\.99 a month\./.test(card) && button === "Start practicing!" && !/\$59\.99|a year|yearly/i.test(card), { card, button });
    ok("…as one row (Monthly, 3-day free trial, the price), one check line, and no date anywhere",
      (await page.locator("#iapTL li").count()) === 0 && /Monthly\s+3-day free trial\s+\$9\.99\/mo/.test(card) && /No payment today · Subscription auto-renews/.test(card) && /Cancel anytime\./.test(card) && !/(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day/.test(card), card);
    ok("…and no reminder is promised anywhere on the price screen (Sona sends none yet)",
      !/\b(remind|reminder|email|e-mail|notify|notification)/i.test(await text(page, "body")), await text(page, "body"));
    const ways = { notNow: await page.locator("#declineLink").waitFor({ state: "visible", timeout: 4000 }).then(() => true, () => false), restore: await page.locator("#iapRestore").isVisible(),
      terms: await page.locator('#iapLegal a[href="/terms"]').isVisible(), privacy: await page.locator('#iapLegal a[href="/privacy"]').isVisible(), notNowLabel: await page.locator("#declineLink").getAttribute("aria-label") };
    ok("…and the small X that means \"Not now\", Restore, Terms and Privacy are all there", ways.notNow && ways.restore && ways.terms && ways.privacy && /^Not now/.test(ways.notNowLabel || ""), ways);
    await tap(page, "#iapBuy");
    await page.waitForURL(/\/onboarding\.html$/, { timeout: 12000 });
    await step(page, "mic");
    const bought = await page.evaluate(() => ({ id: localStorage.getItem("__bought"), premium: !!(window.Sona && Sona.premium && Sona.premium()), game: sessionStorage.getItem("sona.firstgame.v1") }));
    ok("starting the free days buys the MONTHLY plan and comes back to setup on the microphone screen, not a game",
      bought.id === IDS.monthly && bought.premium && !bought.game, bought);
    // no grown-ups line on setup's microphone screen since 31 Oct 2026
    // (Travis: "let's get rid of the grown-ups audio is never uploaded"): the
    // promise stays on every other mic ask, in the games and books
    ok("…whose microphone screen carries no grown-ups line about audio",
      (await page.locator("#micPromise").count()) === 0 && !/never uploaded|listen back/i.test(await text(page, '[data-step="mic"]')), await text(page, '[data-step="mic"]'));
    await tap(page, "#nextBtn");                                         // Turn on Echo's ears
    await step(page, "achieve");
    ok("the microphone is asked for after the price, then \"Hand the phone to Mia!\"",
      /Hand the phone to\s*Mia!/.test(await text(page, '[data-step="achieve"]')) && (await page.evaluate(() => window.__phone.mic.requests.length)) >= 1, await text(page, '[data-step="achieve"]'));
    ok("…which asks for no email a second time: no box, no ×",
      (await page.locator('[data-step="achieve"] input, #achEmail, #skipEmail').count()) === 0);
    {
      const all = leads(requests), plan = all.filter((l) => l.plan);
      ok("the purchase tells the list with the same address: the plan tag now works for a new family",
        all.length === 2 && plan.length === 1 && plan[0].plan === "trial" && plan[0].source === "app-trial" && plan[0].email === "mia.mom@example.com" && plan[0].role === "parent", all);
    }
    await tap(page, "#nextBtn");                                         // Let's play!
    await page.waitForURL(/\/charge\.html\?game=arcade-slice\.html$/, { timeout: 12000 });
    {
      const first = await page.evaluate(() => { const q = Sona.questToday(); return { game: sessionStorage.getItem("sona.firstgame.v1"), slice: Sona.gameAccess("slice").allowed, open: Sona.storyOpen(), q: q.kind + "|" + q.state + "|" + q.day + "|" + (q.story && q.story.id) }; });
      ok("\"Let's play!\" after the free days start opens the first game, Fruit Slice's practice page, as the plan card said, not Home or the story, and it is open",
        /\/charge\.html\?game=arcade-slice\.html$/.test(page.url()) && first.game === "slice" && first.slice === true, { url: page.url(), first });
      ok("…and Day 1's story, Robo's Rocket, waits on Home, open and unplayed (the \"then read a book\" half)",
        first.q === "story|open|1|robo" && first.open, first);
    }
    const leaked = requests.filter((r) => /t_yes|t_none|t_no|speech therapy|in therapy/i.test(r.url + " " + (r.body || "")));
    ok("the two answers the parent tapped are in no request, address or body, anywhere in the walk", leaked.length === 0, leaked.slice(0, 3));
    const named = requests.filter((r) => /\bMia\b/.test(decodeURIComponent(r.url) + " " + (r.body || "")));
    ok("…and neither is the child's name", named.length === 0, named.slice(0, 3));
    ok("a family that can buy: no page errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// THE ONE PAYMENT (22 Oct 2026): RevenueCat's offering lists it, and since
// 31 Oct 2026 it is the row on top, picked when the price opens (Travis: "I
// want to put the lifetime as the default. So put it at the top, like above
// monthly"; from 23 Oct 2026 it sat under Monthly, which was picked), with
// Monthly's free trial under it; the yearly product the offering also lists
// is not sold. A parent who taps Monthly reads its free trial; one who
// taps the button on the one payment is charged once, comes back to setup
// for the microphone and the hand-off, and the list hears "paid".
await scenario("a family that buys the one payment", async () => {
  const { context, page, errors, requests } = await open(browser, base, { app: "buy", mic: "grant", offering: "all" });
  try {
    await toReady(page, "Ava", "ava.mom@example.com");
    await tap(page, "#nextBtn");
    await page.waitForURL(/\/subscribe\.html\?setup=1$/, { timeout: 12000 });
    await page.locator('#iapLife[aria-checked="true"]').waitFor({ timeout: 12000 });
    await page.locator('#iapCard[data-state="paid"]').waitFor({ timeout: 4000 });
    const rows = await page.evaluate(() => ["iapLife", "iapYear", "iapPlan"].map((id) => { const e = document.getElementById(id); return e && !e.hidden ? [id, e.getAttribute("aria-checked"), e.innerText.replace(/\s+/g, " ").trim()] : null; }));
    ok("the price has two rows, Lifetime on top and picked with its short copy and store price, Monthly under it, no yearly row",
      !!rows[0] && rows[1] === null && !!rows[2] && rows[0][1] === "true" && rows[2][1] === "false" &&
      (await text(page, "#iapLifeName")) === "Lifetime" && (await text(page, "#iapLifeLine")) === "Yours Forever" &&
      (await text(page, "#iapLifeTag")) === "Best Value" && /\$59\.99/.test(rows[0][2]) && /Billed today/.test(rows[0][2]) && /3-day free trial/.test(rows[2][2]) &&
      await page.evaluate(() => document.getElementById("iapLife").getBoundingClientRect().bottom <= document.getElementById("iapPlan").getBoundingClientRect().top), rows);
    ok("…as it opens, the one payment: \"Start practicing!\", and the small print says one payment, no subscription",
      (await text(page, "#iapBuy")) === "Start practicing!" && /One payment of \$59\.99\. No subscription\./.test(await text(page, "#iapCard")) && !/No payment today/.test(await text(page, "#iapCard")), await text(page, "#iapCard"));
    await tap(page, "#iapPlan");
    await page.locator('#iapCard[data-state="free"]').waitFor({ timeout: 4000 });
    ok("…a tap on Monthly: its free trial, \"No payment today\" over the button",
      /No payment today/.test(await text(page, "#iapCard")) && (await text(page, "#iapBuy")) === "Start practicing!", await text(page, "#iapCard"));
    await tap(page, "#iapLife");
    await page.locator('#iapCard[data-state="paid"]').waitFor({ timeout: 4000 });
    ok("…and a tap back on Lifetime: \"Start practicing!\" again", (await text(page, "#iapBuy")) === "Start practicing!", await text(page, "#iapBuy"));
    await tap(page, "#iapBuy");
    await page.waitForURL(/\/onboarding\.html$/, { timeout: 12000 });
    await step(page, "mic");
    const bought = await page.evaluate(() => ({ id: localStorage.getItem("__bought"), premium: !!(window.Sona && Sona.premium && Sona.premium()), game: sessionStorage.getItem("sona.firstgame.v1") }));
    ok("it buys the one-payment product and comes back to setup on the microphone screen", bought.id === IDS.lifetime && bought.premium && !bought.game, bought);
    await tap(page, "#nextBtn");
    await step(page, "achieve");
    await tap(page, "#nextBtn");
    await page.waitForURL(/\/charge\.html\?game=arcade-slice\.html$/, { timeout: 12000 });
    ok("…then the first game, Fruit Slice, for a one-payment buyer too (31 Oct 2026), and open to the child",
      await page.evaluate(() => sessionStorage.getItem("sona.firstgame.v1") === "slice" && Sona.gameAccess("slice").allowed), page.url());
    const all = leads(requests), plan = all.filter((l) => l.plan);
    ok("…and the list hears \"paid\" for the same address, never a trial", plan.length === 1 && plan[0].plan === "paid" && plan[0].source === "app-paid" && plan[0].email === "ava.mom@example.com", all);
    ok("…with nothing about the child in any request", !requests.some((r) => /\bAva\b/.test(decodeURIComponent(r.url) + " " + (r.body || ""))));
    ok("a family that buys the one payment: no page errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

await scenario("Not now", async () => {
  const { context, page, errors, requests } = await open(browser, base, { app: "buy", mic: "grant" });
  try {
    await toReady(page, "Ben", "ben.dad@example.com");
    await tap(page, "#nextBtn");
    await page.waitForURL(/\/subscribe\.html\?setup=1$/, { timeout: 12000 });
    await page.locator('#iapCard[data-state="free"]').waitFor({ timeout: 12000 });
    await tap(page, "#declineLink");
    await page.waitForURL(/\/today\.html$/, { timeout: 12000 });
    const st = await page.evaluate(() => ({ mic: window.__phone.mic.requests.length, marker: sessionStorage.getItem("sona.setupafter.v1"), bought: localStorage.getItem("__bought"), premium: !!Sona.premium(), slice: Sona.gameAccess("slice").allowed }));
    ok("\"Not now\" goes Home with nothing bought, no microphone ask, no hand-off waiting, and the games locked",
      st.mic === 0 && !st.marker && !st.bought && !st.premium && st.slice === false, st);
    const sent = leads(requests);
    ok("…and the email given before the price still reached the list, once, with nothing about the child",
      sent.length === 1 && sent[0].email === "ben.dad@example.com" && sent[0].source === "app-setup" && !sent[0].plan &&
      !requests.some((r) => /\bBen\b/.test(decodeURIComponent(r.url) + " " + (r.body || ""))), sent);
    ok("Not now: no page errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

await scenario("a phone that cannot buy", async () => {
  const { context, page, errors, requests } = await open(browser, base, { mic: "grant" });   // a browser: the website does not sell
  try {
    await toReady(page, "Zoe");
    // a phone that shows no story (the game of the day, not a locked story)
    // still has Day 1's card: Fruit Slice, then a book (the free one), and no
    // promise of a story a day
    ok("with no story shown on this phone, the plan card still says Day 1: \"Fruit Slice first, then a book.\", with no \"A new story every day.\"",
      (await page.evaluate(() => { const c = document.getElementById("planCard"); return !c.hidden && document.getElementById("planMore").hidden && c.dataset.story + "|" + c.dataset.game; })) === "|slice" &&
      (await text(page, "#planTitle")) === "Play a game, then read a book." && (await text(page, "#planLine")) === "Fruit Slice first, then a book.", await text(page, "#planCard"));
    await tap(page, "#nextBtn");
    await step(page, "mic");
    ok("with nothing to sell, Continue goes on in the page to the microphone: the price page is never asked for",
      !requests.some((r) => /subscribe\.html/.test(r.url)) && /\/onboarding\.html$/.test(page.url()), page.url());
    await tap(page, "#nextBtn");
    await step(page, "achieve");
    await tap(page, "#nextBtn");
    await page.waitForURL(/\/charge\.html\?game=arcade-slice\.html$/, { timeout: 12000 });
    ok("…then the hand-off and the first game, Fruit Slice, which the free version opens",
      /arcade-slice/.test(page.url()) && await page.evaluate(() => sessionStorage.getItem("sona.firstgame.v1") === "slice" && Sona.gameAccess("slice").allowed), page.url());
    ok("a phone that cannot buy: no page errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

await browser.close(); await close();
console.log(failures ? "\n" + failures + " FAILURES of " + assertions : "\nALL GREEN — " + assertions + " assertions");
process.exit(failures ? 1 : 0);

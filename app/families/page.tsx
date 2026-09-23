import type { CSSProperties } from "react";
import { FREE_MODE } from "@/lib/pricing";
import { charterSpots, CHARTER_PRICE, STANDARD_PRICE, CHARTER_PER_MONTH, STANDARD_PER_MONTH, CHARTER_CAP, CHARTER_LABEL, type Spots } from "@/lib/charter";

/**
 * Sona — R-sound marketing landing page (web-first funnel).
 *
 * THIS FILE IS SWITCH-DRIVEN. `FREE_MODE` (lib/pricing.ts, mirroring sona.js)
 * decides every line that differs between a paid era and a free era: the CTA
 * target and label, the hero subline, the pricing section, the cost FAQ, the
 * final CTA, the sticky bar, the ad pixel and the meta description. BOTH sets
 * of copy live here, side by side, permanently. The price has flipped eleven
 * times in seven weeks and twice this page had to be rebuilt from scratch
 * because whoever flipped it deleted the half they were leaving. Flip the
 * boolean — do not rewrite copy, and do not delete the branch you are not in.
 *
 * Meta-ad parents of kids 4–9 on the R sound, 90%+ on phones. Mobile-first
 * single column, centered on desktop. Design: "Sunrise Storybook" handoff
 * (README + Sona Landing Redesign.dc.html).
 *
 * Copy rule (Rachel is an SLP): "practice"/"coach" only — never
 * therapy/treatment/diagnosis. Camera never used; audio never leaves the
 * device; no child's name ever reaches an ad pixel.
 */

const CREAM = "#fff6e9", INK = "#4a2c14", MUTED = "#8a6f52", LINE = "#f0e2cc";
const B = "'Baloo 2', system-ui, sans-serif"; // display

/* ---------- everything the switch decides ---------- */

// Paid: GET /api/checkout 303s straight to Stripe (annual by default) — no
// client JS, so it survives ad-blockers and cold Meta traffic.
// Free: /api/checkout REFUSES (410 on POST, 303 back to "/" on GET). A CTA
// still aimed at it would be a dead button that bounces the visitor onto the
// page they just tapped away from, so the free CTAs open the app instead.
const CTA_HREF = FREE_MODE ? "/onboarding.html" : "/api/checkout";
const CTA_LABEL = FREE_MODE ? "Start practicing — free" : "Start 3 days free";

// THIS IS COPY, NOT THE PRICE. app/api/checkout/route.ts's PLANS holds the
// cents Stripe actually charges; if that moves, this moves in the same commit,
// on every surface. $59.99 / 12 = $4.9991, which is why the copy reads "under
// $5 a month" and never "$4.99 a month": the rounded figure implies $59.88 a
// year and is not true. Do not swap one in.
// ONE PLAN as of 18 Sep 2026. $119.88 and "save $59.89" are gone with the
// monthly tier: both existed ONLY as 12 x $9.99, so with no monthly plan to
// compare against, a struck-through price would be an anchor against a number
// nobody can buy. "Under $5 a month" survives because it is just $59.99 / 12
// ($4.9991) — true with no second plan in sight, and never written as "$4.99".
// THE PRICE IS NOT A CONSTANT ANY MORE — it is whichever tier the next buyer
// will actually be charged, read from the same count /api/checkout reads. The
// charter price for the first fifty families, then the standard price. A
// page that said one and a checkout that charged the other would be the
// bait-and-switch this file spent a paragraph refusing to commit with the
// old struck-through $119.88.
const YEARLY = CHARTER_PRICE;   // the launch-era default; PricingPaid renders from `spots`

// Ad-funnel signal. Paid: a checkout really is starting, so InitiateCheckout
// is honest; the value is the ANNUAL price — a monthly tap reports 59.99 too,
// which over-states that one click, but annual is what the ads optimise for
// and splitting the signal by plan is not worth a second listener. Free:
// nothing is sold, so InitiateCheckout/$59.99 would be a lie to the ad
// platform as well as to the parent — the signal that matters is the app
// being opened. Neither payload carries a child's name.
const TRACKER = FREE_MODE
  ? `document.addEventListener("click",function(e){var a=e.target&&e.target.closest?e.target.closest('a[href^="/onboarding.html"]'):null;if(!a)return;try{if(window.SonaAnalytics)window.SonaAnalytics.track("landing cta",{surface:"landing"});}catch(err){}},true);`
  : `document.addEventListener("click",function(e){var a=e.target&&e.target.closest?e.target.closest('a[href^="/api/checkout"]'):null;if(!a)return;try{if(window.sonaTrack)window.sonaTrack("InitiateCheckout",{value:59.99,currency:"USD",content_name:"web_annual"});}catch(err){}try{if(window.SonaAnalytics)window.SonaAnalytics.track("paywall viewed",{surface:"landing"});}catch(err){}},true);`;

// THIS IS /families NOW, not the root. speaksona.com is the clinician page
// (Travis, 22 Sep 2026: SLPs are the channel), and this page moved rather than
// being rewritten so that every purchase surface keeps BOTH pricing states —
// the switch has flipped eleven times and hand-editing a price into a page is
// the one thing CLAUDE.md forbids. A family reaching Sona directly lands here;
// a family reaching it through their SLP never sees it at all.
export const metadata = {
  title: "Sona — R-sound practice kids actually love",
  description: FREE_MODE
    ? "Still saying “wabbit” instead of rabbit? Sona turns daily R practice into a game kids ask to play — built with a licensed pediatric speech-language pathologist. Free right now: every game, every sound, no card."
    : "Still saying “wabbit” instead of rabbit? Sona turns daily R practice into a game kids ask to play — built with a licensed pediatric speech-language pathologist. 3 days free, then $59.99/yr — under $5 a month.",
};

/* ---------- shared bits ---------- */
function Parrot({ s }: { s: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 120 120" aria-hidden>
      <rect x="0" y="62" width="38" height="13" rx="6.5" fill="#1cb0f6" transform="rotate(-34 19 68)" />
      <rect x="-2" y="76" width="36" height="13" rx="6.5" fill="#58cc02" transform="rotate(-14 16 82)" />
      <rect x="54" y="8" width="13" height="24" rx="6.5" fill="#ffd21c" transform="rotate(16 60 20)" />
      <circle cx="62" cy="66" r="38" fill="#ff8a3d" />
      <ellipse cx="54" cy="82" rx="20" ry="17" fill="#fff6e9" />
      <ellipse cx="40" cy="70" rx="13" ry="20" fill="#58cc02" transform="rotate(16 40 70)" />
      <circle cx="78" cy="54" r="14" fill="#fff" />
      <circle cx="80" cy="56" r="6" fill="#4a2c14" />
      <circle cx="82.5" cy="53.5" r="2.2" fill="#fff" />
      <path d="M92 58 C106 56 113 65 106 74 C100 81 90 78 87 70 Z" fill="#ffd21c" />
      <path d="M89 74 C94 80 101 81 105 77 C102 85 90 86 86 77 Z" fill="#e0b000" />
      <circle cx="48" cy="46" r="4" fill="#fff" opacity="0.9" />
    </svg>
  );
}
function Check({ s = 16 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 20 20" style={{ flex: "none", marginTop: 2 }} aria-hidden>
      <circle cx="10" cy="10" r="9" fill="#58cc02" />
      <path d="M6 10.5 L9 13.5 L14.5 7.5" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function StarBadge({ s = 40 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 48 48" aria-hidden>
      <rect x="15" y="26" width="7" height="16" rx="3.5" fill="#e0b000" transform="rotate(-16 18.5 34)" />
      <rect x="26" y="26" width="7" height="16" rx="3.5" fill="#e0b000" transform="rotate(16 29.5 34)" />
      <circle cx="24" cy="18" r="14" fill="#ffd21c" />
      <path d="M18 18.5 L22.5 23 L30.5 13.5" stroke="#4a2c14" strokeWidth="3.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="18" cy="12" r="2.4" fill="#fff" />
    </svg>
  );
}
function Mic({ s = 42 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 48 48" style={{ flex: "none" }} aria-hidden>
      <rect x="17" y="4" width="14" height="25" rx="7" fill="#1cb0f6" />
      <path d="M10 24 a14 14 0 0 0 28 0" stroke="#0d8ecc" strokeWidth="5" fill="none" strokeLinecap="round" />
      <rect x="21.25" y="38" width="5.5" height="7" rx="2.75" fill="#0d8ecc" />
      <circle cx="21" cy="9" r="2.4" fill="#fff" />
    </svg>
  );
}
function CtaButton({ label = CTA_LABEL, big = true }: { label?: string; big?: boolean }) {
  return (
    <a
      href={CTA_HREF}
      style={{
        display: "block", textAlign: "center", textDecoration: "none",
        background: "#ff8a3d", color: "#fff",
        font: `700 ${big ? 19 : 16}px ${B}`,
        padding: big ? 16 : "13px 16px", borderRadius: 22,
        boxShadow: "0 5px 0 #ef6f23",
      }}
    >
      {label}
    </a>
  );
}
const card: CSSProperties = { background: "#fff", borderRadius: 22, boxShadow: `0 5px 0 ${LINE}` };
const kicker = (color: string): CSSProperties => ({ font: `700 11.5px 'Nunito', sans-serif`, letterSpacing: 1.8, color, marginBottom: 8 });
const h2: CSSProperties = { margin: "0 0 16px", font: `800 26px/1.15 ${B}` };
const priceCard: CSSProperties = { background: "#fff", border: `3px solid ${INK}`, borderRadius: 26, boxShadow: `0 7px 0 ${INK}`, padding: "22px 20px" };
const priceBadge: CSSProperties = { display: "inline-flex", background: "#ffd21c", color: INK, font: `800 11px ${B}`, letterSpacing: 1.2, padding: "5px 12px", borderRadius: 999, boxShadow: "0 3px 0 #e0b000", marginBottom: 12 };
const stepRow: CSSProperties = { display: "flex", gap: 6, justifyContent: "space-between", margin: "14px 0 10px" };
const footNote: CSSProperties = { textAlign: "center", fontSize: 11.5, fontWeight: 700, color: MUTED };

function Steps({ steps }: { steps: [string, string][] }) {
  return (
    <div style={stepRow}>
      {steps.map(([n, t]) => (
        <div key={n} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 800, color: MUTED }}>
          <div style={{ width: 17, height: 17, borderRadius: "50%", background: INK, color: CREAM, font: `800 10px ${B}`, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{n}</div>{t}
        </div>
      ))}
    </div>
  );
}
function Perks({ items }: { items: string[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 18 }}>
      {items.map((t) => (
        <div key={t} style={{ display: "flex", gap: 9, fontSize: 14, fontWeight: 700 }}><Check />{t}</div>
      ))}
    </div>
  );
}

/* ---------- 5 — the pricing section, both eras ----------
   Two cards, one switch. The structure genuinely differs (a yearly hero with a
   struck-through comparison and a saving block has no free equivalent), so
   they are two named blocks rather than one tree full of ternaries. KEEP BOTH.
   Whichever era this repo is in today, the other one is one boolean away. */

function PricingPaid({ spots }: { spots: Spots }) {
  const open = spots.open;
  const price = open ? CHARTER_PRICE : STANDARD_PRICE;
  const perMonth = open ? CHARTER_PER_MONTH : STANDARD_PER_MONTH;
  // The spots-left number is printed only when it came from Stripe. A
  // fallback count is a guess, and a guessed scarcity number is the one thing
  // this page must never show.
  const showLeft = open && spots.source === "stripe";
  return (
    <>
      <div style={priceCard}>
        <div style={priceBadge}>{open ? `3 DAYS FREE · ${CHARTER_LABEL.toUpperCase()} PRICE` : "3 DAYS FREE · EVERYTHING INCLUDED"}</div>
        {open && (
          // Explicit words, not a bare strike-through: the standard price is
          // what spot fifty-one pays, and /api/checkout enforces it.
          <div style={{ fontSize: 13, fontWeight: 800, color: MUTED, marginTop: 10 }}>
            Regular price <s>{STANDARD_PRICE}/yr</s> · {CHARTER_LABEL} price for the first {CHARTER_CAP} families
            {showLeft ? ` · ${spots.left} spot${spots.left === 1 ? "" : "s"} left` : ""}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <div style={{ font: `800 52px/1 ${B}` }}>{price}</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: MUTED }}>/year</div>
        </div>
        {/* With one plan there is nothing to compare against, so the block
            carries the per-month reading instead of a saving. It is the same
            arithmetic a parent can do in their head — $59.99 over twelve
            months — and it is the only claim here that is not a price. */}
        <div style={{ background: "#f2fbe4", border: "2px solid #58cc02", borderRadius: 16, padding: "11px 13px", margin: "12px 0 14px" }}>
          <div style={{ font: `800 19px ${B}`, color: "#46a302" }}>{perMonth[0].toUpperCase() + perMonth.slice(1)}</div>
          <div style={{ fontSize: 12.5, lineHeight: 1.45, fontWeight: 700, color: INK, marginTop: 3 }}>One plan, billed once a year. Nothing is charged for the first 3 days.</div>
        </div>
        <Perks items={["Every game, every sound — full access from minute one", "3 days free — nothing charged before day 3", "Every new sound included as it ships", "Works on iPhone and iPad"]} />
        <CtaButton />
        <Steps steps={[["1", "Start 3 days free"], ["2", "Get 6-letter code"], ["3", "Download & play"]]} />
        <div style={footNote}>Secure checkout by Stripe · iPhone &amp; iPad</div>
      </div>
      {/* Families who arrived during a free era keep it free — a grandfather
          sweep ships with every return to pricing. This line is only true
          while that sweep exists: per CLAUDE.md the NEXT return to pricing
          needs _grandfatherFreeEra4() written first, and if it ever isn't,
          this sentence is the false claim, not the code. */}
      <div style={{ textAlign: "center", fontSize: 12, lineHeight: 1.5, fontWeight: 700, color: MUTED, marginTop: 14 }}>Already practicing with Sona while it was free? It stays free for you — nothing to pay, nothing to do.</div>
    </>
  );
}

function PricingFree() {
  // No promise of permanence and no promise about what happens if pricing
  // returns. Both have been printed on this page before and both turned out
  // false. It is free now; that is the whole claim.
  return (
    <div style={priceCard}>
      <div style={priceBadge}>FREE · EVERY GAME, EVERY SOUND</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <div style={{ font: `800 52px/1 ${B}` }}>Free</div>
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: MUTED, margin: "4px 0 16px" }}>Every game, every sound and the Sound Check. No card, no trial, nothing to cancel.</div>
      <Perks items={["Every game, every sound — full access from minute one", "No card, no trial to remember", "Every new sound included as it ships", "Works on iPhone and iPad"]} />
      <CtaButton />
      <Steps steps={[["1", "Open Sona"], ["2", "Pick your sound"], ["3", "Play today's games"]]} />
      <div style={footNote}>Works in any browser · iPhone &amp; iPad</div>
    </div>
  );
}

export default async function Landing() {
  // one Stripe read per render (memoised a minute); the page is no-store, so
  // this is the truth at the moment the parent is looking at it
  const spots: Spots = FREE_MODE
    ? { cap: CHARTER_CAP, taken: 0, left: 0, open: false, source: "fallback", at: Date.now() }
    : await charterSpots();
  const priceNow = spots.open ? CHARTER_PRICE : STANDARD_PRICE;
  const perMonthNow = spots.open ? CHARTER_PER_MONTH : STANDARD_PER_MONTH;
  const heroSubline = FREE_MODE ? (
    <>Free — every game, every sound. No card, no trial, nothing to cancel.</>
  ) : (
    <>3 days free, then {priceNow}/yr — {perMonthNow}. Cancel anytime.</>
  );
  const finalPriceLine = FREE_MODE ? (
    <><span style={{ color: INK, font: `800 20px ${B}` }}>Free</span> — every game, every sound</>
  ) : (
    <><span style={{ color: INK, font: `800 20px ${B}` }}>{priceNow}/yr</span> after 3 free days — {perMonthNow}</>
  );
  const finalFootnote = FREE_MODE
    ? "No card · No trial · Nothing to cancel"
    : "3 days free · Under $5 a month · Cancel anytime";
  const stickyTitle = FREE_MODE ? "Free to play" : "Start 3 days free";
  const stickySub = FREE_MODE ? "every game, every sound" : `${priceNow}/yr — ${perMonthNow}`;
  const faq: [string, string][] = [
    ["Does Sona replace working with an SLP?", "No — it's daily practice designed by one. If your child already sees a speech professional, Sona is the between-sessions coach that makes each visit count."],
    [
      "What does it cost?",
      FREE_MODE
        ? "Nothing. Every game, every sound and the Sound Check are free right now — there is no card to enter and no trial running out."
        : `${priceNow} a year — ${perMonthNow} — starting with 3 free days: nothing is charged before day 3, and only if you keep it. One plan, everything included, cancel anytime.`,
    ],
    [
      "What do I need to start?",
      FREE_MODE
        ? "An iPhone, iPad or any browser. Open Sona, pick your child's sound, and you're playing in minutes."
        : "An iPhone or iPad. After checkout you get a 6-letter code — enter it in the app and you're playing in minutes.",
    ],
    ["My kid is 4 — too young?", "Sona is built for ages 4–9. Exercises adapt from first tries at the sound all the way to tricky words like “squirrel.”"],
  ];

  return (
    <main style={{ background: CREAM, color: INK, minHeight: "100vh", overflowX: "hidden" }}>
      {/* Native shell opens the app, never this pricing page (Apple 3.1.1). */}
      <script
        dangerouslySetInnerHTML={{
          __html: `if(typeof window!=="undefined"&&window.Capacitor){var p={};try{p=JSON.parse(localStorage.getItem("sona.profile.v1")||"{}")}catch(e){}location.replace((p.onboarded||p.childName)?"/today.html":"/onboarding.html");}`,
        }}
      />
      {/* Founding link (/?ff=<code>) forwards into onboarding for server-side validation. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `if(typeof window!=="undefined"&&!window.Capacitor){var m=location.search.match(/[?&]ff=([A-Za-z0-9-]{2,24})/);if(m){location.replace("/onboarding.html?ff="+m[1]);}}`,
        }}
      />
      {/* Ad-funnel signal — see TRACKER above; it follows the switch too. */}
      <script dangerouslySetInnerHTML={{ __html: TRACKER }} />

      {/* one centered column on every device (mobile source of truth) */}
      <div style={{ maxWidth: 460, margin: "0 auto", paddingBottom: 92 }}>

        {/* 1 — HOOK */}
        <section style={{ padding: "24px 20px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 22 }}>
            <Parrot s={34} />
            <span style={{ font: `800 22px ${B}`, letterSpacing: 0.2 }}>sona</span>
            <span style={{ font: `800 10px ${B}`, letterSpacing: 1.2, background: "#ffd21c", color: INK, padding: "3px 9px", borderRadius: 999, boxShadow: "0 2px 0 #e0b000" }}>BETA</span>
          </div>
          <h1 style={{ margin: "0 0 12px", font: `800 37px/1.08 ${B}` }}>
            Still saying <span style={{ color: "#ef6f23" }}>&ldquo;wabbit&rdquo;</span> instead of rabbit?
          </h1>
          <p style={{ margin: "0 0 18px", fontSize: 15.5, lineHeight: 1.55, fontWeight: 600, color: MUTED }}>
            R is the hardest sound in English — and speech-therapy waitlists run months. Sona turns daily R practice into a game your kid asks to play.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 20 }}>
            <CtaButton />
            <div style={{ textAlign: "center", fontSize: 12.5, fontWeight: 700, color: MUTED }}>{heroSubline}</div>
          </div>
          {/* R-detection demo card */}
          <div style={{ background: "#fff", borderRadius: 24, boxShadow: `0 5px 0 ${LINE}`, padding: "16px 18px", display: "flex", gap: 14, alignItems: "center" }}>
            <div style={{ flex: "none" }}><Parrot s={96} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ font: `700 15px 'Nunito', sans-serif`, color: MUTED }}><s>&ldquo;wabbit&rdquo;</s></div>
              <div style={{ font: `800 24px ${B}`, margin: "2px 0 8px" }}>&ldquo;rabbit!&rdquo;</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 22, marginBottom: 8 }}>
                {[8, 16, 22, 12, 18, 9, 14].map((h, i) => (
                  <div key={i} style={{ width: 5, height: h, borderRadius: 3, background: h >= 18 ? "#0d8ecc" : "#1cb0f6" }} />
                ))}
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#58cc02", color: "#fff", font: `800 11.5px 'Nunito', sans-serif`, padding: "5px 10px", borderRadius: 999, boxShadow: "0 3px 0 #46a302" }}>
                <svg width="12" height="12" viewBox="0 0 20 20" aria-hidden><path d="M4 10.5 L8.5 15 L16 6" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                R detected · +1 rep
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", borderRadius: 999, padding: "6px 12px", boxShadow: `0 3px 0 ${LINE}`, fontSize: 11.5, fontWeight: 800 }}><StarBadge s={14} />Built with a licensed SLP</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", borderRadius: 999, padding: "6px 12px", boxShadow: `0 3px 0 ${LINE}`, fontSize: 11.5, fontWeight: 800 }}><Mic s={14} />Really hears every rep</span>
          </div>
        </section>

        {/* 2 — CREDIBILITY */}
        <section style={{ background: "#fff", padding: "30px 20px" }}>
          <div style={kicker("#46a302")}>THE COACH BEHIND IT</div>
          <h2 style={h2}>Built with a licensed pediatric speech-language pathologist</h2>
          <div style={{ background: CREAM, borderRadius: 24, padding: 18, position: "relative" }}>
            <div style={{ position: "absolute", top: 14, right: 14 }}><StarBadge s={40} /></div>
            <div style={{ font: `700 17px ${B}`, marginBottom: 10, paddingRight: 46 }}>Designed by a licensed pediatric SLP — not an algorithm</div>
            <p style={{ margin: "0 0 14px", fontSize: 14.5, lineHeight: 1.55, fontWeight: 600 }}>
              A licensed speech-language pathologist designed every game, cue, and level in Sona — the same step-by-step R practice used with kids 4–9, without the waitlist.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Rachel holds an Idaho CF licence (confirmed by Travis, 1 Sep 2026), so
                  "licensed speech-language pathologist" is TRUE and is used across the
                  app. She is a Clinical Fellow (master's complete, supervised year in
                  progress); since 23 Sep 2026 the copy says "licensed" without the
                  fellowship, on Travis's call, and never implies more. What must NEVER come back is the CCC: that is ASHA's
                  certification, she does not hold it, and "board-certified (CCC-SLP)"
                  shipped once on this very page as a checkable false claim about a
                  trademarked credential. Pinned in iaptest.mjs. */}
              {["Licensed speech-language pathologist", "Specializes in kids ages 4–9", "Reviews every exercise before it ships"].map((t) => (
                <div key={t} style={{ display: "flex", gap: 8, fontSize: 13.5, fontWeight: 700 }}><Check />{t}</div>
              ))}
            </div>
          </div>
        </section>

        {/* 3 — HOW IT WORKS */}
        <section style={{ padding: "30px 20px" }}>
          <div style={kicker("#ef6f23")}>HOW SONA WORKS</div>
          <h2 style={h2}>Ten minutes a day, really heard</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ ...card, padding: "16px 18px", display: "flex", gap: 14 }}>
              <svg width="42" height="42" viewBox="0 0 48 48" style={{ flex: "none" }} aria-hidden><rect x="3" y="12" width="42" height="27" rx="13.5" fill="#ff8a3d" /><rect x="10" y="21" width="15" height="5.5" rx="2.75" fill="#ef6f23" /><rect x="14.75" y="16.25" width="5.5" height="15" rx="2.75" fill="#ef6f23" /><circle cx="33" cy="21" r="3.4" fill="#ef6f23" /><circle cx="38.5" cy="27" r="3.4" fill="#ef6f23" /><circle cx="11" cy="17" r="2.4" fill="#fff" /></svg>
              <div><div style={{ font: `700 17px ${B}`, marginBottom: 3 }}>Games they ask to play</div><div style={{ fontSize: 13.5, lineHeight: 1.5, fontWeight: 600, color: MUTED }}>Short, silly missions with Echo the parrot. Stars for every strong R — ten minutes feels like recess, not homework.</div></div>
            </div>
            <div style={{ ...card, padding: "16px 18px", display: "flex", gap: 14 }}>
              <Mic s={42} />
              <div><div style={{ font: `700 17px ${B}`, marginBottom: 3 }}>Silence never counts</div><div style={{ fontSize: 13.5, lineHeight: 1.5, fontWeight: 600, color: MUTED }}>Real voice detection listens to every rep and scores it on the spot. If Sona counts it, your child actually said it.</div></div>
            </div>
            <div style={{ ...card, padding: "16px 18px", display: "flex", gap: 14 }}>
              <svg width="42" height="42" viewBox="0 0 48 48" style={{ flex: "none" }} aria-hidden><rect x="6" y="27" width="9.5" height="15" rx="4.5" fill="#58cc02" /><rect x="19.25" y="17" width="9.5" height="25" rx="4.75" fill="#46a302" /><rect x="32.5" y="7" width="9.5" height="35" rx="4.75" fill="#58cc02" /><circle cx="35.5" cy="11.5" r="2.4" fill="#fff" /></svg>
              <div style={{ flex: 1 }}>
                <div style={{ font: `700 17px ${B}`, marginBottom: 3 }}>Progress you can actually see</div>
                <div style={{ fontSize: 13.5, lineHeight: 1.5, fontWeight: 600, color: MUTED, marginBottom: 10 }}>Weekly rep counts and a sound-by-sound report on your phone. Know it&apos;s working instead of hoping.</div>
                <div style={{ background: CREAM, borderRadius: 14, padding: "10px 12px" }}>
                  <div style={{ font: `800 13px ${B}`, marginBottom: 6 }}>214 reps this week</div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 34 }}>
                    {[35, 55, 40, 70, 50, 100, 62].map((h, i) => (
                      <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: 5, background: h === 100 ? "#46a302" : "#58cc02" }} />
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 4, font: `700 9px 'Nunito', sans-serif`, color: MUTED }}>
                    {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (<div key={i} style={{ flex: 1, textAlign: "center" }}>{d}</div>))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4 — ROADMAP */}
        <section style={{ padding: "6px 20px 30px" }}>
          <div style={{ ...card, borderRadius: 24, padding: "20px 18px", textAlign: "center" }}>
            <h3 style={{ margin: "0 0 14px", font: `800 22px/1.2 ${B}` }}>R today. The whole alphabet on the way.</h3>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center", marginBottom: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, background: "#ff8a3d", boxShadow: "0 4px 0 #ef6f23", color: "#fff", font: `800 26px ${B}`, display: "flex", alignItems: "center", justifyContent: "center" }}>R</div>
              {["S", "L", "TH", "CH"].map((l) => (
                <div key={l} style={{ width: 44, height: 44, borderRadius: 14, background: CREAM, outline: "2px solid #efe0c8", color: MUTED, font: `800 ${l.length > 1 ? 16 : 20}px ${B}`, display: "flex", alignItems: "center", justifyContent: "center" }}>{l}</div>
              ))}
              <div style={{ font: `800 18px ${B}`, color: MUTED }}>…Z</div>
            </div>
            {/* "in your plan" has nothing to point at while there is no plan. */}
            <p style={{ margin: "0 0 12px", fontSize: 13.5, lineHeight: 1.5, fontWeight: 600, color: MUTED }}>{FREE_MODE ? "Every new sound lands in the app the day it ships — never an add-on." : "Every new sound is included in your plan the day it ships — never an add-on."}</p>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#ffd21c", color: INK, font: `800 11.5px 'Nunito', sans-serif`, padding: "6px 12px", borderRadius: 999, boxShadow: "0 3px 0 #e0b000" }}>All sounds included</div>
          </div>
        </section>

        {/* 5 — PRICING (switch-driven: see the block comment above PricingPaid) */}
        <section id="pricing" style={{ background: "#fff", padding: "30px 20px" }}>
          {FREE_MODE ? <PricingFree /> : <PricingPaid spots={spots} />}
        </section>

        {/* 6 — SAFETY */}
        <section style={{ background: INK, padding: "28px 20px", color: CREAM }}>
          <h3 style={{ margin: "0 0 16px", font: `800 21px ${B}` }}>Kid-safe by design</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <svg width="36" height="36" viewBox="0 0 48 48" style={{ flex: "none" }} aria-hidden><rect x="4" y="13" width="29" height="23" rx="7" fill="#1cb0f6" /><path d="M33 20 L43 14 V35 L33 29 Z" fill="#0d8ecc" /><circle cx="18" cy="24.5" r="7" fill="#0d8ecc" /><circle cx="18" cy="24.5" r="3" fill="#1cb0f6" /><rect x="21" y="-4" width="6" height="56" rx="3" fill="#fff6e9" transform="rotate(42 24 24)" /><circle cx="11" cy="18" r="2.4" fill="#fff" /></svg>
              <div><div style={{ font: `700 15.5px ${B}` }}>No camera, ever</div><div style={{ fontSize: 12.5, lineHeight: 1.5, fontWeight: 600, opacity: 0.7 }}>Sona only listens during practice, with your permission.</div></div>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <svg width="36" height="36" viewBox="0 0 48 48" style={{ flex: "none" }} aria-hidden><rect x="11" y="3" width="24" height="42" rx="7" fill="#58cc02" /><rect x="16" y="9" width="14" height="24" rx="4" fill="#46a302" /><rect x="19" y="36.5" width="8" height="4" rx="2" fill="#46a302" /><rect x="27" y="20" width="16" height="13" rx="4" fill="#ffd21c" /><path d="M31 20 v-3 a4 4 0 0 1 8 0 v3" stroke="#e0b000" strokeWidth="3.4" fill="none" /><circle cx="16" cy="7" r="2.2" fill="#fff" /></svg>
              <div><div style={{ font: `700 15.5px ${B}` }}>Recordings stay on the device</div><div style={{ fontSize: 12.5, lineHeight: 1.5, fontWeight: 600, opacity: 0.7 }}>Practice audio is scored and stored right on your phone — it never leaves it.</div></div>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <svg width="36" height="36" viewBox="0 0 48 48" style={{ flex: "none" }} aria-hidden><path d="M9 19 L28 10 V38 L9 29 Z" fill="#ff8a3d" /><rect x="4" y="18" width="7" height="12" rx="3" fill="#ef6f23" /><path d="M32 17 a9.5 9.5 0 0 1 0 14" stroke="#ef6f23" strokeWidth="4.5" fill="none" strokeLinecap="round" /><rect x="21" y="-4" width="6" height="56" rx="3" fill="#fff6e9" transform="rotate(42 24 24)" /><circle cx="13" cy="17" r="2.4" fill="#fff" /></svg>
              <div><div style={{ font: `700 15.5px ${B}` }}>No ads inside</div><div style={{ fontSize: 12.5, lineHeight: 1.5, fontWeight: 600, opacity: 0.7 }}>Nothing to watch, click, or buy mid-game. Ever.</div></div>
            </div>
          </div>
        </section>

        {/* 7 — FAQ */}
        <section style={{ padding: "30px 20px 10px" }}>
          <h3 style={{ margin: "0 0 14px", font: `800 22px ${B}` }}>Quick answers</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {faq.map(([q, a]) => (
              <div key={q} style={{ background: "#fff", borderRadius: 18, boxShadow: `0 4px 0 ${LINE}`, padding: "14px 16px" }}>
                <div style={{ font: `700 15px ${B}`, marginBottom: 4 }}>{q}</div>
                <div style={{ fontSize: 13, lineHeight: 1.5, fontWeight: 600, color: MUTED }}>{a}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 8 — FINAL CTA */}
        <section style={{ padding: "34px 20px 26px", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center" }}><Parrot s={76} /></div>
          <h2 style={{ margin: "8px 0 6px", font: `800 30px/1.1 ${B}` }}>Ready to hear that R?</h2>
          <div style={{ fontSize: 14, fontWeight: 700, color: MUTED, marginBottom: 16 }}>{finalPriceLine}</div>
          <CtaButton />
          <div style={{ fontSize: 11.5, fontWeight: 700, color: MUTED, margin: "12px 0 22px" }}>{finalFootnote}</div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: MUTED, borderTop: `2px solid ${LINE}`, paddingTop: 14 }}>
            speaksona.com · <a href="/privacy" style={{ color: MUTED }}>Privacy</a> · <a href="/terms" style={{ color: MUTED }}>Terms</a> · <a href="/for-slps.html" style={{ color: MUTED }}>For SLPs</a><br />Made with a licensed pediatric SLP
          </div>
        </section>
      </div>

      {/* sticky mobile CTA — hidden on desktop */}
      <a
        href={CTA_HREF}
        className="sona-sticky-cta"
        style={{
          position: "fixed", left: 12, right: 12, bottom: 12, zIndex: 40, textDecoration: "none",
          background: "#fff", borderRadius: 18, boxShadow: "0 4px 0 rgba(74,44,20,.18)",
          outline: `2px solid ${LINE}`, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
          maxWidth: 460, margin: "0 auto",
        }}
      >
        <div style={{ flex: 1 }}>
          <span style={{ font: `800 16px ${B}`, color: INK }}>{stickyTitle}</span>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: "#46a302" }}>{stickySub}</div>
        </div>
        <span style={{ background: "#ff8a3d", color: "#fff", font: `700 14px ${B}`, padding: "10px 16px", borderRadius: 14, boxShadow: "0 4px 0 #ef6f23", flex: "none" }}>Get it</span>
      </a>
      {/* @media (min-width:768px){ hide the sticky bar — inline CTAs carry desktop } */}
      <style dangerouslySetInnerHTML={{ __html: "@media(min-width:768px){.sona-sticky-cta{display:none!important}}" }} />
    </main>
  );
}

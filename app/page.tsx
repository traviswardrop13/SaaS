import type { CSSProperties } from "react";

/**
 * Sona — R-sound marketing landing page (App Store funnel).
 *
 * One job: send Meta-ad parents (kids 4–9, 90%+ on phones) to the App Store.
 * Sona is FREE right now (FREE_MODE, SLP-first launch), so every CTA is the
 * App Store link — no checkout, no price talk. The Stripe rail still exists
 * behind /subscribe for when pricing returns; this page just doesn't market
 * it. Design: "Sunrise Storybook" handoff.
 *
 * Ad signal: any App Store tap fires the Meta custom event "AppStoreClick"
 * (build the custom conversion on it in Events Manager) + a PostHog event.
 *
 * Copy rule (founder's spouse is an SLP): "practice"/"coach" only — never
 * therapy/treatment/diagnosis. Camera never used; audio isn't stored.
 */

export const metadata = {
  title: "Sona — R-sound practice kids actually love",
  description:
    "Still saying “wabbit” instead of rabbit? Sona turns daily R practice into a game kids ask to play — built with a licensed speech-language pathologist. Free on the App Store.",
};

const APPSTORE = "https://apps.apple.com/app/id6785755867";
const CREAM = "#fff6e9", INK = "#4a2c14", MUTED = "#8a6f52", LINE = "#f0e2cc";
const B = "'Baloo 2', system-ui, sans-serif"; // display

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
function CtaButton({ label = "Download free on the App Store", big = true }: { label?: string; big?: boolean }) {
  return (
    <a
      href={APPSTORE}
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

export default function Landing() {
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
      {/* Ad-funnel signal: every App Store tap = the conversion Meta optimizes on. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `document.addEventListener("click",function(e){var a=e.target&&e.target.closest?e.target.closest('a[href^="https://apps.apple.com"]'):null;if(!a)return;try{if(window.sonaTrack)window.sonaTrack("AppStoreClick",{content_name:"landing"});}catch(err){}try{if(window.SonaAnalytics)window.SonaAnalytics.track("app store click",{surface:"landing"});}catch(err){}},true);`,
        }}
      />

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
            <div style={{ textAlign: "center", fontSize: 12.5, fontWeight: 700, color: MUTED }}>Free right now — every game, every sound. No card, no account.</div>
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
              {["Licensed & board-certified (CCC-SLP)", "Specializes in kids ages 4–9", "Reviews every exercise before it ships"].map((t) => (
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
            <p style={{ margin: "0 0 12px", fontSize: 13.5, lineHeight: 1.5, fontWeight: 600, color: MUTED }}>Every new sound is included in your plan the day it ships — never an add-on.</p>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#ffd21c", color: INK, font: `800 11.5px 'Nunito', sans-serif`, padding: "6px 12px", borderRadius: 999, boxShadow: "0 3px 0 #e0b000" }}>All sounds included</div>
          </div>
        </section>

        {/* 5 — FREE (the pricing card, while FREE_MODE ships) */}
        <section id="pricing" style={{ background: "#fff", padding: "30px 20px" }}>
          <div style={{ background: "#fff", border: `3px solid ${INK}`, borderRadius: 26, boxShadow: `0 7px 0 ${INK}`, padding: "22px 20px" }}>
            <div style={{ display: "inline-flex", background: "#ffd21c", color: INK, font: `800 11px ${B}`, letterSpacing: 1.2, padding: "5px 12px", borderRadius: 999, boxShadow: "0 3px 0 #e0b000", marginBottom: 12 }}>FREE · FOUNDING FAMILIES</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <div style={{ font: `800 52px/1 ${B}` }}>Free</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: MUTED }}>right now</div>
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: MUTED, margin: "4px 0 16px" }}>we&rsquo;re building Sona with our first families — no card, no catch</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 18 }}>
              {["Every game, every sound — full access from minute one", "Built with a licensed pediatric SLP", "Every new sound included as it ships", "Works on iPhone and iPad"].map((t) => (
                <div key={t} style={{ display: "flex", gap: 9, fontSize: 14, fontWeight: 700 }}><Check />{t}</div>
              ))}
            </div>
            <CtaButton />
            <div style={{ display: "flex", gap: 6, justifyContent: "space-between", margin: "14px 0 10px" }}>
              {[["1", "Download the app"], ["2", "2-minute setup"], ["3", "Play the first round"]].map(([n, t]) => (
                <div key={n} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 800, color: MUTED }}>
                  <div style={{ width: 17, height: 17, borderRadius: "50%", background: INK, color: CREAM, font: `800 10px ${B}`, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{n}</div>{t}
                </div>
              ))}
            </div>
            <div style={{ textAlign: "center", fontSize: 11.5, fontWeight: 700, color: MUTED }}>Free on the App Store · iPhone &amp; iPad</div>
          </div>
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
            {[
              ["Does Sona replace working with an SLP?", "No — it's daily practice designed by one. If your child already sees a speech professional, Sona is the between-sessions coach that makes each visit count."],
              ["Is it really free?", "Yes — every game and every sound, while we build Sona with our founding families. If that ever changes, you'll hear it from us first, and founding families will be looked after."],
              ["What do I need to start?", "An iPhone or iPad. Download from the App Store, a 2-minute setup, and your kid is playing — no card, no account, no code."],
              ["My kid is 4 — too young?", "Sona is built for ages 4–9. Exercises adapt from first tries at the sound all the way to tricky words like “squirrel.”"],
            ].map(([q, a]) => (
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
          <div style={{ fontSize: 14, fontWeight: 700, color: MUTED, marginBottom: 16 }}><span style={{ color: INK, font: `800 20px ${B}` }}>Free</span> on the App Store</div>
          <CtaButton />
          <div style={{ fontSize: 11.5, fontWeight: 700, color: MUTED, margin: "12px 0 22px" }}>Every game, every sound · No card, no account</div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: MUTED, borderTop: `2px solid ${LINE}`, paddingTop: 14 }}>
            speaksona.com · <a href="/privacy" style={{ color: MUTED }}>Privacy</a> · <a href="/terms" style={{ color: MUTED }}>Terms</a><br />Made with a licensed pediatric SLP
          </div>
        </section>
      </div>

      {/* sticky mobile CTA — hidden on desktop */}
      <a
        href={APPSTORE}
        className="sona-sticky-cta"
        style={{
          position: "fixed", left: 12, right: 12, bottom: 12, zIndex: 40, textDecoration: "none",
          background: "#fff", borderRadius: 18, boxShadow: "0 4px 0 rgba(74,44,20,.18)",
          outline: `2px solid ${LINE}`, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
          maxWidth: 460, margin: "0 auto",
        }}
      >
        <div style={{ flex: 1 }}>
          <span style={{ font: `800 16px ${B}`, color: INK }}>Free right now</span>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: "#46a302" }}>Every game, every sound</div>
        </div>
        <span style={{ background: "#ff8a3d", color: "#fff", font: `700 14px ${B}`, padding: "10px 16px", borderRadius: 14, boxShadow: "0 4px 0 #ef6f23", flex: "none" }}>Get the app</span>
      </a>
      {/* @media (min-width:768px){ hide the sticky bar — inline CTAs carry desktop } */}
      <style dangerouslySetInnerHTML={{ __html: "@media(min-width:768px){.sona-sticky-cta{display:none!important}}" }} />
    </main>
  );
}

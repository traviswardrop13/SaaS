"use client";

import { useEffect, useState } from "react";

/**
 * Post-checkout confirmation. Stripe redirects here with ?session_id=… after a
 * successful subscription start. Sona is $9.99/mo or $59.99/yr with a 3-day free trial, so
 * this page's real job is defusing the one fear every trial buyer has — "I'll
 * forget and get billed" — by showing the LITERAL first-charge date off the
 * real Stripe subscription. If the read-back is unreachable we fall back to
 * honest client-side math: a 3-day trial started now ends 3 days from now.
 */

const PLAN_CENTS = { annual: 5999, monthly: 999 } as const;
const TRIAL_DAYS = 3;

type Info = {
  amountCents: number | null;
  trialEnd: number | null; // unix seconds
  email: string | null;
};

function fmtDate(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  const opts: Intl.DateTimeFormatOptions =
    d.getFullYear() === new Date().getFullYear()
      ? { month: "long", day: "numeric" }
      : { month: "long", day: "numeric", year: "numeric" };
  return d.toLocaleDateString("en-US", opts);
}

function fmtMoney(cents: number | null): string {
  if (cents == null) return "";
  return "$" + (cents / 100).toFixed(2);
}

export default function SubscribeSuccess() {
  const [info, setInfo] = useState<Info | null>(null);
  const [fetched, setFetched] = useState(false);
  const [paid, setPaid] = useState(false);
  const [appCode, setAppCode] = useState<string>("");
  const [plan, setPlan] = useState<"annual" | "monthly">("annual");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const sessionId = q.get("session_id") || "";
    const planQ: "annual" | "monthly" = q.get("plan") === "monthly" ? "monthly" : "annual";
    setPlan(planQ);

    // NOTHING is granted until Stripe confirms the session. This page used to
    // write the entitlement on mount, which meant the URL itself was a free
    // subscription for anyone who loaded it — the paywall was one shared link
    // away from optional. /api/checkout/session verifies the id against Stripe
    // and 404s on anything it doesn't recognise, so it is the gate.
    if (!sessionId) {
      setFetched(true);
      return;
    }
    fetch("/api/checkout/session?id=" + encodeURIComponent(sessionId))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j || !j.ok) return;
        setInfo({ amountCents: j.amountCents ?? null, trialEnd: j.trialEnd ?? null, email: j.email ?? null });
        setPaid(true);

        // Access flag for the static app — Stripe stays the source of truth.
        try {
          const prev = JSON.parse(localStorage.getItem("sona.sub.v1") || "{}");
          localStorage.setItem(
            "sona.sub.v1",
            JSON.stringify({ ...prev, active: true, since: Date.now(), session: sessionId, plan: planQ, email: j.email || prev.email || null }),
          );
        } catch {
          // ignore — non-blocking
        }
        // Mint the app hand-off code: the ad funnel buys HERE, then downloads
        // the iOS app — the move-in code carries the purchase into the app so
        // no paywall ever shows there. Best-effort (no KV → email restore).
        try {
          const subStr = localStorage.getItem("sona.sub.v1");
          if (subStr) {
            const blob = JSON.stringify({ app: "sona", v: 1, data: { "sona.sub.v1": subStr } });
            fetch("/api/pair", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ data: blob }),
            })
              .then((r) => r.json())
              .then((p: { ok?: boolean; code?: string }) => { if (p?.ok && p.code) setAppCode(p.code); })
              .catch(() => {});
          }
        } catch {
          // ignore — non-blocking
        }
        // Conversion events fire on a CONFIRMED purchase only. Firing them on
        // mount also meant every stray load of this URL was reported to Meta
        // as a sale, which poisons the ad optimiser as surely as it poisoned
        // the paywall.
        try {
          const w = window as unknown as { sonaTrack?: (e: string, p?: Record<string, unknown>) => void };
          const value = (j.amountCents ?? PLAN_CENTS[planQ]) / 100;
          // annual = a trial started (no money moves today); monthly = a real
          // purchase the moment checkout completes
          if (typeof w.sonaTrack === "function") {
            if (planQ === "annual") w.sonaTrack("StartTrial", { value, currency: "USD", predicted_ltv: value });
            else w.sonaTrack("Subscribe", { value, currency: "USD" });
          }
          const wa = window as unknown as { SonaAnalytics?: { track: (e: string, p?: Record<string, unknown>) => void } };
          if (wa.SonaAnalytics) wa.SonaAnalytics.track(planQ === "annual" ? "trial started" : "subscription started", { source: "stripe", plan: planQ });
        } catch {
          // ignore — non-blocking
        }
      })
      .catch(() => {})
      .finally(() => setFetched(true));
  }, []);

  const amount = info?.amountCents ?? (fetched ? PLAN_CENTS[plan] : null);
  const nowSec = Math.floor(Date.now() / 1000);
  // the trial is annual-only: fabricating a trial-end date for a monthly buyer
  // would tell them "no charge yet" when the charge already happened
  const trialEnd = info?.trialEnd ?? (fetched && plan === "annual" ? nowSec + TRIAL_DAYS * 86400 : null);
  const ready = fetched && paid;

  // Stripe never confirmed this session: someone opened the URL directly, or
  // the read-back failed. Say so plainly and hand them the restore path —
  // pretending "You're in!" is what turned this page into a free unlock.
  if (fetched && !paid) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-sky-50 to-white px-6 py-10 text-center">
        <div className="text-7xl" aria-hidden>🤔</div>
        <h1 className="mt-4 font-display text-4xl font-extrabold text-gray-900">
          We couldn&apos;t confirm a purchase
        </h1>
        <p className="mt-3 max-w-md text-lg text-gray-600">
          This page only works on the link Stripe sends you right after checkout. If you already
          subscribed, nothing is lost — restore with your email.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <a
            href="/trial.html"
            className="inline-block rounded-2xl bg-grass-500 px-8 py-4 font-display text-lg font-extrabold uppercase tracking-wide text-white shadow-chunky transition hover:bg-grass-600 active:translate-y-1 active:shadow-chunky-sm"
          >
            Restore my access
          </a>
          <a href="/subscribe" className="font-bold text-sky-700 underline">See plans →</a>
        </div>
        <p className="mt-6 max-w-sm text-xs font-semibold text-gray-500">
          Think this is a mistake?{" "}
          <a className="font-bold text-sky-700 underline" href="mailto:wardroptravis@gmail.com?subject=Sona%20subscription">
            Email us
          </a>{" "}
          — a human sorts it out same-day.
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-sky-50 to-white px-6 py-10 text-center">
      <div className="text-7xl" aria-hidden>
        🎉
      </div>
      <h1 className="mt-4 font-display text-4xl font-extrabold text-gray-900">
        You&apos;re in!
      </h1>
      <p className="mt-3 max-w-md text-lg text-gray-600">
        {plan === "annual" ? "Your 3 free days start now." : "Your plan is live."} Let&apos;s meet Echo.
      </p>

      {ready && (
        <div className="mt-6 w-full max-w-sm rounded-2xl border-2 border-sky-100 bg-white p-5 text-left shadow-sm">
          <div className="font-display text-sm font-extrabold uppercase tracking-wide text-gray-400">
            {plan === "annual" ? "How your free days work" : "Your plan"}
          </div>
          <div className="mt-3 flex items-start gap-3">
            <div className="text-xl" aria-hidden>🔓</div>
            <div>
              <div className="font-display font-extrabold text-gray-900">Today</div>
              <div className="text-sm text-gray-600">
                {plan === "annual"
                  ? <>Full access starts now — <strong>$0 charged</strong>.</>
                  : <>Full access starts now — <strong>{fmtMoney(amount)}/month</strong>, cancel anytime.</>}
              </div>
            </div>
          </div>
          {trialEnd != null && (
            <div className="mt-4 flex items-start gap-3">
              <div className="text-xl" aria-hidden>📅</div>
              <div>
                <div className="font-display font-extrabold text-gray-900">{fmtDate(trialEnd)}</div>
                <div className="text-sm text-gray-600">
                  First charge: <strong>{fmtMoney(amount)}/year</strong> — only if you keep Sona.
                </div>
              </div>
            </div>
          )}
          <p className="mt-4 border-t border-sky-50 pt-3 text-sm text-gray-600">
            {trialEnd != null ? <>Cancel anytime before {fmtDate(trialEnd)} and you won&apos;t be charged. </> : null}
            Need a hand?{" "}
            <a className="font-bold text-sky-700 underline" href="mailto:wardroptravis@gmail.com?subject=Sona%20subscription">
              Email us
            </a>{" "}
            — a human sorts it out same-day. We can cancel for you.
          </p>
        </div>
      )}

      {/* The hand-off: buy on the web → set up in the iOS app. */}
      <div className="mt-6 w-full max-w-sm rounded-2xl border-2 border-grass-500/30 bg-white p-5 text-left shadow-sm">
        <div className="font-display text-sm font-extrabold uppercase tracking-wide text-gray-400">
          Next: get the app
        </div>
        <ol className="mt-3 space-y-3 text-sm font-semibold text-gray-700">
          <li>
            <strong>1.</strong> Download <strong>Sona Speech</strong> on the App Store
          </li>
          <li>
            <strong>2.</strong> Open it and tap <strong>&ldquo;Have a code?&rdquo;</strong> on the first screen
          </li>
          <li>
            <strong>3.</strong>{" "}
            {appCode ? (
              <>
                Enter{" "}
                <strong className="rounded-lg bg-amber-100 px-2 py-0.5 font-display text-lg tracking-[3px] text-amber-900">{appCode}</strong>{" "}
                — your plan comes with you, and set-up happens in the app.
              </>
            ) : (
              <>
                Enter the 6-letter code that appears here in a few seconds. If it
                doesn&apos;t, no problem — your email works too: in the app,{" "}
                <strong>Settings → Restore access</strong>.
              </>
            )}
          </li>
        </ol>
      </div>
      <a
        href="https://apps.apple.com/app/id6785755867"
        className="mt-6 inline-block rounded-2xl bg-grass-500 px-8 py-4 font-display text-lg font-extrabold uppercase tracking-wide text-white shadow-chunky transition hover:bg-grass-600 active:translate-y-1 active:shadow-chunky-sm"
      >
        Download on the App Store
      </a>
      <p className="mt-4 max-w-sm text-xs font-semibold text-gray-500">
        No iPhone handy, or prefer the browser?{" "}
        <a href="/onboarding.html" className="font-bold text-sky-700 underline">
          Set up and play on the web →
        </a>
      </p>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";

/**
 * Post-checkout confirmation. Stripe redirects here with ?session_id=… after
 * a successful one-time purchase — Sona is a $79.99 lifetime unlock, no
 * subscription, so there's no future charge to reassure anyone about. This
 * page's job is simpler: confirm what was paid today and hand off into the
 * app. If the read-back API is unreachable we fall back to the known price.
 */

const LIFETIME_CENTS = 7999;

type Info = {
  amountCents: number | null;
  email: string | null;
};

function fmtMoney(cents: number | null): string {
  if (cents == null) return "";
  return "$" + (cents / 100).toFixed(2);
}

export default function SubscribeSuccess() {
  const [info, setInfo] = useState<Info | null>(null);
  const [fetched, setFetched] = useState(false);
  const [appCode, setAppCode] = useState<string>("");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const sessionId = q.get("session_id") || "";

    // Access flag for the static app — Stripe stays the source of truth.
    try {
      const prev = JSON.parse(localStorage.getItem("sona.sub.v1") || "{}");
      localStorage.setItem(
        "sona.sub.v1",
        JSON.stringify({ ...prev, active: true, since: Date.now(), session: sessionId, plan: "lifetime" }),
      );
    } catch {
      // ignore — non-blocking
    }
    // Mint the app hand-off code: the ad funnel buys HERE, then downloads the
    // iOS app — the move-in code carries the purchase into the app so no
    // paywall ever shows there. Best-effort (no KV → email-restore fallback).
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
          .then((j: { ok?: boolean; code?: string }) => { if (j?.ok && j.code) setAppCode(j.code); })
          .catch(() => {});
      }
    } catch {
      // ignore — non-blocking
    }
    // Fire the conversion event for both PostHog and the Meta Pixel — before
    // any fetch, so a slow Stripe read never costs the ad platforms the event.
    try {
      const w = window as unknown as { sonaTrack?: (e: string, p?: Record<string, unknown>) => void };
      const value = LIFETIME_CENTS / 100;
      if (typeof w.sonaTrack === "function") w.sonaTrack("Purchase", { value, currency: "USD", predicted_ltv: value });
      // product analytics (whitelisted props; Stripe has already confirmed)
      const wa = window as unknown as { SonaAnalytics?: { track: (e: string, p?: Record<string, unknown>) => void } };
      if (wa.SonaAnalytics) wa.SonaAnalytics.track("purchase completed", { source: "stripe", plan: "lifetime" });
    } catch {
      // ignore — non-blocking
    }

    // Real charge amount off the real Stripe session.
    if (!sessionId) {
      setFetched(true);
      return;
    }
    fetch("/api/checkout/session?id=" + encodeURIComponent(sessionId))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j && j.ok) {
          setInfo({ amountCents: j.amountCents ?? null, email: j.email ?? null });
        }
      })
      .catch(() => {})
      .finally(() => setFetched(true));
  }, []);

  const amount = info?.amountCents ?? (fetched ? LIFETIME_CENTS : null);
  const ready = fetched;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-sky-50 to-white px-6 py-10 text-center">
      <div className="text-7xl" aria-hidden>
        🎉
      </div>
      <h1 className="mt-4 font-display text-4xl font-extrabold text-gray-900">
        You&apos;re in!
      </h1>
      <p className="mt-3 max-w-md text-lg text-gray-600">
        Sona is unlocked for good. Let&apos;s meet Echo.
      </p>

      {ready && (
        <div className="mt-6 w-full max-w-sm rounded-2xl border-2 border-sky-100 bg-white p-5 text-left shadow-sm">
          <div className="font-display text-sm font-extrabold uppercase tracking-wide text-gray-400">
            Your plan
          </div>
          <div className="mt-3 flex items-start gap-3">
            <div className="text-xl" aria-hidden>✅</div>
            <div>
              <div className="font-display font-extrabold text-gray-900">Paid today: {fmtMoney(amount)}</div>
              <div className="text-sm text-gray-600">One payment. Sona forever — no renewals, no subscription.</div>
            </div>
          </div>
          <p className="mt-4 border-t border-sky-50 pt-3 text-sm text-gray-600">
            Need a change?{" "}
            <a className="font-bold text-sky-700 underline" href="mailto:wardroptravis@gmail.com?subject=Sona%20purchase">
              Email us
            </a>{" "}
            — a human sorts it out same-day.
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
                — your purchase comes with you, and set-up happens in the app.
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

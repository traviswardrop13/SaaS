"use client";

import { useEffect, useState } from "react";

/**
 * Post-checkout confirmation. Stripe redirects here with ?session_id=… on a
 * successful subscription. Beyond caching the "active" flag and firing the
 * conversion pixel, this page's real job is defusing the one fear every trial
 * buyer has — "I'll forget and get billed" — by showing the LITERAL charge
 * date and amount off the real Stripe subscription (the single most
 * consistent trust element in the Mobbin trial-reassurance study: 15 of 22
 * screens show a calendar date), plus a working self-serve cancel path.
 * If the read-back API is unreachable we fall back to client-side date math —
 * a 7-day trial ends exactly 7 days from now, so the date stays honest.
 */

const PLAN_FALLBACK: Record<string, { cents: number; interval: "year" | "month"; trialDays: number }> = {
  annual: { cents: 6999, interval: "year", trialDays: 7 },
  monthly: { cents: 1299, interval: "month", trialDays: 0 },
  founding: { cents: 3999, interval: "year", trialDays: 0 },
};

type Info = {
  amountCents: number | null;
  interval: "year" | "month" | null;
  trialEnd: number | null; // unix seconds
  periodEnd: number | null;
  email: string | null;
};

function fmtMoney(cents: number | null): string {
  if (cents == null) return "";
  return "$" + (cents / 100).toFixed(2);
}

function fmtDate(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  const opts: Intl.DateTimeFormatOptions =
    d.getFullYear() === new Date().getFullYear()
      ? { month: "long", day: "numeric" }
      : { month: "long", day: "numeric", year: "numeric" };
  return d.toLocaleDateString("en-US", opts);
}

export default function SubscribeSuccess() {
  const [plan, setPlan] = useState<string>("");
  const [sid, setSid] = useState<string>("");
  const [info, setInfo] = useState<Info | null>(null);
  const [fetched, setFetched] = useState(false);
  const [portalDead, setPortalDead] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const sessionId = q.get("session_id") || "";
    const p = q.get("plan") || "founding";
    setSid(sessionId);
    setPlan(p);

    // Access flag for the static app — Stripe stays the source of truth.
    try {
      const prev = JSON.parse(localStorage.getItem("sona.sub.v1") || "{}");
      localStorage.setItem(
        "sona.sub.v1",
        JSON.stringify({ ...prev, active: true, since: Date.now(), session: sessionId, plan: p }),
      );
    } catch {
      // ignore — non-blocking
    }
    // Fire the conversion event for both PostHog and the Meta Pixel — before
    // any fetch, so a slow Stripe read never costs the ad platforms the event.
    try {
      const w = window as unknown as { sonaTrack?: (e: string, p?: Record<string, unknown>) => void };
      const value = p === "annual" ? 69.99 : p === "monthly" ? 12.99 : 39.99;
      // Trialed annuals register as StartTrial (no charge today); paid-now plans as Purchase.
      const ev = p === "annual" ? "StartTrial" : "Purchase";
      if (typeof w.sonaTrack === "function") w.sonaTrack(ev, { value, currency: "USD", predicted_ltv: 69.99 });
    } catch {
      // ignore — non-blocking
    }

    // Real dates off the real subscription.
    if (!sessionId) {
      setFetched(true);
      return;
    }
    fetch("/api/checkout/session?id=" + encodeURIComponent(sessionId))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j && j.ok) {
          const got: Info = {
            amountCents: j.amountCents ?? null,
            interval: j.interval ?? null,
            trialEnd: j.trialEnd ?? null,
            periodEnd: j.periodEnd ?? null,
            email: j.email ?? null,
          };
          setInfo(got);
          try {
            const prev = JSON.parse(localStorage.getItem("sona.sub.v1") || "{}");
            localStorage.setItem(
              "sona.sub.v1",
              JSON.stringify({ ...prev, trialEnd: got.trialEnd, renewsAt: got.trialEnd || got.periodEnd }),
            );
          } catch {
            // ignore
          }
        }
      })
      .catch(() => {})
      .finally(() => setFetched(true));
  }, []);

  // Honest fallback math when the read-back isn't available: a 7-day trial
  // ends exactly 7 days from now; paid plans renew one interval from today.
  const fb = PLAN_FALLBACK[plan] || PLAN_FALLBACK.founding;
  const now = Math.floor(Date.now() / 1000);
  const trialEnd = info?.trialEnd ?? (fetched && fb.trialDays > 0 ? now + fb.trialDays * 86400 : null);
  const periodEnd =
    info?.periodEnd ??
    (fetched && fb.trialDays === 0 ? (fb.interval === "year" ? now + 365 * 86400 : now + 30 * 86400) : null);
  const amount = info?.amountCents ?? (fetched ? fb.cents : null);
  const interval = info?.interval ?? (fetched ? fb.interval : null);
  const per = interval === "year" ? "/year" : interval === "month" ? "/month" : "";
  const isTrial = trialEnd != null;
  const ready = fetched && plan !== "";

  function openPortal() {
    if (!sid) {
      setPortalDead(true);
      return;
    }
    fetch("/api/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sid }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (j && j.ok && j.url) window.location.href = j.url;
        else setPortalDead(true);
      })
      .catch(() => setPortalDead(true));
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
        {isTrial ? "Your free week starts now." : "Subscription active."} Let&apos;s meet Echo.
      </p>

      {ready && (
        <div className="mt-6 w-full max-w-sm rounded-2xl border-2 border-sky-100 bg-white p-5 text-left shadow-sm">
          <div className="font-display text-sm font-extrabold uppercase tracking-wide text-gray-400">
            {isTrial ? "How your free week works" : "Your plan"}
          </div>

          {isTrial ? (
            <>
              <div className="mt-3 flex items-start gap-3">
                <div className="text-xl" aria-hidden>🔓</div>
                <div>
                  <div className="font-display font-extrabold text-gray-900">Today</div>
                  <div className="text-sm text-gray-600">Full access starts now — <strong>$0 charged</strong>.</div>
                </div>
              </div>
              <div className="mt-4 flex items-start gap-3">
                <div className="text-xl" aria-hidden>📅</div>
                <div>
                  <div className="font-display font-extrabold text-gray-900">{fmtDate(trialEnd)}</div>
                  <div className="text-sm text-gray-600">
                    First charge: <strong>{fmtMoney(amount)}{per}</strong> — only if you keep Sona.
                  </div>
                </div>
              </div>
              <p className="mt-4 border-t border-sky-50 pt-3 text-sm text-gray-600">
                Cancel anytime before {fmtDate(trialEnd)} and you won&apos;t be charged.
              </p>
            </>
          ) : (
            <>
              <div className="mt-3 flex items-start gap-3">
                <div className="text-xl" aria-hidden>✅</div>
                <div>
                  <div className="font-display font-extrabold text-gray-900">Paid today: {fmtMoney(amount)}</div>
                  {periodEnd != null && (
                    <div className="text-sm text-gray-600">
                      Renews {fmtDate(periodEnd)} at {fmtMoney(amount)}{per}. Cancel anytime.
                    </div>
                  )}
                </div>
              </div>
              {plan === "founding" && (
                <p className="mt-4 border-t border-sky-50 pt-3 text-sm font-semibold text-amber-700">
                  💛 Founding family — your rate is locked and never goes up while you stay.
                </p>
              )}
            </>
          )}

          {portalDead ? (
            <p className="mt-2 text-sm text-gray-600">
              Need a change?{" "}
              <a className="font-bold text-sky-700 underline" href="mailto:wardroptravis@gmail.com?subject=Sona%20subscription">
                Email us
              </a>{" "}
              — a human sorts it out same-day. We can cancel for you.
            </p>
          ) : (
            <button
              onClick={openPortal}
              className="mt-2 text-sm font-bold text-sky-700 underline"
            >
              Manage or cancel subscription →
            </button>
          )}
        </div>
      )}

      <div className="mt-5 max-w-sm rounded-2xl bg-sky-50 px-5 py-4 text-left text-sm font-semibold text-sky-800">
        📱 Using another device? Open Sona there →{" "}
        <strong>⚙️ Settings → Restore access</strong> → enter{" "}
        {info?.email ? <strong>{info.email}</strong> : "this email"}.
      </div>
      <a
        href="/onboarding.html"
        className="mt-8 inline-block rounded-2xl bg-grass-500 px-8 py-4 font-display text-lg font-extrabold uppercase tracking-wide text-white shadow-chunky transition hover:bg-grass-600 active:translate-y-1 active:shadow-chunky-sm"
      >
        Start setup
      </a>
      <a
        href="/map.html"
        className="mt-4 text-sm font-bold text-gray-500 hover:text-gray-800"
      >
        Skip to the app →
      </a>
    </main>
  );
}

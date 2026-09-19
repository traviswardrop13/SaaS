"use client";

import Link from "next/link";
import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { FREE_MODE } from "@/lib/pricing";

// Shown under whichever plan is selected, so every line has to be true on
// ONE PLAN. The FEATURES list below may safely say the trial is part of it:
// with monthly retired there is no plan it could be a lie on.
const FEATURES = [
  "Every game and every level, unlocked",
  "Starts with 3 free days — cancel anytime, no charge",
  "Every new sound and update as it ships",
  "Your suggestions shape Sona for your child",
  "Priority support",
];

function SubscribeInner() {
  const params = useSearchParams();
  const canceled = params.get("canceled") === "1";
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // the tier from /api/charter; null until it answers, and the button waits
  // for it so the price on this page is the price Stripe charges
  const [spots, setSpots] = useState<{ open: boolean; left: number; cap: number; source: string; standard: string; label: string } | null>(null);
  useEffect(() => {
    let done = false;
    const settle = (v: typeof spots) => { if (!done) { done = true; setSpots(v); } };
    fetch("/api/charter").then((r) => r.json()).then((j) => settle(j && j.ok && !j.free ? j : { open: true, left: 0, cap: 50, source: "fallback", standard: "$99.99", label: "Charter" }))
      .catch(() => settle({ open: true, left: 0, cap: 50, source: "fallback", standard: "$99.99", label: "Charter" }));
    const t = setTimeout(() => settle({ open: true, left: 0, cap: 50, source: "fallback", standard: "$99.99", label: "Charter" }), 2500);
    return () => clearTimeout(t);
  }, []);
  const open = spots ? spots.open : true;
  const yearPrice = open ? "$59.99" : "$99.99";
  const perMonth = open ? "Under $5 a month" : "Under $8.50 a month";

  // Native app (App Store build): Apple forbids non-IAP checkout, so the iOS app
  // ships with no in-app payment. If this page is reached inside the app, bounce
  // to the app home instead of showing Stripe. Web checkout is unaffected.
  useEffect(() => {
    if (typeof window !== "undefined" && (window as { Capacitor?: unknown }).Capacitor) {
      window.location.replace("/today.html");
    }
  }, []);

  async function preorder() {
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Please enter a valid email.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, plan: "annual" }),
      });
      const data = await res.json();
      if (data.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error || "Something went wrong. Please try again.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // Sona is free: /api/checkout refuses, so every button on this page could
  // only produce an error. A parent who lands here from a bookmark or an old
  // link gets the truth and a way into the app, not a broken plan picker.
  if (FREE_MODE) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-sky-50 to-white">
        <div className="mx-auto max-w-md px-5 py-20 text-center">
          <img src="/coach/echo/echo-avatar.svg" alt="Sona" className="mx-auto h-20 w-20 object-contain" />
          <h1 className="font-display mt-4 text-3xl font-extrabold text-gray-900">Sona is free</h1>
          <p className="mt-3 text-base font-bold text-gray-600">
            Every game, every sound and the Sound Check — no plan, no card, nothing to cancel.
          </p>
          <Link
            href="/onboarding.html"
            className="mt-7 inline-block rounded-2xl bg-orange-400 px-7 py-4 font-display text-lg font-extrabold text-white shadow-chunky"
          >
            Start practicing
          </Link>
          {/* Settings still routes an active subscriber here via "Manage →".
              Going free does not cancel anybody's Apple or Stripe
              subscription, so the one thing this page owes them is the way
              out — never a dead end on a page that just told them it's free. */}
          <p className="mt-8 text-sm font-bold leading-relaxed text-gray-500">
            Subscribed before Sona went free? Nothing is charged by the app any more, but an
            existing subscription keeps renewing until it is cancelled. On iPhone or iPad:{" "}
            <strong>Settings &rarr; your Apple ID &rarr; Subscriptions</strong>. Bought on
            speaksona.com:{" "}
            <a className="text-sky-700 underline" href="mailto:wardroptravis@gmail.com?subject=Sona%20subscription">
              email us
            </a>{" "}
            and we will cancel and refund it.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-white">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
        <Link href="/" className="flex items-center gap-2">
          <img src="/coach/echo/echo-avatar.svg" alt="Sona" className="h-8 w-8 object-contain" />
          <span className="font-display text-2xl font-extrabold text-sky-600">Sona</span>
        </Link>
        <Link href="/" className="text-sm font-bold text-gray-500 hover:text-gray-800">
          ← Back
        </Link>
      </header>

      <div className="mx-auto grid max-w-4xl items-start gap-8 px-5 py-10 lg:grid-cols-2">
        {/* Plan summary */}
        <div className="rounded-3xl bg-white p-7 shadow-chunky ring-2 ring-sky-500">
          <div className="flex items-center gap-2">
            <p className="text-sm font-extrabold uppercase tracking-wide text-sky-600">
              Sona Yearly
            </p>
            <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-amber-900">
              3 days free
            </span>
          </div>

          {/* ONE PLAN as of 18 Sep 2026. The picker, the struck "$119.88" and
              "yearly saves $59.89" all left with the monthly tier: every one of
              them was 12 x $9.99, and a strike-through with no monthly plan
              behind it is an anchor against a price nobody can buy. What is
              left is checkable arithmetic — $59.99 / 12 = $4.9991 — which is
              why it reads "under $5 a month" and never "$4.99 a month". */}
          <div className="mt-4 rounded-2xl border-2 border-sky-500 bg-sky-50 px-4 py-4 text-left">
            <span className="block font-display text-2xl font-extrabold text-gray-900">{yearPrice}/yr</span>
            <span className="block text-xs font-bold text-grass-600">{perMonth} · 3 days free first</span>
            {spots && open && (
              <span className="mt-1 block text-xs font-bold text-grass-700">
                {spots.label} price for the first {spots.cap} families — regular price <s>{spots.standard}/yr</s>
                {spots.source === "stripe" ? ` · ${spots.left} spot${spots.left === 1 ? "" : "s"} left` : ""}
              </span>
            )}
          </div>

          <p className="mt-3 rounded-2xl bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700">
            <b>$0 today.</b> Your first 3 days are free. On day 3, if you keep Sona,
            it&apos;s {yearPrice} for the year and {yearPrice} each year after. Cancel before
            day 3 and you are charged nothing at all.
          </p>

          <ul className="mt-6 space-y-3">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-grass-500 text-xs font-extrabold text-white">
                  ✓
                </span>
                <span className="font-semibold text-gray-700">{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Checkout */}
        <div className="rounded-3xl bg-white p-7 shadow-chunky">
          <h1 className="font-display text-2xl font-extrabold text-gray-900">
            Start 3 days free
          </h1>
          {/* "Sona is yours for good" lived here and was wrong twice over: a
              subscription is not ownership, and on yearly nothing is bought
              today at all. Say what the card is actually charged, and when. */}
          <p className="mt-1 text-gray-600">
            Enter your email to start your 3 free days. Nothing is charged today.
          </p>

          {canceled ? (
            <div className="mt-4 rounded-2xl bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700">
              No worries — checkout was canceled. Your spot is still here whenever you&apos;re
              ready.
            </div>
          ) : null}

          <label className="mt-5 block text-sm font-bold text-gray-700">Email</label>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") preorder();
            }}
            placeholder="you@example.com"
            className="mt-1.5 w-full rounded-2xl border-2 border-gray-200 px-4 py-3 text-base font-semibold outline-none focus:border-sky-500"
          />

          {error ? <p className="mt-3 text-sm font-bold text-red-500">{error}</p> : null}

          <button
            onClick={preorder}
            disabled={busy || spots === null}
            className="mt-5 w-full rounded-2xl bg-grass-500 px-6 py-3.5 font-display font-extrabold uppercase tracking-wide text-white shadow-chunky transition hover:bg-grass-600 active:translate-y-1 active:shadow-chunky-sm disabled:opacity-60"
          >
            {busy ? "Loading…" : spots === null ? "Checking today’s price…" : `Start 3 days free — then ${yearPrice}/yr`}
          </button>

          <p className="mt-3 text-center text-xs text-gray-400">
            Secure payment by Stripe. We never see your card details.
          </p>

          {/* A grandfather sweep ships with this build, so families from the
              free era are already entitled and this page is not for them. If
              that sweep is ever changed or dropped, this sentence becomes a
              broken promise — delete it in the same commit or not at all. */}
          <p className="mt-5 rounded-2xl bg-gray-50 px-4 py-3 text-center text-xs font-bold leading-relaxed text-gray-500">
            Already practicing with Sona while it was free? Your family keeps it free.
            There is nothing to buy and nothing to do.
          </p>

          <p className="mt-4 text-center text-xs font-semibold leading-relaxed text-gray-500">
            Built with Rachel, a licensed pediatric speech-language pathologist
            (Clinical Fellow). Sona is speech practice at home — it is not therapy,
            diagnosis or an evaluation. Your child&apos;s voice is checked on the
            device and never uploaded.
          </p>
        </div>
      </div>
    </main>
  );
}

export default function SubscribePage() {
  return (
    <Suspense fallback={null}>
      <SubscribeInner />
    </Suspense>
  );
}

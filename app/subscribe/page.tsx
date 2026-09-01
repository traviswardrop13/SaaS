"use client";

import Link from "next/link";
import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { FREE_MODE } from "@/lib/pricing";

const FEATURES = [
  "Every game and every level, unlocked",
  "Yearly starts with 3 free days — cancel anytime, no charge",
  "Every new sound and update as it ships",
  "Your suggestions shape Sona for your child",
  "Priority support",
];

function SubscribeInner() {
  const params = useSearchParams();
  const canceled = params.get("canceled") === "1";
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState<"annual" | "monthly">("annual");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        body: JSON.stringify({ email, plan }),
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
              {plan === "annual" ? "Sona Yearly" : "Sona Monthly"}
            </p>
            {plan === "annual" ? (
              <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-amber-900">
                3 days free
              </span>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => setPlan("annual")}
              className={`rounded-2xl border-2 px-3 py-3 text-left ${plan === "annual" ? "border-sky-500 bg-sky-50" : "border-gray-200"}`}
            >
              <span className="block font-display text-xl font-extrabold text-gray-900"><s className="mr-1 text-gray-400">$119.88</s>$59.99/yr</span>
              <span className="text-xs font-bold text-grass-600">50% off the monthly rate</span>
            </button>
            <button
              onClick={() => setPlan("monthly")}
              className={`rounded-2xl border-2 px-3 py-3 text-left ${plan === "monthly" ? "border-sky-500 bg-sky-50" : "border-gray-200"}`}
            >
              <span className="block font-display text-xl font-extrabold text-gray-900">$9.99/mo</span>
              <span className="text-xs font-bold text-gray-500">month to month · no trial</span>
            </button>
          </div>
          {plan === "annual" ? (
            <p className="mt-3 rounded-2xl bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700">
              <b>$0 today.</b> Your first 3 days are free — cancel anytime before
              they end and you won&apos;t be charged.
            </p>
          ) : (
            <p className="mt-3 rounded-2xl bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700">
              <b>$9.99 today,</b> then monthly. Cancel anytime — no contract.
            </p>
          )}

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
            {plan === "annual" ? "Start 3 days free" : "Subscribe monthly"}
          </h1>
          <p className="mt-1 text-gray-600">
            Enter your email and Sona is yours for good.
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
            disabled={busy}
            className="mt-5 w-full rounded-2xl bg-grass-500 px-6 py-3.5 font-display font-extrabold uppercase tracking-wide text-white shadow-chunky transition hover:bg-grass-600 active:translate-y-1 active:shadow-chunky-sm disabled:opacity-60"
          >
            {busy ? "Loading…" : plan === "annual" ? "Start 3 days free" : "Subscribe — $9.99/mo"}
          </button>

          <p className="mt-3 text-center text-xs text-gray-400">
            Secure payment by Stripe. We never see your card details.
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

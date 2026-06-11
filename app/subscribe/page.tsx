"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

const FEATURES = [
  "Every new feature and update as it ships",
  "Priority support",
  "Your suggestions shape Sona for your child",
  "Founding price locked for life",
];

function SubscribeInner() {
  const params = useSearchParams();
  const canceled = params.get("canceled") === "1";
  const [email, setEmail] = useState("");
  const annual = true; // founding beta is annual-only
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subscribe() {
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
        body: JSON.stringify({ email, plan: annual ? "annual" : "monthly" }),
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

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-white">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden>
            🦁
          </span>
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
              Sona Founding Circle
            </p>
            <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-amber-900">
              First 100
            </span>
          </div>
          <div className="mt-3 flex items-end gap-2">
            <span className="mb-2 text-2xl font-bold text-gray-400 line-through">$119.99</span>
            <span className="font-display text-5xl font-extrabold text-gray-900">$59</span>
            <span className="mb-1.5 font-bold text-gray-500">/year</span>
          </div>
          <p className="mt-1 text-sm font-bold text-grass-600">
            7-day free trial · cancel anytime
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
            Start your subscription
          </h1>
          <p className="mt-1 text-gray-600">
            Enter your email and we&apos;ll take you to secure checkout.
          </p>

          <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            <strong>Beta:</strong> Sona is brand new — built with a licensed SLP and
            improving every week. Cancel anytime, and we&apos;ll refund you if it&apos;s
            not a fit.
          </div>

          {canceled ? (
            <div className="mt-4 rounded-2xl bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700">
              No worries — checkout was canceled. You can pick up where you left off
              whenever you&apos;re ready.
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
              if (e.key === "Enter") subscribe();
            }}
            placeholder="you@example.com"
            className="mt-1.5 w-full rounded-2xl border-2 border-gray-200 px-4 py-3 text-base font-semibold outline-none focus:border-sky-500"
          />

          {error ? (
            <p className="mt-3 text-sm font-bold text-red-500">{error}</p>
          ) : null}

          <button
            onClick={subscribe}
            disabled={busy}
            className="mt-5 w-full rounded-2xl bg-grass-500 px-6 py-3.5 font-display font-extrabold uppercase tracking-wide text-white shadow-chunky transition hover:bg-grass-600 active:translate-y-1 active:shadow-chunky-sm disabled:opacity-60"
          >
            {busy ? "Loading…" : "Start 7-day free trial"}
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

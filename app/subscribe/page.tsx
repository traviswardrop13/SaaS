"use client";

import Link from "next/link";
import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

const FEATURES = [
  "Every game and every level, unlocked",
  "7 days free — cancel anytime, no charge",
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
        body: JSON.stringify({ email }),
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
              7 days free
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-2">
            <span className="font-display text-5xl font-extrabold text-gray-900">$79.99</span>
            <span className="mb-1.5 font-bold text-gray-500">/year</span>
          </div>
          <p className="mt-1 text-sm font-bold text-grass-600">
            That&apos;s $6.67 a month, billed yearly
          </p>
          <p className="mt-3 rounded-2xl bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700">
            <b>$0 today.</b> Your first week is free — cancel anytime before it
            ends and you won&apos;t be charged.
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
            Start 7 days free
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
            {busy ? "Loading…" : "Start 7 days free"}
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

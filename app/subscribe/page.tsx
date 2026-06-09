"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

const FEATURES = [
  "Friendly coach who listens, adapts, and cheers your child on",
  "Real-time feedback on every sound (speech scoring)",
  "Personalized plan from a quick sound check",
  "Progress report you can share with your SLP",
  "Up to 3 children",
  "Cancel anytime",
];

function SubscribeInner() {
  const params = useSearchParams();
  const canceled = params.get("canceled") === "1";
  const [email, setEmail] = useState("");
  const [annual, setAnnual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);

  // Already subscribed (new device / cleared storage)? Verify by email and unlock.
  async function restore() {
    setError(null);
    setRestoreMsg(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Enter the email you subscribed with, then tap Restore.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/subscription?email=" + encodeURIComponent(email));
      const data = await res.json();
      if (data.ok && data.active) {
        try {
          localStorage.setItem("sona.sub.v1", JSON.stringify({ active: true, email, since: Date.now() }));
        } catch {
          // ignore
        }
        window.location.href = "/home.html";
        return;
      }
      setRestoreMsg(data.ok ? "No active subscription found for that email." : data.error || "Couldn’t check right now.");
    } catch {
      setRestoreMsg("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

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
          <p className="text-sm font-extrabold uppercase tracking-wide text-sky-600">
            Sona Premium
          </p>
          <div className="mt-3 inline-flex rounded-full bg-gray-100 p-1 text-sm font-bold">
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={`rounded-full px-4 py-1.5 ${!annual ? "bg-white text-gray-900 shadow" : "text-gray-500"}`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={`rounded-full px-4 py-1.5 ${annual ? "bg-white text-gray-900 shadow" : "text-gray-500"}`}
            >
              Yearly <span className="text-grass-600">· save</span>
            </button>
          </div>
          <div className="mt-3 flex items-end gap-1">
            <span className="font-display text-5xl font-extrabold text-gray-900">{annual ? "$79" : "$99"}</span>
            <span className="mb-1.5 font-bold text-gray-500">/mo</span>
          </div>
          <p className="mt-1 text-sm font-bold text-grass-600">
            {annual ? "Billed yearly ($948) · saves ~2 months" : "7-day free trial · cancel anytime"}
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
            {busy ? "Loading…" : "Start free trial"}
          </button>

          <p className="mt-3 text-center text-xs text-gray-400">
            Secure payment by Stripe. We never see your card details.
          </p>

          <p className="mt-4 text-center text-sm text-gray-500">
            Already subscribed?{" "}
            <button
              onClick={restore}
              disabled={busy}
              className="font-bold text-sky-600 underline disabled:opacity-60"
            >
              Restore access
            </button>
          </p>
          {restoreMsg ? (
            <p className="mt-2 text-center text-sm font-bold text-red-500">{restoreMsg}</p>
          ) : null}
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

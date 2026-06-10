"use client";

import { useEffect } from "react";

/**
 * Post-checkout confirmation. Stripe redirects here with ?session_id=… on a
 * successful subscription. We cache an "active" flag locally so the app (the
 * static prototype) can reflect access immediately; Stripe stays the source of
 * truth via /api/subscription for returning users.
 */
export default function SubscribeSuccess() {
  useEffect(() => {
    try {
      const sid = new URLSearchParams(window.location.search).get("session_id") || "";
      const prev = JSON.parse(localStorage.getItem("sona.sub.v1") || "{}");
      localStorage.setItem(
        "sona.sub.v1",
        JSON.stringify({ ...prev, active: true, since: Date.now(), session: sid }),
      );
    } catch {
      // ignore — non-blocking
    }
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-sky-50 to-white px-6 text-center">
      <div className="text-7xl" aria-hidden>
        🎉
      </div>
      <h1 className="mt-4 font-display text-4xl font-extrabold text-gray-900">
        You&apos;re in!
      </h1>
      <p className="mt-3 max-w-md text-lg text-gray-600">
        Your subscription is active. Let&apos;s set up your child&apos;s plan and
        meet Leo.
      </p>
      <div className="mt-5 max-w-md rounded-2xl bg-sky-50 px-5 py-4 text-left text-sm font-semibold text-sky-800">
        <p>
          📱 <strong>Sona is unlocked on this device.</strong> To unlock it
          anywhere else (your child&apos;s iPad, the other parent&apos;s phone):
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Open Sona on that device.</li>
          <li>
            Tap <strong>⚙️ Settings → Restore access</strong>.
          </li>
          <li>Type the email you just paid with — done.</li>
        </ol>
        <p className="mt-2">
          Heads up: when you <strong>add Sona to your home screen</strong>,
          iPhone treats that app like a brand-new device the first time you
          open it — just do the same Restore step once and you&apos;re set.
        </p>
      </div>
      <a
        href="/onboarding.html"
        className="mt-8 inline-block rounded-2xl bg-grass-500 px-8 py-4 font-display text-lg font-extrabold uppercase tracking-wide text-white shadow-chunky transition hover:bg-grass-600 active:translate-y-1 active:shadow-chunky-sm"
      >
        Start setup
      </a>
      <a
        href="/home.html"
        className="mt-4 text-sm font-bold text-gray-500 hover:text-gray-800"
      >
        Skip to the app →
      </a>
    </main>
  );
}

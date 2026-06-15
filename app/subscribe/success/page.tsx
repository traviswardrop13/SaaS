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
        Subscription active. Let&apos;s meet Leo.
      </p>
      <div className="mt-5 max-w-sm rounded-2xl bg-sky-50 px-5 py-4 text-left text-sm font-semibold text-sky-800">
        📱 Using another device? Open Sona there →{" "}
        <strong>⚙️ Settings → Restore access</strong> → enter this email.
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

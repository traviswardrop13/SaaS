import Link from "next/link";

/**
 * Post-checkout confirmation. Stripe redirects here with ?session_id=… on a
 * successful subscription. We keep it simple (no DB read needed) — access is
 * verified live via /api/subscription when the user enters the app.
 */
export const metadata = { title: "You're in — Sona" };

export default function SubscribeSuccess() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-sky-50 to-white px-6 text-center">
      <div className="text-7xl" aria-hidden>
        🎉
      </div>
      <h1 className="mt-4 font-display text-4xl font-extrabold text-gray-900">
        Welcome to Sona!
      </h1>
      <p className="mt-3 max-w-md text-lg text-gray-600">
        Your subscription is active. Let&apos;s set up your child&apos;s plan and
        meet their coach.
      </p>
      <Link
        href="/welcome"
        className="mt-8 inline-block rounded-2xl bg-grass-500 px-8 py-4 font-display text-lg font-extrabold uppercase tracking-wide text-white shadow-chunky transition hover:bg-grass-600 active:translate-y-1 active:shadow-chunky-sm"
      >
        Start setup
      </Link>
      <Link
        href="/"
        className="mt-4 text-sm font-bold text-gray-500 hover:text-gray-800"
      >
        Back to home
      </Link>
    </main>
  );
}

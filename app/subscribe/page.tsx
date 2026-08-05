import Link from "next/link";

export default function SubscribePage() {
  // Sona is 100% free — there is nothing to buy. The route stays so old links,
  // emails and App Store metadata never 404; the Stripe rail behind
  // /api/checkout is untouched and returns the moment FREE_MODE flips.
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-sky-50 to-white px-6 py-12 text-center">
      <img src="/coach/echo/echo-celebrate.svg" alt="Echo" className="h-28 w-28 object-contain" />
      <h1 className="mt-5 font-display text-4xl font-extrabold text-gray-900">Sona is free</h1>
      <p className="mt-3 max-w-md text-lg text-gray-600">
        Every game, every sound, every update — no card, no subscription, no ads.
        Built with a licensed pediatric speech-language pathologist.
      </p>
      <a
        href="https://apps.apple.com/app/id6785755867"
        className="mt-7 rounded-2xl bg-grass-500 px-8 py-4 font-display font-extrabold uppercase tracking-wide text-white shadow-chunky transition hover:bg-grass-600"
      >
        Get Sona — free
      </a>
      <Link href="/" className="mt-5 text-sm font-bold text-gray-500 hover:text-gray-800">← Back to sona</Link>
    </main>
  );
}

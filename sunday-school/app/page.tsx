import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
      <div className="animate-fadeUp">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-sky-600">
          For your class
        </p>
        <h1 className="text-4xl font-bold leading-tight text-ink sm:text-5xl">
          Gospel Questions
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-ink/75">
          Everyone writes down the gospel questions on their heart. The class
          sees them all and votes. Then we study the ones that rise to the top —
          with real scriptures and teachings from living prophets and apostles.
        </p>
      </div>

      <div className="mt-10 grid w-full gap-4 sm:grid-cols-2">
        <Link
          href="/host"
          className="group rounded-2xl border border-sky-100 bg-white/80 p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="text-2xl">👩‍🏫</div>
          <div className="mt-2 text-xl font-semibold text-sky-700">
            Start a class
          </div>
          <p className="mt-1 text-sm text-ink/70">
            You&apos;re teaching. Create a room and put the join code on the
            screen.
          </p>
        </Link>

        <Link
          href="/join"
          className="group rounded-2xl border border-gold-400/30 bg-white/80 p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="text-2xl">🙋</div>
          <div className="mt-2 text-xl font-semibold text-gold-500">
            Join a class
          </div>
          <p className="mt-1 text-sm text-ink/70">
            You&apos;re a class member. Enter the code your teacher shows.
          </p>
        </Link>
      </div>

      <p className="mt-12 max-w-md text-xs leading-relaxed text-ink/50">
        Scriptures are shown from the Old &amp; New Testament, Book of Mormon,
        Doctrine &amp; Covenants, and Pearl of Great Price. Quotes link to their
        source so you can confirm them before class.
      </p>
    </main>
  );
}

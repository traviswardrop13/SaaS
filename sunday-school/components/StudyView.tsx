import type { StudyResult } from "@/lib/types";

function verifyUrl(q: { text: string; author: string }): string {
  const query = `${q.author} ${q.text.split(/\s+/).slice(0, 8).join(" ")}`;
  return `https://www.churchofjesuschrist.org/search?lang=eng&query=${encodeURIComponent(query)}`;
}

/** Renders the scriptures + prophetic quotes gathered for a chosen question. */
export default function StudyView({ study }: { study: StudyResult }) {
  return (
    <div className="animate-fadeUp space-y-8">
      <header className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
          Studying
        </p>
        <h2 className="mt-2 text-2xl font-bold leading-snug text-ink sm:text-3xl">
          “{study.question}”
        </h2>
        {study.topics.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {study.topics.map((t) => (
              <span
                key={t}
                className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700"
              >
                {t}
              </span>
            ))}
          </div>
        )}
        {study.framing && (
          <p className="mx-auto mt-4 max-w-2xl text-base italic leading-relaxed text-ink/75">
            {study.framing}
          </p>
        )}
      </header>

      {/* Scriptures */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-ink">
          <span aria-hidden>📖</span> Scriptures
        </h3>
        {study.verses.length === 0 ? (
          <p className="text-sm text-ink/60">
            No matching verses were found for this question. Try rephrasing it or
            picking a related question.
          </p>
        ) : (
          <ul className="space-y-4">
            {study.verses.map((v) => (
              <li
                key={v.ref}
                className="rounded-xl border border-sky-100 bg-white/80 p-4 shadow-sm"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold text-sky-700">{v.ref}</span>
                  {v.why && (
                    <span className="text-right text-xs text-ink/55">{v.why}</span>
                  )}
                </div>
                <p className="mt-2 leading-relaxed text-ink/90">{v.text}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Quotes */}
      {study.quotes.length > 0 && (
        <section>
          <h3 className="mb-1 flex items-center gap-2 text-lg font-semibold text-ink">
            <span aria-hidden>🕊️</span> Prophets &amp; Apostles
          </h3>
          <p className="mb-3 text-xs text-ink/55">
            Please confirm each quote at its source before sharing in class.
          </p>
          <ul className="space-y-4">
            {study.quotes.map((q, i) => (
              <li
                key={i}
                className="rounded-xl border border-gold-400/30 bg-white/80 p-4 shadow-sm"
              >
                <blockquote className="leading-relaxed text-ink/90">
                  “{q.text}”
                </blockquote>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div className="text-ink/80">
                    <span className="font-semibold">{q.author}</span>
                    {q.role && <span className="text-ink/60"> · {q.role}</span>}
                    {q.source && (
                      <span className="text-ink/55">
                        {" "}
                        — {q.source}
                        {q.year ? ` (${q.year})` : ""}
                      </span>
                    )}
                  </div>
                  <a
                    href={q.sourceUrl || verifyUrl(q)}
                    target="_blank"
                    rel="noreferrer"
                    className="whitespace-nowrap rounded-full bg-gold-400/15 px-3 py-1 text-xs font-medium text-gold-500 hover:bg-gold-400/25"
                  >
                    {q.sourceUrl ? "View source ↗" : "Verify ↗"}
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

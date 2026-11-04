import type { Metadata } from "next";
import {
  APP_STORE, ASK_SLP, AGES, FIND_SLP, GAMES, GUIDES, PROFIND, RACHEL_LINE, RACHEL_REVIEW, RECAST, SITE,
  type Guide, guideBySlug, guidePath, guideShown, isLive, routine,
} from "@/lib/guides";

/**
 * One guide, the same way for every kind (lib/guides.ts says what each one
 * says, and why only a guide Rachel has read is on speaksona.com). Plain
 * server-rendered HTML: a crawler or an AI assistant reads every word without
 * running a script, and the FAQ is open on the page, not behind taps.
 */

const day = (d: string) =>
  new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

export function guideMetadata(g: Guide): Metadata {
  const url = SITE + guidePath(g);
  return {
    title: { absolute: g.title },
    description: g.description,
    alternates: { canonical: url },
    // A guide Rachel has not read yet is shown only off speaksona.com, for her
    // to read, and never to a search engine.
    robots: isLive(g) ? undefined : { index: false, follow: false },
    openGraph: {
      type: "article", siteName: "Sona", url, title: g.h1, description: g.description,
      images: [{ url: "https://speaksona.com/og-parents.png", width: 1200, height: 630 }],
    },
  };
}

/** What search engines and AI assistants read about the page (schema.org). */
export function guideLd(g: Guide): object[] {
  const url = SITE + guidePath(g);
  const sona = { "@type": "Organization", name: "Sona", url: SITE + "/" };
  const page: Record<string, unknown> = {
    "@context": "https://schema.org", "@type": "Article", headline: g.h1, description: g.description,
    url, mainEntityOfPage: url, inLanguage: "en-US", author: sona, publisher: { ...sona, logo: SITE + "/icon-512.png" },
  };
  if (isLive(g)) {
    page.datePublished = g.reviewed;
    page.dateModified = g.reviewed;
    page.reviewedBy = {
      "@type": "Person", name: "Rachel Wardrop", honorificSuffix: "MS, CF-SLP",
      jobTitle: "Pediatric speech-language pathologist in her clinical fellowship", worksFor: sona,
    };
  }
  const crumbs = [{ name: "Sona", item: SITE + "/" }, { name: "Guides", item: SITE + "/guides" }];
  if (g.slug) crumbs.push({ name: g.h1, item: url });
  const out: object[] = [
    page,
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, ...c })) },
    {
      "@context": "https://schema.org", "@type": "FAQPage",
      mainEntity: g.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ];
  if (g.apps) {
    out.push({
      "@context": "https://schema.org", "@type": "ItemList", name: g.h1,
      itemListElement: g.apps.map((a, i) => ({ "@type": "ListItem", position: i + 1, name: a.name })),
    });
  }
  return out;
}

function Ld({ g }: { g: Guide }) {
  // "<" escaped, so no string in the data can close the script tag.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(guideLd(g)).replace(/</g, "\\u003c") }} />;
}

function Cta() {
  return (
    <section className="g-cta">
      <img src="/assets/site/echo.webp" alt="" width="96" height="96" loading="lazy" />
      <div>
        <h2>Practice this with Sona</h2>
        <p>
          Sona turns this practice into games and picture books. Echo says a word that starts with your child’s sound, your
          child says it back, and the game moves on. A try counts only when the phone hears your child’s voice, and every
          check happens on the phone: no audio ever leaves it. Practice, not a test.
        </p>
        <p className="g-rachel">{RACHEL_LINE}</p>
        <a className="g-btn" href={APP_STORE} data-store="">Try Sona free</a>
        <p className="g-small" data-store-note="">Free to try on iPhone and iPad</p>
      </div>
    </section>
  );
}

function AskSlp({ g }: { g: Guide }) {
  // One line per age: "about 5 or older and still swaps S", "about 6 … Z".
  const byAge = new Map<number, string[]>();
  for (const s of (g.sounds || []).filter((x) => x.words.length)) byAge.set(s.age, [...(byAge.get(s.age) || []), s.name.replace(/ \(as in \w+\)/, "")]);
  const [before, after] = FIND_SLP.split("ASHA’s ProFind");
  return (
    <section>
      <h2>When to ask a speech-language pathologist</h2>
      <p>Ask a speech-language pathologist if:</p>
      <ul>
        {[...byAge].map(([age, names]) => <li key={age}>your child is about {age} or older and still swaps {names.join(" or ")},</li>)}
        {ASK_SLP.map((t) => <li key={t}>{t}</li>)}
      </ul>
      <p>{before}<a href={PROFIND} rel="noopener">ASHA’s ProFind</a>{after}</p>
    </section>
  );
}

function Faq({ g }: { g: Guide }) {
  return (
    <section className="g-faq">
      <h2>Questions parents ask</h2>
      {g.faq.map((f) => (
        <div key={f.q}>
          <h3>{f.q}</h3>
          <p>{f.a}</p>
        </div>
      ))}
    </section>
  );
}

function Related({ g, env }: { g: Guide; env?: string }) {
  const list = g.related.map(guideBySlug).filter((r): r is Guide => !!r && guideShown(r, env));
  if (!list.length) return null;
  return (
    <section className="g-related">
      <h2>More guides</h2>
      <ul>{list.map((r) => <li key={r.slug}><a href={guidePath(r)}>{r.h1}</a></li>)}</ul>
    </section>
  );
}

function SoundBody({ g }: { g: Guide }) {
  const sounds = g.sounds || [];
  const main = sounds[0];
  return (
    <>
      <section>
        <h2>When kids usually get it</h2>
        <table className="g-table">
          <thead><tr><th scope="col">Sound</th><th scope="col">Many children have it by about</th><th scope="col">Before then, you may hear</th></tr></thead>
          <tbody>
            {sounds.map((s) => <tr key={s.key}><td>{s.name}</td><td>age {s.age}</td><td>{s.swaps.join("; ")}</td></tr>)}
          </tbody>
        </table>
        <p className="g-small">Every child is different. Some get a sound earlier, and some a little later.</p>
      </section>
      {g.why ? <section><h2>Why it’s tricky</h2><p>{g.why}</p></section> : null}
      <section>
        <h2>How to make the sound</h2>
        {sounds.map((s) => (
          <div key={s.key}>{sounds.length > 1 ? <h3>{s.name}</h3> : null}<p>{s.made}</p></div>
        ))}
        <p>A mirror helps: sit side by side so your child can watch your mouth, then theirs.</p>
      </section>
      <section>
        <h2>A 5-minute routine</h2>
        <ol className="g-steps">{routine(main).map((t) => <li key={t}>{t}</li>)}</ol>
        {sounds.slice(1).filter((s) => s.syllables.length).map((s) => (
          <p key={s.key}>For {s.name}, do the same with {s.alone}, then {s.syllables.join(", ")}.</p>
        ))}
        <p>If a step is too hard, go back one. A child who ends on something they can do wants to come back tomorrow.</p>
      </section>
      <section>
        <h2>Words to practice</h2>
        {sounds.filter((s) => s.words.length).map((s) => (
          <div key={s.key}>
            {sounds.filter((x) => x.words.length).length > 1 ? <h3>{s.name} words</h3> : null}
            <ul className="g-words">{s.words.map((w) => <li key={w}>{w}</li>)}</ul>
          </div>
        ))}
        <p className="g-small">Each one starts with the sound. Start there: words with the sound in the middle or at the end come later.</p>
      </section>
      {(g.sections || []).map((s) => <Block key={s.h} s={s} />)}
      <section><h2>Say it back, don’t correct</h2>{RECAST.map((t) => <p key={t}>{t}</p>)}</section>
      <section><h2>Games to play at home</h2><ul>{GAMES.map((t) => <li key={t}>{t}</li>)}</ul></section>
    </>
  );
}

function Block({ s }: { s: NonNullable<Guide["sections"]>[number] }) {
  return (
    <section>
      <h2>{s.h}</h2>
      {s.steps ? <ol className="g-steps">{s.steps.map((t) => <li key={t}>{t}</li>)}</ol> : null}
      {(s.paras || []).map((t) => <p key={t}>{t}</p>)}
      {s.bullets ? <ul>{s.bullets.map((t) => <li key={t}>{t}</li>)}</ul> : null}
    </section>
  );
}

function HubBody({ g, env }: { g: Guide; env?: string }) {
  const sounds = GUIDES.filter((x) => x.kind === "sound" && guideShown(x, env));
  const apps = GUIDES.filter((x) => x.kind === "apps" && guideShown(x, env));
  return (
    <>
      {(g.sections || []).map((s) => <Block key={s.h} s={s} />)}
      <section>
        <h2>Which sounds come when</h2>
        <table className="g-table">
          <thead><tr><th scope="col">Many children have these by about</th><th scope="col">Sounds</th></tr></thead>
          <tbody>{AGES.map((a) => <tr key={a.age}><td>age {a.age}</td><td>{a.sounds}</td></tr>)}</tbody>
        </table>
        <p className="g-small">Every child is different. Some get a sound earlier, and some a little later. There’s no need to push a sound before it usually comes in.</p>
      </section>
      {sounds.length ? (
        <section className="g-related">
          <h2>Guides by sound</h2>
          <ul>{sounds.map((r) => <li key={r.slug}><a href={guidePath(r)}>{r.h1}</a></li>)}</ul>
        </section>
      ) : null}
      {apps.length ? (
        <section className="g-related">
          <h2>Apps for speech practice</h2>
          <ul>{apps.map((r) => <li key={r.slug}><a href={guidePath(r)}>{r.h1}</a></li>)}</ul>
        </section>
      ) : null}
    </>
  );
}

function AppsBody({ g, env }: { g: Guide; env?: string }) {
  const hub = guideBySlug("");
  return (
    <>
      {g.disclosure ? <aside className="g-note"><p>{g.disclosure}</p></aside> : null}
      {(g.sections || []).map((s) => <Block key={s.h} s={s} />)}
      {(g.apps || []).map((a, i) => (
        <section key={a.name} className={"g-app" + (a.ours ? " ours" : "")}>
          <h2>{i + 1}. {a.name}{a.ours ? <span className="g-tag">Our app</span> : null}</h2>
          <p className="g-small">By {a.maker}</p>
          <dl>
            <dt>Best for</dt><dd>{a.bestFor}</dd>
            <dt>How kids practice</dt><dd>{a.how}</dd>
            <dt>Where</dt><dd>{a.where}</dd>
            <dt>Good to know</dt><dd>{a.note}</dd>
          </dl>
        </section>
      ))}
      <section>
        <h2>No app at all</h2>
        <p>
          Five minutes a day with a few picture cards works too: the sound on its own, then the sound with a vowel, then
          short words, ending on a win.{" "}
          {hub && guideShown(hub, env) ? <a href={guidePath(hub)}>Our guide to speech practice at home</a> : null}
          {hub && guideShown(hub, env) ? " walks through it." : null}
        </p>
      </section>
    </>
  );
}

export default function GuideView({ g, env = process.env.VERCEL_ENV }: { g: Guide; env?: string }) {
  return (
    <main className="g-main">
      <Ld g={g} />
      <nav className="g-crumbs" aria-label="Breadcrumb">
        <a href="/">Sona</a> <span aria-hidden="true">›</span> <a href="/guides">Guides</a>
        {g.slug ? <> <span aria-hidden="true">›</span> <span>{g.h1}</span></> : null}
      </nav>
      {isLive(g) ? null : (
        <p className="g-draft" role="note">Draft for Rachel’s review. It is not on speaksona.com, and search engines are told to skip it.</p>
      )}
      <h1>{g.h1}</h1>
      <p className="g-lead">{g.answer}</p>
      <p className="g-by">
        {isLive(g) ? `Written by the Sona team. ${RACHEL_REVIEW}, on ${day(g.reviewed as string)}.` : "Written by the Sona team."}
      </p>
      {g.kind === "sound" ? <SoundBody g={g} /> : g.kind === "hub" ? <HubBody g={g} env={env} /> : <AppsBody g={g} env={env} />}
      {g.kind !== "apps" ? <AskSlp g={g} /> : null}
      <Cta />
      <Faq g={g} />
      <Related g={g} env={env} />
    </main>
  );
}

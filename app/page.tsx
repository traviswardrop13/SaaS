import Link from "next/link";

/**
 * Sona — marketing landing page (web-first product surface).
 *
 * Positioning: a premium at-home speech *coach* for kids, designed with a
 * licensed speech-language pathologist. Deliberately framed as a "program"
 * (web dashboard + live coach), which anchors perceived value to private
 * coaching rather than to the $5 app shelf — supporting a $49–99/mo price.
 *
 * Regulatory line (the founder's spouse is an SLP): we say "practice" and
 * "coach", never "therapy/therapist/diagnosis/treatment". Camera is never used;
 * audio isn't stored. No medical/outcome claims.
 */
export const metadata = {
  title: "Sona — speech practice kids actually love",
  description:
    "Sona turns speech sounds into a game kids love — a friendly coach listens to each try and gives feedback, built with a licensed speech-language pathologist. Try it free.",
};

export default function Landing() {
  return (
    <main className="min-h-screen bg-white text-gray-800">
      {/* Native app (App Store build) opens straight into the app, not this
          marketing/pricing page — Apple forbids non-IAP checkout in-app. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `if(typeof window!=="undefined"&&window.Capacitor)location.replace("/today.html");`,
        }}
      />
      <Hero />
      <HowItWorks />
      <LiveCoach />
      <ParentValue />
      <Pricing />
      <Safety />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}

/* ─────────────────────────── Header ─────────────────────────── */
function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-gray-100 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
        <Link href="/" className="flex items-center gap-2">
          <img src="/coach/leo-icon.png" alt="Sona" className="h-8 w-8 object-contain" />
          <span className="font-display text-2xl font-extrabold text-brand-600">
            Sona
          </span>
          <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-amber-900">
            Beta
          </span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-bold text-gray-600 sm:flex">
          <a href="#how" className="hover:text-gray-900">
            How it works
          </a>
          <a href="#pricing" className="hover:text-gray-900">
            Pricing
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <a
            href="/map.html"
            className="hidden text-sm font-bold text-gray-600 hover:text-gray-900 sm:block"
          >
            Open app
          </a>
          <a href="/onboarding.html" className="btn-primary text-sm">
            Get started
          </a>
        </div>
      </div>
    </header>
  );
}

/* ─────────────────────────── Hero ─────────────────────────── */
function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-brand-50 to-white" />
      <div className="relative mx-auto max-w-2xl px-5 py-14 text-center sm:py-20">
        {/* logo lockup: Leo + Sona */}
        <div className="flex items-center justify-center gap-3">
          <img src="/coach/leo-icon.png" alt="Leo" className="h-14 w-14 object-contain" />
          <span className="font-display text-4xl font-extrabold text-gray-900">Sona</span>
          <span className="rounded-full bg-brand-400 px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-white">
            Beta
          </span>
        </div>

        <h1 className="mt-12 font-display text-4xl font-extrabold leading-[1.05] text-gray-900 sm:text-6xl">
          Speech practice kids<br />actually want to do.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-gray-600">
          Sona turns speech sounds into a game your child loves —<br />
          AI listens to every word, gives feedback, and tracks real progress.
        </p>
        <div className="mt-8 flex justify-center">
          <a href="/onboarding.html" className="btn-primary text-lg">
            Try it free
          </a>
        </div>
        <div className="mx-auto mt-7 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-gray-600 shadow-chunky-sm">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-xs font-extrabold text-white">
            ✓
          </span>
          Built by a licensed speech-language pathologist
        </div>
        <p className="mt-4 text-sm font-semibold text-gray-500">
          Free 7-day trial · no credit card
        </p>
      </div>
    </section>
  );
}

/** A stylized "live session" stage — the product's signature moment. */
function CoachStage() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="rounded-[2rem] bg-white p-3 shadow-chunky">
        <div className="relative overflow-hidden rounded-[1.5rem] bg-gradient-to-b from-brand-400/20 to-brand-50">
          <div className="flex aspect-[4/5] flex-col items-center justify-center px-6">
            <img src="/coach/leo-icon.png" alt="Leo" className="h-36 w-36 object-contain" />
            <div className="mt-4 rounded-2xl bg-white px-5 py-3 shadow-chunky-sm">
              <p className="font-display text-lg font-extrabold text-gray-800">
                &ldquo;Let&apos;s try <span className="text-brand-600">rabbit</span> — your turn!&rdquo;
              </p>
            </div>
          </div>
          <span className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-extrabold text-brand-600 shadow-chunky-sm">
            <span className="h-2 w-2 rounded-full bg-brand-500" /> today
          </span>
        </div>
      </div>
      {/* floating "score" chip */}
      <div className="absolute -bottom-4 -right-3 rotate-3 rounded-2xl bg-brand-500 px-4 py-2 text-white shadow-chunky">
        <p className="font-display text-sm font-extrabold">Great job! ⭐⭐⭐</p>
      </div>
    </div>
  );
}

/* ─────────────────────────── Trust bar ─────────────────────────── */
function TrustBar() {
  const items = [
    "Built with a licensed SLP",
    "Camera never used — audio only",
    "Recordings stay on your device",
    "Ages 3–9",
  ];
  return (
    <div className="border-y border-gray-100 bg-gray-50">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-5 py-4 text-center text-sm font-bold text-gray-500">
        {items.map((t) => (
          <span key={t} className="flex items-center gap-2">
            <span className="text-brand-500">✓</span>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────── How it works ─────────────────────────── */
function HowItWorks() {
  const steps = [
    {
      emoji: "🎧",
      title: "A quick sound check",
      body: "Your child says a few words and Sona builds a personalized plan — so practice targets exactly the sounds that need it.",
    },
    {
      emoji: "🎮",
      title: "Play a quick round",
      body: "Leo says a word, your child says it back out loud, and gets instant stars and gentle feedback — bite-size, playful, and confidence-building.",
    },
    {
      emoji: "📈",
      title: "Progress you can see",
      body: "Every session updates a parent dashboard, so you can watch tricky sounds get stronger week over week.",
    },
  ];
  return (
    <section id="how" className="mx-auto max-w-6xl px-5 py-20">
      <SectionHead
        kicker="How it works"
        title="A daily habit kids look forward to"
        sub="Short, consistent practice beats long and rare. Sona makes it a few friendly minutes a day your child actually wants to do."
      />
      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        {steps.map((s, i) => (
          <div key={s.title} className="card">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-2xl">
              {s.emoji}
            </div>
            <p className="mt-4 text-xs font-extrabold uppercase tracking-wide text-brand-500">
              Step {i + 1}
            </p>
            <h3 className="mt-1 font-display text-xl font-extrabold text-gray-900">
              {s.title}
            </h3>
            <p className="mt-2 text-gray-600">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────── Live coach ─────────────────────────── */
function LiveCoach() {
  const points = [
    "Models each sound clearly, then listens to your child",
    "Instant stars and gentle feedback on every try",
    "Adapts to your child — patient, playful, never frustrated",
    "Streaks and rewards keep them coming back each day",
  ];
  return (
    <section id="coach" className="bg-gray-50">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 lg:grid-cols-2">
        <CoachStage />
        <div>
          <p className="text-sm font-extrabold uppercase tracking-wide text-brand-500">
            The difference
          </p>
          <h2 className="mt-2 font-display text-3xl font-extrabold text-gray-900 sm:text-4xl">
            Not flashcards. A game they talk to.
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Most apps make kids tap pictures. Sona has them say sounds out loud —
            Leo models each one, listens, and rewards every try with stars. It
            feels like a game, and it&apos;s practice that actually moves the
            needle, whenever your child is ready.
          </p>
          <ul className="mt-6 space-y-3">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-brand-500 text-sm font-extrabold text-white">
                  ✓
                </span>
                <span className="font-semibold text-gray-700">{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── Parent value ─────────────────────────── */
function ParentValue() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-20">
      <SectionHead
        kicker="For parents"
        title="Less than a single private session"
        sub="Private 1-on-1 speech support often runs $80+ a session. Sona is unlimited, guided practice at home — for a fraction of that, every month."
      />
      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        <Stat big="$80+" small="Typical cost of one private session" />
        <Stat big="Daily" small="Coaching sessions with Sona" />
        <Stat big="Weekly" small="Progress updates in your dashboard" />
      </div>
    </section>
  );
}

function Stat({ big, small }: { big: string; small: string }) {
  return (
    <div className="card text-center">
      <p className="font-display text-4xl font-extrabold text-brand-600">{big}</p>
      <p className="mt-2 font-semibold text-gray-600">{small}</p>
    </div>
  );
}

/* ─────────────────────────── Pricing ─────────────────────────── */
function Pricing() {
  return (
    <section id="pricing" className="bg-gray-50">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <SectionHead
          kicker="Founding offer"
          title="Become a founding family"
          sub="Sona is live. Join now to lock in 67% off for life — for the first 100 founding families."
        />
        <div className="mx-auto mt-12 max-w-md">
          <PlanCard
            name="Founding Member"
            badge="First 100 families"
            was="$119.99"
            price="$39.99"
            priceSuffix="/yr"
            coupon="67% off"
            yearly="Founding price · billed yearly · cancel anytime"
            blurb="Lock in 67% off for life and start playing today."
            highlight
            features={[
              "Founding access to every level as it unlocks",
              "Founding price — 67% off, locked for life",
              "Every new feature and update as it ships",
              "Your suggestions shape Sona for your child",
              "Priority support",
            ]}
            cta="Start free 7-day trial"
            href="/onboarding.html"
          />
        </div>
        <p className="mx-auto mt-8 max-w-xl text-center text-sm text-gray-500">
          Designed with a licensed speech-language pathologist. Sona supports
          practice at home and is not a substitute for professional care.
        </p>
      </div>
    </section>
  );
}

function PlanCard({
  name,
  price,
  priceSuffix = "/mo",
  was,
  coupon,
  yearly,
  blurb,
  features,
  cta,
  highlight,
  badge,
  href = "/subscribe",
}: {
  name: string;
  price: string;
  priceSuffix?: string;
  was?: string;
  coupon?: string;
  yearly: string;
  blurb: string;
  features: string[];
  cta: string;
  highlight?: boolean;
  badge?: string;
  href?: string;
}) {
  return (
    <div
      className={`relative rounded-3xl bg-white p-7 shadow-chunky ${
        highlight ? "ring-2 ring-brand-500" : ""
      }`}
    >
      {badge ? (
        <span className="absolute -top-3 right-6 rounded-full bg-brand-500 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-white">
          {badge}
        </span>
      ) : null}
      <h3 className="font-display text-2xl font-extrabold text-gray-900">{name}</h3>
      <p className="mt-1 text-gray-600">{blurb}</p>
      <div className="mt-5 flex flex-wrap items-end gap-2">
        {was ? (
          <span className="mb-2 text-2xl font-bold text-gray-400 line-through">
            {was}
          </span>
        ) : null}
        <span className="font-display text-5xl font-extrabold text-gray-900">
          {price}
        </span>
        <span className="mb-1.5 font-bold text-gray-500">{priceSuffix}</span>
        {coupon ? (
          <span className="mb-2 rounded-full bg-grass-500 px-2.5 py-1 text-xs font-extrabold uppercase tracking-wide text-white shadow-chunky-sm">
            {coupon}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-sm font-bold text-brand-600">{yearly}</p>
      <Link
        href={href}
        className="mt-6 block w-full rounded-2xl bg-brand-500 px-6 py-3 text-center font-display font-extrabold uppercase tracking-wide text-white shadow-chunky transition hover:bg-brand-600 active:translate-y-1 active:shadow-chunky-sm"
      >
        {cta}
      </Link>
      <ul className="mt-7 space-y-3">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-brand-500 text-xs font-extrabold text-white">
              ✓
            </span>
            <span className="font-semibold text-gray-700">{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─────────────────────────── Safety ─────────────────────────── */
function Safety() {
  const items = [
    {
      emoji: "📷",
      title: "Camera off, always",
      body: "Sessions are audio only. Your child's camera is never used.",
    },
    {
      emoji: "🔒",
      title: "Recordings stay on your device",
      body: "Practice clips save only to your own device so you can hear progress — we don't keep audio on our servers.",
    },
    {
      emoji: "👩‍⚕️",
      title: "Built with an SLP",
      body: "Every activity is designed with a licensed speech-language pathologist.",
    },
  ];
  return (
    <section className="mx-auto max-w-6xl px-5 py-20">
      <SectionHead kicker="Safe by design" title="Built for kids and trusted by parents" />
      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        {items.map((i) => (
          <div key={i.title} className="card">
            <div className="text-3xl">{i.emoji}</div>
            <h3 className="mt-3 font-display text-lg font-extrabold text-gray-900">
              {i.title}
            </h3>
            <p className="mt-1 text-gray-600">{i.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────── FAQ ─────────────────────────── */
function FAQ() {
  const qs = [
    {
      q: "What ages is Sona for?",
      a: "Sona is built for children roughly ages 3 to 9 who are working on speech sounds and clear talking.",
    },
    {
      q: "Is this speech therapy?",
      a: "No. Sona is a practice and coaching tool designed with a licensed speech-language pathologist. It supports practice at home and is not a substitute for professional care.",
    },
    {
      q: "When can my child start?",
      a: "Right away — start your free 7-day trial and your child can play today, with new levels rolling out.",
    },
    {
      q: "Is the app ready today?",
      a: "Yes — Sona's speech games are live now. Start a free 7-day trial to play today, and you'll get every new level and feature as it ships.",
    },
    {
      q: "How does the founding price work?",
      a: "Sona is live. Start with a free 7-day trial — no credit card — then the founding price (67% off for life: $39.99/yr instead of $119.99), locked in for the first 100 families. Cancel anytime.",
    },
  ];
  return (
    <section className="bg-gray-50">
      <div className="mx-auto max-w-3xl px-5 py-20">
        <SectionHead kicker="Questions" title="Good to know" />
        <div className="mt-10 space-y-4">
          {qs.map((item) => (
            <div key={item.q} className="card">
              <h3 className="font-display text-lg font-extrabold text-gray-900">
                {item.q}
              </h3>
              <p className="mt-2 text-gray-600">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── Final CTA ─────────────────────────── */
function FinalCTA() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-20">
      <div className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-500 to-brand-600 px-8 py-14 text-center shadow-chunky">
        <h2 className="font-display text-3xl font-extrabold text-white sm:text-4xl">
          Ready to make speech practice fun?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-lg text-brand-50">
          Start your free 7-day trial — no credit card. Your child can play
          today, and you&apos;ll get every new level as it ships.
        </p>
        <a
          href="/onboarding.html"
          className="mt-8 inline-block rounded-2xl bg-white px-8 py-4 font-display text-lg font-extrabold uppercase tracking-wide text-brand-600 shadow-chunky transition active:translate-y-1 active:shadow-chunky-sm"
        >
          Get started free
        </a>
      </div>
    </section>
  );
}

/* ─────────────────────────── Footer ─────────────────────────── */
function Footer() {
  return (
    <footer className="border-t border-gray-100">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-10 sm:flex-row">
        <div className="flex items-center gap-2">
          <img src="/coach/leo-icon.png" alt="Leo" className="h-7 w-7 object-contain" />
          <span className="font-display text-lg font-extrabold text-brand-600">
            Sona
          </span>
        </div>
        <div className="flex items-center gap-6 text-sm font-bold text-gray-500">
          <Link href="/privacy" className="hover:text-gray-800">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-gray-800">
            Terms
          </Link>
          <Link href="/support" className="hover:text-gray-800">
            Support
          </Link>
        </div>
      </div>
      <p className="mx-auto max-w-2xl px-5 pb-10 text-center text-xs text-gray-400">
        Sona is a speech &amp; language practice tool designed with a licensed
        speech-language pathologist. It supports practice at home and is not a
        substitute for professional care.
      </p>
    </footer>
  );
}

/* ─────────────────────────── Shared ─────────────────────────── */
function SectionHead({
  kicker,
  title,
  sub,
}: {
  kicker: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-extrabold uppercase tracking-wide text-brand-500">
        {kicker}
      </p>
      <h2 className="mt-2 font-display text-3xl font-extrabold text-gray-900 sm:text-4xl">
        {title}
      </h2>
      {sub ? <p className="mt-3 text-lg text-gray-600">{sub}</p> : null}
    </div>
  );
}

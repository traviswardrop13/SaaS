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
  title: "Sona — your child's at-home speech coach",
  description:
    "A premium at-home speech coach for kids, designed with a licensed speech-language pathologist. Live coaching sessions, a personalized plan, and progress parents can see.",
};

export default function Landing() {
  return (
    <main className="min-h-screen bg-white text-gray-800">
      <Header />
      <Hero />
      <TrustBar />
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
          <span className="text-2xl" aria-hidden>
            🦁
          </span>
          <span className="font-display text-2xl font-extrabold text-sky-600">
            Sona
          </span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-bold text-gray-600 sm:flex">
          <a href="#how" className="hover:text-gray-900">
            How it works
          </a>
          <a href="#coach" className="hover:text-gray-900">
            The coach
          </a>
          <a href="#pricing" className="hover:text-gray-900">
            Pricing
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="hidden text-sm font-bold text-gray-600 hover:text-gray-900 sm:block"
          >
            Sign in
          </Link>
          <Link href="/welcome" className="btn-primary text-sm">
            Start free
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ─────────────────────────── Hero ─────────────────────────── */
function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-sky-50 to-white" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:py-24 lg:grid-cols-2">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-sky-600 shadow-chunky-sm">
            Designed with a licensed speech-language pathologist
          </span>
          <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] text-gray-900 sm:text-6xl">
            Your child&apos;s at-home{" "}
            <span className="text-sky-600">speech coach</span>.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-gray-600">
            Sona is a live, friendly coach that practices tricky sounds with your
            child — listening, guiding, and cheering them on in real time. A
            personalized plan, daily-life practice, and progress you can see.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/welcome" className="btn-primary text-lg">
              Start a free session
            </Link>
            <a href="#pricing" className="btn-ghost text-lg">
              See plans
            </a>
          </div>
          <p className="mt-4 text-sm font-semibold text-gray-500">
            No credit card to try · Works right in your browser
          </p>
        </div>

        <CoachStage />
      </div>
    </section>
  );
}

/** A stylized "live session" stage — the product's signature moment. */
function CoachStage() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="rounded-[2rem] bg-white p-3 shadow-chunky">
        <div className="relative overflow-hidden rounded-[1.5rem] bg-gradient-to-b from-sky-400/20 to-sky-50">
          <div className="flex aspect-[4/5] flex-col items-center justify-center px-6">
            <div className="text-[7rem] leading-none" aria-hidden>
              🦁
            </div>
            <div className="mt-4 rounded-2xl bg-white px-5 py-3 shadow-chunky-sm">
              <p className="font-display text-lg font-extrabold text-gray-800">
                &ldquo;Let&apos;s try <span className="text-sky-600">rabbit</span> — your turn!&rdquo;
              </p>
            </div>
          </div>
          <span className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-extrabold text-grass-600 shadow-chunky-sm">
            <span className="h-2 w-2 rounded-full bg-grass-500" /> live
          </span>
        </div>
      </div>
      {/* floating "score" chip */}
      <div className="absolute -bottom-4 -right-3 rotate-3 rounded-2xl bg-grass-500 px-4 py-2 text-white shadow-chunky">
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
    "Audio is never stored",
    "Ages 3–9",
  ];
  return (
    <div className="border-y border-gray-100 bg-gray-50">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-5 py-4 text-center text-sm font-bold text-gray-500">
        {items.map((t) => (
          <span key={t} className="flex items-center gap-2">
            <span className="text-grass-500">✓</span>
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
      emoji: "🎙️",
      title: "Live coaching sessions",
      body: "Press go and a friendly coach appears, says a word, listens to your child, and gives warm, real-time feedback — like a coach in their pocket.",
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
        title="A real coaching session, at home"
        sub="Short, consistent practice beats long and rare. Sona makes it a few friendly minutes your child looks forward to."
      />
      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        {steps.map((s, i) => (
          <div key={s.title} className="card">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-2xl">
              {s.emoji}
            </div>
            <p className="mt-4 text-xs font-extrabold uppercase tracking-wide text-sky-500">
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
    "Says each word clearly and models the sound",
    "Listens to your child and responds in the moment",
    "Encourages and adapts — never frustrated, always patient",
    "Keeps sessions short, playful, and confidence-building",
  ];
  return (
    <section id="coach" className="bg-gray-50">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 lg:grid-cols-2">
        <CoachStage />
        <div>
          <p className="text-sm font-extrabold uppercase tracking-wide text-sky-500">
            The difference
          </p>
          <h2 className="mt-2 font-display text-3xl font-extrabold text-gray-900 sm:text-4xl">
            Not flashcards. A coach that talks back.
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Most apps make kids tap pictures. Sona holds an actual back-and-forth
            — the coach speaks, your child answers out loud, and the coach helps
            on the very next breath. It&apos;s the closest thing to a 1-on-1
            session, available whenever your child is ready.
          </p>
          <ul className="mt-6 space-y-3">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-grass-500 text-sm font-extrabold text-white">
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
        sub="Private 1-on-1 speech support often runs $100–250 a session. Sona is unlimited, guided practice at home — for a fraction of that, every month."
      />
      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        <Stat big="$100–250" small="Typical cost of one private session" />
        <Stat big="2–4×" small="Coaching sessions a week with Sona" />
        <Stat big="Every week" small="Progress updates in your dashboard" />
      </div>
    </section>
  );
}

function Stat({ big, small }: { big: string; small: string }) {
  return (
    <div className="card text-center">
      <p className="font-display text-4xl font-extrabold text-sky-600">{big}</p>
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
          kicker="Pricing"
          title="One simple plan"
          sub="Start with a free session — no card needed. One premium plan, everything included, cancel anytime. Yearly billing saves about two months."
        />
        <div className="mx-auto mt-12 max-w-md">
          <PlanCard
            name="Sona"
            badge="Everything included"
            price="$99"
            yearly="$79/mo billed yearly"
            blurb="Your child's personal speech coach, on screen the whole session."
            highlight
            features={[
              "Live realistic coach — on screen the entire session",
              "Up to 4 coaching sessions a week",
              "15-minute sessions",
              "Personalized plan from the sound check",
              "Real-time feedback on every sound",
              "Weekly progress report for parents",
              "Up to 3 children",
              "Cancel anytime",
            ]}
            cta="Start 7-day free trial"
            href="/subscribe"
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
  yearly,
  blurb,
  features,
  cta,
  highlight,
  badge,
  href = "/welcome",
}: {
  name: string;
  price: string;
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
        highlight ? "ring-2 ring-sky-500" : ""
      }`}
    >
      {badge ? (
        <span className="absolute -top-3 right-6 rounded-full bg-sky-500 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-white">
          {badge}
        </span>
      ) : null}
      <h3 className="font-display text-2xl font-extrabold text-gray-900">{name}</h3>
      <p className="mt-1 text-gray-600">{blurb}</p>
      <div className="mt-5 flex items-end gap-1">
        <span className="font-display text-5xl font-extrabold text-gray-900">
          {price}
        </span>
        <span className="mb-1.5 font-bold text-gray-500">/mo</span>
      </div>
      <p className="mt-1 text-sm font-bold text-grass-600">{yearly}</p>
      <Link
        href={href}
        className="mt-6 block w-full rounded-2xl bg-grass-500 px-6 py-3 text-center font-display font-extrabold uppercase tracking-wide text-white shadow-chunky transition hover:bg-grass-600 active:translate-y-1 active:shadow-chunky-sm"
      >
        {cta}
      </Link>
      <ul className="mt-7 space-y-3">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-grass-500 text-xs font-extrabold text-white">
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
      title: "Audio is never stored",
      body: "We process speech to give feedback, then discard it — only practice scores are kept.",
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
      q: "Do I need to download anything?",
      a: "No — Sona runs right in your browser on a computer or tablet. A free app is coming for phones.",
    },
    {
      q: "Can I cancel anytime?",
      a: "Yes. Plans are month-to-month (or yearly) and you can cancel whenever you like.",
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
      <div className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-sky-500 to-sky-600 px-8 py-14 text-center shadow-chunky">
        <h2 className="font-display text-3xl font-extrabold text-white sm:text-4xl">
          Try a free session today
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-lg text-sky-50">
          See your child light up when the coach says hello. No card required.
        </p>
        <Link
          href="/welcome"
          className="mt-8 inline-block rounded-2xl bg-white px-8 py-4 font-display text-lg font-extrabold uppercase tracking-wide text-sky-600 shadow-chunky transition active:translate-y-1 active:shadow-chunky-sm"
        >
          Start free
        </Link>
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
          <span className="text-xl" aria-hidden>
            🦁
          </span>
          <span className="font-display text-lg font-extrabold text-sky-600">
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
          <Link href="/dashboard" className="hover:text-gray-800">
            Sign in
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
      <p className="text-sm font-extrabold uppercase tracking-wide text-sky-500">
        {kicker}
      </p>
      <h2 className="mt-2 font-display text-3xl font-extrabold text-gray-900 sm:text-4xl">
        {title}
      </h2>
      {sub ? <p className="mt-3 text-lg text-gray-600">{sub}</p> : null}
    </div>
  );
}

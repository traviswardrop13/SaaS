import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support — Sona",
  description: "Get help with Sona.",
};

// NOTE: replace with your real support email before App Store submission.
const SUPPORT_EMAIL = "support@sona.app";

export default function SupportPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-[#3c3c3c]">
      <h1 className="text-3xl font-extrabold text-[#ea580c]">Sona Support</h1>
      <p className="mt-4 leading-relaxed">
        Sona is a friendly, game-style way for kids to practice tricky speech
        sounds — built with a licensed speech-language pathologist. We&apos;re
        happy to help.
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-extrabold">Contact us</h2>
        <p className="mt-2">
          Email{" "}
          <a className="text-[#1cb0f6] underline" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>{" "}
          and we&apos;ll get back to you.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-extrabold">Common questions</h2>
        <Faq q="How does the sound check work?">
          Your child names a few pictures out loud. The app listens and builds a
          personalized practice plan focused on the sounds that need the most
          work. You can re-run it anytime from the parent dashboard.
        </Faq>
        <Faq q="Do you store my child's voice?">
          Short practice clips are sent to our speech-scoring provider only to
          measure pronunciation, then used to return a score. We don&apos;t use
          them to identify your child or for advertising. See our{" "}
          <a className="text-[#1cb0f6] underline" href="/privacy">
            Privacy Policy
          </a>
          .
        </Faq>
        <Faq q="The microphone isn't working.">
          Make sure Sona has microphone permission in your device&apos;s
          Settings, and that you&apos;re connected to the internet (scoring runs
          online).
        </Faq>
        <Faq q="How do I turn on practice reminders?">
          Open the parent dashboard (tap your child&apos;s avatar at the top of
          the home screen) and turn on the Daily reminder.
        </Faq>
        <Faq q="Is Sona a replacement for speech therapy?">
          No. Sona supports practice and is not a medical device or a substitute
          for professional speech-language services. If you have concerns about
          your child&apos;s speech, please consult a licensed professional.
        </Faq>
      </section>
    </main>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <p className="font-extrabold">{q}</p>
      <p className="mt-1 leading-relaxed text-[#555]">{children}</p>
    </div>
  );
}

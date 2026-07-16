import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support — Sona",
  description: "Get help with Sona.",
};

// NOTE: replace with your real support email before launch.
const SUPPORT_EMAIL = "wardroptravis@gmail.com";

export default function SupportPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-[#1f2937]">
      <h1 className="text-3xl font-extrabold text-[#0e9add]">Sona Support</h1>
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
          Sessions run in your browser, so allow microphone access when prompted
          (or in your browser&apos;s site settings), and make sure you&apos;re on
          a stable internet connection.
        </Faq>
        <Faq q="How do I manage or cancel my subscription?">
          You can cancel anytime from your account, or email us and we&apos;ll
          take care of it. Cancelling stops future charges and you keep access
          through the end of your billing period. See our{" "}
          <a className="text-[#0e9add] underline" href="/terms">Terms</a>.
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

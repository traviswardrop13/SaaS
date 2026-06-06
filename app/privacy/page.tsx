import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Sona",
  description: "How Sona handles your family's information.",
};

// NOTE: Replace SUPPORT_EMAIL and the effective date with your real details
// before submitting to the App Store. Have this reviewed by a professional
// before launch — this is a starting template, not legal advice.
const SUPPORT_EMAIL = "support@sona.app";
const EFFECTIVE = "June 2026";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-[#3c3c3c]">
      <h1 className="text-3xl font-extrabold text-[#ea580c]">Privacy Policy</h1>
      <p className="mt-1 text-sm text-[#777]">Effective {EFFECTIVE}</p>

      <p className="mt-6 leading-relaxed">
        Sona is a speech &amp; language practice app for children, built with a
        licensed speech-language pathologist. We designed it to collect as
        little information as possible. This policy explains what we do and
        don&apos;t do with your family&apos;s data.
      </p>

      <Section title="Information stored on your device">
        Your child&apos;s name, chosen avatar, practice progress, stars, coins,
        and settings are stored <strong>locally on your device</strong>. We do
        not require an account, and this information is not uploaded to us.
      </Section>

      <Section title="Microphone &amp; voice recordings">
        When your child practices a sound, the app records a short audio clip
        and sends it to our speech-scoring provider (Speechace) to measure
        pronunciation and return a score. These clips are used only to produce
        that score. We do not use them to identify your child, build a profile,
        or for advertising, and we do not sell them. Audio is not recorded
        unless your child is actively doing a speaking activity.
      </Section>

      <Section title="Third-party processors">
        We use a small number of service providers strictly to operate the app:
        <ul className="mt-2 list-disc pl-6">
          <li>
            <strong>Speechace</strong> — processes practice audio to score
            pronunciation.
          </li>
          <li>
            <strong>Vercel</strong> — hosts our scoring service.
          </li>
        </ul>
        These providers process data only on our behalf to deliver the app.
      </Section>

      <Section title="Children&apos;s privacy (COPPA)">
        Sona is intended to be set up and managed by a parent or guardian. We do
        not knowingly collect personal information from children, do not show
        third-party advertising, and do not include social features. A parent
        controls all settings and can clear all data at any time by removing the
        app.
      </Section>

      <Section title="No ads, no tracking">
        Sona contains no third-party advertising and no cross-app tracking.
      </Section>

      <Section title="Your choices">
        You can turn off the microphone in your device settings, turn off
        reminders in the app, and delete all locally-stored data by uninstalling
        the app.
      </Section>

      <Section title="Contact">
        Questions about this policy? Email us at{" "}
        <a className="text-[#1cb0f6] underline" href={`mailto:${SUPPORT_EMAIL}`}>
          {SUPPORT_EMAIL}
        </a>
        .
      </Section>

      <p className="mt-10 text-xs text-[#afafaf]">
        Sona supports speech practice and is not a medical device or a
        substitute for professional speech-language services.
      </p>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-7">
      <h2 className="text-lg font-extrabold text-[#3c3c3c]">{title}</h2>
      <div className="mt-2 leading-relaxed">{children}</div>
    </section>
  );
}

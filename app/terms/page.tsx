import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Sona",
  description: "The terms for using Sona.",
};

/**
 * TEMPLATE — not legal advice. Fill in bracketed details and have a lawyer
 * review before launch, especially the billing, liability, and arbitration
 * sections and your governing-law choice.
 */
const COMPANY = "Wardrop Ventures LLC";
const SUPPORT_EMAIL = "wardroptravis@gmail.com";
const GOVERNING_LAW = "the State of Florida, United States";
const EFFECTIVE = "September 2026";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-[#1f2937]">
      <h1 className="text-3xl font-extrabold text-[#0e9add]">Terms of Service</h1>
      <p className="mt-1 text-sm text-[#6b7280]">Effective {EFFECTIVE}</p>

      <p className="mt-6 leading-relaxed">
        These Terms govern your use of Sona, operated by {COMPANY} (&ldquo;we&rdquo;,
        &ldquo;us&rdquo;). By creating an account or using Sona you agree to these
        Terms. Please read them with our{" "}
        <a className="text-[#0e9add] underline" href="/privacy">Privacy Policy</a>.
      </p>

      <Section title="Who can use Sona">
        You must be at least 18 and the parent or legal guardian of any child who
        uses Sona. You&apos;re responsible for setting up the account, supervising
        your child&apos;s use, and keeping your login secure.
      </Section>

      <Section title="What Sona is — and isn't">
        Sona is an at-home <strong>speech practice and coaching</strong> tool
        designed with a licensed pediatric speech-language pathologist (Clinical
        Fellow). It is{" "}
        <strong>not therapy, not a medical device, not a diagnosis, and not a
        substitute for professional speech-language services</strong>. If you have
        concerns about your child&apos;s speech or development, please consult a
        qualified professional.
      </Section>

      <Section title="Pricing &amp; billing">
        {/* Sona is paid (FREE_MODE = false in lib/pricing.ts, mirrored by
            public/sona.js). Two prices drive every figure below: $119.88 =
            12 x $9.99, $59.89 = $119.88 - $59.99, and "under $5 a month" =
            $59.99 / 12 ($4.99). Move either price in /api/checkout and all of
            them rot silently — recompute them here, on /subscribe and on the
            static purchase surfaces in the same commit. This is legal copy:
            it states only what the code actually does. */}
        <strong>Sona Yearly</strong> is <strong>$59.99 per year</strong> and starts
        with <strong>3 free days</strong>. Nothing is charged during those days —
        the first charge lands on day 3, and only if you keep Sona.
        <br />
        <br />
        <strong>Sona Monthly</strong> is <strong>$9.99 per month</strong>, billed at
        purchase, with <strong>no free trial</strong>. Prices are in US dollars and
        exclude any applicable taxes. Both plans include every game, every sound
        and the Sound Check, plus every new sound we ship while your plan is
        active.
        <br />
        <br />
        <strong>Yearly saves you $59.89 a year.</strong> Twelve monthly payments
        come to <strong>$119.88</strong>; the same year on the yearly plan is{" "}
        <strong>$59.99</strong> — almost half the price, and under $5 a month.
        <br />
        <br />
        Both plans renew automatically at the price above — $59.99 each year, or
        $9.99 each month — unless you cancel at least 24 hours before the current
        period ends. After checkout, your confirmation page shows the exact date
        and amount of your first charge.
        {/* That last sentence is backed by app/subscribe/success/page.tsx, which
            reads trial_end and the amount back off the real Stripe subscription.
            We deliberately do NOT promise a reminder email: nothing in this repo
            sends one, and a promise no code keeps is the kind that gets found. */}
        <br />
        <br />
        Subscriptions started inside the iOS app are sold and billed by Apple, at
        the price and free-trial length shown in the App Store at the time of
        purchase.
        {/* Apple's price lives in App Store Connect and the paywall renders
            whatever RevenueCat reports, so the figures above cannot be stated as
            Apple's. Name whose terms govern rather than quote a number this repo
            does not control. */}
        <br />
        <br />
        {/* A one-shot grandfather sweep ships with this build, so the free-era
            cohort is already entitled and never meets a paywall. If that sweep is
            ever changed or dropped, this sentence becomes a broken promise —
            delete it in the same commit or not at all. */}
        <strong>
          Families who were already practicing with Sona while it was free keep it
          free.
        </strong>{" "}
        Your access continues at no cost — there is nothing to buy and nothing to
        cancel. Access granted through a verified SLP referral, a pilot place or a
        founding place is also free and is unaffected by these prices.
      </Section>

      <Section title="Canceling &amp; refunds">
        You can cancel anytime. For subscriptions bought through Apple, manage or
        cancel in <strong>Settings &rarr; your Apple ID &rarr; Subscriptions</strong>, and
        refunds are handled by Apple at reportaproblem.apple.com. For
        subscriptions bought on speaksona.com, email us and we will cancel it for
        you.
        {/* The self-serve Stripe billing portal exists (app/api/portal/route.ts)
            but no page links it yet, so this names the path that is actually
            wired. Put the link back here in the commit that ships one. */}
        <br />
        <br />
        Cancel during your 3 free days on the yearly plan and you are never
        charged. The monthly plan has no trial, so the first month is charged at
        purchase. Canceling stops the next renewal and leaves your access in place
        until the period you have already paid for ends. Except where required by
        law, payments already made are non-refundable.
      </Section>

      <Section title="Acceptable use">
        Please don&apos;t misuse Sona — including attempting to disrupt or reverse
        engineer the service, using it for anyone other than your own family,
        reselling access, or uploading unlawful or harmful content. We may suspend
        accounts that violate these Terms.
      </Section>

      <Section title="Your content &amp; our content">
        You keep ownership of information you provide. You grant us a limited
        license to use it to operate the service. Sona&apos;s software, content,
        and branding are owned by us and may not be copied or reused without
        permission.
      </Section>

      <Section title="Disclaimers">
        Sona is provided &ldquo;as is&rdquo; and &ldquo;as available.&rdquo; To
        the fullest extent permitted by law, we disclaim warranties of any kind,
        including fitness for a particular purpose, and we do not warrant any
        particular educational or speech outcome.
      </Section>

      <Section title="Limitation of liability">
        To the fullest extent permitted by law, our total liability for any claim
        relating to Sona is limited to the amount you paid us in the 12 months
        before the claim, and we are not liable for indirect or consequential
        damages.
      </Section>

      <Section title="Changes">
        We may update these Terms; if we make material changes we&apos;ll provide
        reasonable notice. Continuing to use Sona after changes take effect means
        you accept the updated Terms.
      </Section>

      <Section title="Governing law">
        These Terms are governed by the laws of {GOVERNING_LAW}, without regard to
        conflict-of-laws rules.
      </Section>

      <Section title="Contact">
        Questions about these Terms? Email{" "}
        <a className="text-[#0e9add] underline" href={`mailto:${SUPPORT_EMAIL}`}>
          {SUPPORT_EMAIL}
        </a>
        .
      </Section>

      <p className="mt-10 text-xs text-[#9ca3af]">
        This document is a template and not legal advice. Please have it reviewed
        by a qualified attorney before launch.
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
      <h2 className="text-lg font-extrabold text-[#1f2937]">{title}</h2>
      <div className="mt-2 leading-relaxed">{children}</div>
    </section>
  );
}

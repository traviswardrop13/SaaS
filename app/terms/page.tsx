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
const COMPANY = "[Your Company, LLC]";
const SUPPORT_EMAIL = "support@[yourdomain].com";
const GOVERNING_LAW = "[State/Country]";
const EFFECTIVE = "June 2026";

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
        designed with a licensed speech-language pathologist. It is{" "}
        <strong>not therapy, not a medical device, not a diagnosis, and not a
        substitute for professional speech-language services</strong>. If you have
        concerns about your child&apos;s speech or development, please consult a
        qualified professional.
      </Section>

      <Section title="Subscriptions, trials &amp; billing">
        Sona is sold as a recurring subscription. By subscribing you authorize us
        and our payment processor (Stripe) to charge your payment method the
        then-current price (currently $99/month) plus any taxes, on a recurring
        basis until you cancel. If a free trial is offered, you will be charged
        when it ends unless you cancel before then. Prices may change with
        reasonable notice.
      </Section>

      <Section title="Cancellation &amp; refunds">
        You can cancel anytime from your account or by emailing us; cancellation
        stops future charges, and you keep access through the end of the current
        billing period. Except where required by law, payments are non-refundable.
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

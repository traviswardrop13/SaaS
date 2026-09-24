import type { Metadata } from "next";
import { FREE_MODE } from "@/lib/pricing";
import { CASELOAD_NAME, CASELOAD_PRICE, CASELOAD_PER_MONTH, COVERED_REDEEM_CAP } from "@/lib/caseload";

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
        <br />
        <br />
        {/* The clinician dashboard had no clause at all, so "the parent or
            legal guardian of any child" read as if a clinician buying for a
            caseload were outside the Terms. 24 Sep 2026. */}
        If you use Sona&apos;s clinician dashboard, you must be at least 18 and use
        it in your professional work with the families on your caseload. Each
        family still sets up and manages its own child&apos;s account, on its own
        device.
      </Section>

      <Section title="What Sona is — and isn't">
        {/* "(Clinical Fellow)" came out on 24 Sep 2026, as it did from every
            product surface on 23 Sep (CLAUDE.md). She still is one, and nothing
            here says otherwise; the credential line is "licensed" and stops. */}
        Sona is an at-home <strong>speech practice and coaching</strong> tool
        designed with a licensed pediatric speech-language pathologist. It is{" "}
        <strong>not therapy, not a medical device, not a diagnosis, and not a
        substitute for professional speech-language services</strong>. If you have
        concerns about your child&apos;s speech or development, please consult a
        qualified professional.
      </Section>

      <Section title="Pricing &amp; billing">
        {/* One switch, both halves kept. FREE_MODE (lib/pricing.ts, mirrored by
            public/sona.js) is the only thing that moves when Sona flips between
            free and paid; the copy for both states lives here so the next flip
            is a boolean and not a hand-rewrite of legal copy. While it is true
            /api/checkout refuses money outright (410 on POST, 303 to "/" on
            GET), so the free branch must not point anyone at a checkout, and it
            must not promise that free lasts — that has been said before and
            became false. This is legal copy: it states only what the code
            actually does. */}
        {FREE_MODE ? (
          <>
            <strong>Sona is free right now.</strong> Every game, every sound and
            the Sound Check are included at no cost — no card, no free trial and
            nothing to cancel. We are not selling subscriptions while Sona is
            free: checkout declines new purchases, so no new plan can start and
            the app charges you nothing.
            <br />
            <br />
            That describes how Sona is priced today; it is not a promise about
            the future. If paid plans return we will update these Terms and the
            prices shown on the site before anyone is charged.
            <br />
            <br />
            <strong>
              If you already hold a Sona subscription bought while Sona was
              priced, it does not cancel itself.
            </strong>{" "}
            It stays active and keeps renewing at the price you bought it at
            until you cancel it — see Canceling &amp; refunds below for how. The
            terms that follow govern those subscriptions.
            {/* Going free does not touch a live Stripe or Apple subscription:
                nothing in this repo cancels a Stripe one, and Apple's is not
                ours to cancel. The paid terms stay in force for whoever still
                holds a plan, which is why they are rendered here too rather
                than swapped out. */}
            <br />
            <br />
            <PlanTerms />
          </>
        ) : (
          <>
            {/* THE FREE VERSION AND PREMIUM (Travis, 24 Sep 2026). "Paid" no
                longer means a wall: daily practice is never behind the paywall
                (sona.js gated() answers it before any entitlement check, pinned
                in tests/freetest.mjs), so the Terms say so before any price.
                "Four free games", the one phrase every surface uses: gameAccess()
                opens all four to every child, and "two games" understated it. */}
            <strong>Sona has a free version and Premium.</strong> The free version
            — daily practice and free games — costs nothing and needs no
            card. Premium adds every game.
            <br />
            <br />
            <PlanTerms />
            <br />
            <br />
            {/* A one-shot grandfather sweep ships with this build, so the
                free-era cohort is already entitled and never meets a paywall.
                If that sweep is ever changed or dropped, this sentence becomes
                a broken promise — delete it in the same commit or not at all. */}
            <strong>
              Families who were already practicing with Sona while it was free
              keep every game free.
            </strong>{" "}
            Your access continues at no cost — there is nothing to buy and
            nothing to cancel.
            <br />
            <br />
            <ReferralTerms />
          </>
        )}
      </Section>

      {/* The clinician's plan. Rendered in EITHER family-pricing state: it is a
          separate product on its own route (app/api/slp/plan) that deliberately
          does not read FREE_MODE, so its terms cannot hang off that switch.
          Every figure is lib/caseload.ts's — the same constants the checkout
          charges and the dashboard prints. */}
      <Section title="Caseload Premium, for clinicians">
        <CaseloadTerms />
      </Section>

      <Section title="Canceling &amp; refunds">
        {/* Both states: no self-serve cancel link is promised, because none is
            wired. The Stripe billing portal exists (app/api/portal/route.ts)
            but no page links it yet, so this names the path that actually
            works. Put the link back here in the commit that ships one. Apple's
            prices are never quoted — App Store Connect owns those. */}
        {FREE_MODE ? (
          <>
            Sona is free right now, so there is nothing to buy and nothing to
            cancel. If you hold a subscription bought while Sona was priced, it
            keeps renewing until you cancel it — going free does not cancel it
            for you.
          </>
        ) : (
          <>You can cancel anytime.</>
        )}{" "}
        For subscriptions bought through Apple, manage or cancel in{" "}
        <strong>Settings &rarr; your Apple ID &rarr; Subscriptions</strong>, and
        refunds are handled by Apple at reportaproblem.apple.com. For a
        family&apos;s subscription bought on speaksona.com, email us and we will
        cancel it for you. Caseload Premium is canceled from the clinician
        dashboard: <strong>Caseload Premium &rarr; Manage billing</strong>.
        {/* That one IS self-serve: the dashboard's button opens Stripe's
            billing portal for the clinician's own plan (app/api/slp/plan/portal). */}
        <br />
        <br />
        {!FREE_MODE && (
          <>
            A family plan canceled during its 3 free days is never charged. A
            monthly subscription bought before that plan was retired has no trial
            and is charged at the start of each month.{" "}
          </>
        )}
        Canceling stops the next renewal and leaves your access — or, for
        Caseload Premium, your families&apos; Premium — in place until the period
        you have already paid for ends. Except where required by law, payments
        already made are non-refundable.
      </Section>

      <Section title="Acceptable use">
        {/* "for anyone other than your own family" used to stand alone, which
            made a clinician buying Premium for a caseload a breach of the very
            Terms that sell it. The family-plan rule stays; the clinician plan
            is named as what it is. 24 Sep 2026. */}
        Please don&apos;t misuse Sona — including attempting to disrupt or reverse
        engineer the service, using a family&apos;s plan for anyone other than your
        own family, reselling access, or uploading unlawful or harmful content.
        A clinician&apos;s Caseload Premium covering the families on their own
        caseload is what that plan is for, and is not reselling. We may suspend
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

/**
 * The subscription terms themselves. Rendered in BOTH states: while Sona is
 * priced they are the terms of sale, and while it is free they still govern
 * everyone holding a plan bought before the flip, until they cancel.
 *
 * ONE PLAN as of 18 Sep 2026. Monthly was retired; the comparison figures
 * ($119.88, "saves $59.89") went with it, because both were only 12 x $9.99
 * and neither can be stated once nobody can buy the plan they compare to.
 * "Under $5 a month" stays: it is $59.99 / 12 ($4.9991), never written as
 * "$4.99 a month", which would imply $59.88 a year. Move the price and it
 * moves here, on /subscribe, on the landing page and on the static purchase
 * surfaces in the same commit.
 *
 * The MONTHLY paragraph below is deliberately kept. Retiring a plan does not
 * cancel a live subscription: anyone still on $9.99/month bought under these
 * terms and is still governed by them until they cancel.
 */
function PlanTerms() {
  return (
    <>
      <strong>Sona Premium</strong> (the yearly plan, called Sona Yearly before
      24 September 2026) is <strong>$99.99 per year</strong> and starts
      with <strong>3 free days</strong>. Nothing is charged during those days —
      the first charge lands on day 3, and only if you keep Premium.
      <br />
      <br />
      <strong>Charter price.</strong> The first 50 families to subscribe pay a
      charter price of <strong>$59.99 per year</strong> (under $5 a month)
      instead, and keep that price for as long as their subscription continues
      without a break. The price you see at checkout is the price you will be
      charged; once the 50 charter places are taken, new subscriptions are
      $99.99 per year (under $8.50 a month).
      <br />
      <br />
      Prices are in US dollars and exclude any applicable taxes. Premium
      includes every game, for every sound, plus every new game and sound we
      ship while it is active. Daily speech practice is part of the free
      version and is never behind the paywall.
      <br />
      <br />
      Sona Premium renews automatically each year at the price you subscribed
      at unless you cancel at least 24 hours before the current period ends.{" "}
      <strong>
        Sona Monthly ($9.99 per month, billed at purchase, no free trial) is no
        longer sold.
      </strong>{" "}
      If you already hold a monthly subscription it is unaffected: it renews at
      $9.99 each month under these same terms until you cancel it.{" "}
      {!FREE_MODE && (
        <>
          After checkout, your confirmation page shows the exact date and amount
          of your first charge.
        </>
      )}
      {/* That last sentence is backed by app/subscribe/success/page.tsx, which
          reads trial_end and the amount back off the real Stripe subscription.
          We deliberately do NOT promise a reminder email: nothing in this repo
          sends one, and a promise no code keeps is the kind that gets found.
          It is dropped while free because there is no checkout to land on. */}
      <br />
      <br />
      Subscriptions started inside the iOS app are sold and billed by Apple, at
      the price and free-trial length shown in the App Store at the time of
      purchase.
      {/* Apple's price lives in App Store Connect and the paywall renders
          whatever RevenueCat reports, so the figures above cannot be stated as
          Apple's. Name whose terms govern rather than quote a number this repo
          does not control. */}
    </>
  );
}

/**
 * What a family who joins through a clinician's link gets. Before 24 Sep 2026
 * this read "access granted through a verified SLP referral … is free", which
 * stopped being true the day every game became Premium: the link now brings
 * the free version, and every game only while the clinician's caseload is
 * covered. Access and sharing are separate promises (a family who says no to
 * sharing keeps whatever the link gave it), and the families who redeemed a
 * link before this build were promised free and keep it — the era-four sweep
 * in public/sona.js is what makes that sentence true.
 */
function ReferralTerms() {
  return (
    <>
      {/* "Founding Families", not "pilot and founding" (24 Sep 2026). A pilot
          place is what every family becomes on "Yes, share progress", and
          premium() no longer counts it — only a founding pilot (an ff- code)
          keeps every game. "Pilot places are free" read as covering exactly
          the families it no longer covers. */}
      <strong>Families who join through a clinician&apos;s link</strong> get the
      free version at no cost, and every game at no cost while that
      clinician&apos;s caseload is covered by Caseload Premium (below) — whether or
      not the family chooses to share practice with the clinician. Families who
      joined through a clinician&apos;s link before Premium launched keep every
      game free, as they were promised. Founding Families places are free and
      unaffected by these prices.
    </>
  );
}

/**
 * THE CLINICIAN PLAN (Travis, 24 Sep 2026). What the checkout in
 * app/api/slp/plan does, and nothing it doesn't: no trial, yearly, cancel in
 * the billing portal, a cancelled plan runs to the end of the paid year (Stripe
 * keeps it active until then, and so does coverage). The grandfather sentence
 * is lib/caseload.ts's grandfathered(): an account created before this build
 * carries no `terms` stamp and is covered free, because "free forever,
 * unlimited families — for you and every kid on your caseload" is what those
 * clinicians were told when they signed up.
 */
function CaseloadTerms() {
  return (
    <>
      <strong>Caseload Premium</strong> (&ldquo;{CASELOAD_NAME}&rdquo;) is{" "}
      <strong>{CASELOAD_PRICE} per year</strong> ({CASELOAD_PER_MONTH}), bought on speaksona.com by a speech-language
      pathologist or other clinician for the families on their own caseload.
      There is <strong>no free trial</strong>: the first year is charged at
      checkout, and the plan renews automatically each year at the price you
      subscribed at until you cancel.
      <br />
      <br />
      {/* "Every family", never "unlimited". The number is COVERED_REDEEM_CAP
          (app/api/slp/redeem), and it counts successful sign-ups over about a
          year — a second phone or a re-tapped link counts again — not
          distinct families, per code AND per clinician, so a new code does
          not reset it. So it is printed as what it is, sign-ups a year (24 Sep
          2026: "up to 300 families on one link" read as a family count the
          counter does not keep), and the redeem error sends a family who
          meets it to their clinician ("ask your speech therapist to contact
          Sona"), and her to us. */}
      While it is active, the plan covers every family on your caseload: every
      family who joins Sona through your link has Premium, whether or not they
      choose to share practice with you. A single link allows up to{" "}
      {COVERED_REDEEM_CAP} sign-ups a year, counted across every code you have
      used, and we raise it on request. If you cancel, your families keep
      Premium until the end of the year you paid for, and then move to the
      free version, which stays free. The
      price does not depend on how many families join, and you never earn
      anything from families on your own caseload.
      <br />
      <br />
      <strong>Clinicians who signed up before Caseload Premium existed</strong>{" "}
      were promised Sona free for every family on their caseload. That promise
      stands: their caseload has Premium at no cost, with nothing to buy and
      nothing to renew.
      <br />
      <br />
      {/* Never "one phone" (24 Sep 2026): each self link works once, but the
          server sends a few a day and retires none, so a one-device limit
          would be a term nobody keeps. The words are app/api/slp/self's. */}
      If your account uses a work email (or we approve your request for
      access), you may also turn on Premium on your own phone or tablet, at no
      cost, with a link the dashboard emails to your account&apos;s address.
      Each link works once.
    </>
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

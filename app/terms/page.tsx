import type { Metadata } from "next";
import BackLink from "@/app/components/BackLink";
import { FREE_MODE } from "@/lib/pricing";
// On its own line: tests/freetest.mjs pins the FREE_MODE import word for word.
import { WEB_SALES } from "@/lib/pricing";
import {
  CASELOAD_NAME, CASELOAD_PRICE, CASELOAD_PER_MONTH, COVERED_REDEEM_CAP,
  SELF_NAME, SELF_PRICE, SELF_PER_MONTH, LEGACY_CASELOAD_PRICE,
} from "@/lib/caseload";

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
const EFFECTIVE = "October 2026"; // the monthly plan went back on sale on 1 October 2026

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-[#1f2937]">
      <BackLink className="-mt-8 mb-2 text-[#0e9add]" />
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
        {/* Wherever copy presents Sona's SLP it names her: "Rachel, MS, CF-SLP"
            (Travis, 29 Sep 2026, CLAUDE.md). She is in her fellowship year, and
            nothing here says otherwise. */}
        Sona is an at-home <strong>speech practice and coaching</strong> tool
        designed with Rachel, MS, CF-SLP, a pediatric speech-language pathologist in her clinical fellowship. It is{" "}
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
                "Daily practice and free games" is the one phrase every surface
                uses, never a count: the free games have changed more than once
                (three and a free book since 30 Sep 2026). */}
            {/* A SECOND SWITCH UNDER THE FIRST: WEB_SALES (Travis, 1 Oct 2026:
                "i dont want them paying on the website"). While it is false
                /api/checkout refuses both family plans before it touches
                Stripe (410 on POST, 303 to "/" on GET), and a family buys
                Premium only in the iPhone and iPad app, from Apple. So the
                Terms say that first, name no Apple price (App Store Connect
                owns it), and then do what the free branch above does: nobody's
                Stripe subscription was cancelled by this, so the plan terms
                stay, as the terms of the subscriptions already bought here and
                not as an offer. Both inserts sit inside this one arm, so the
                selling state is this arm with nothing added. Never write that
                the plans stopped being sold (chartertest bans the phrase):
                they are still sold, by Apple. */}
            {!WEB_SALES && (
              <>
                {/* "family", every time: two sections down, a clinician's
                    plans ARE new Sona Premium subscriptions sold on
                    speaksona.com, and a lead that says none are contradicts
                    its own page. */}
                <strong>
                  New family subscriptions to Sona Premium are sold in the Sona
                  app on iPhone and iPad, by Apple, at the price and free-trial
                  length shown in the App Store.
                </strong>{" "}
                We are not selling new family subscriptions on speaksona.com. A
                clinician&apos;s plans are still sold here: see Premium for
                clinicians below.
                <br />
                <br />
              </>
            )}
            {/* TRIAL FIRST (Travis, 3 Oct 2026: "lets add the paywall before
                they try anything in the app"). A family who sets Sona up in
                the iPhone or iPad app from that day starts Sona Premium's free
                days to use anything; the free version stays only with the
                families sona.js's freeVersion() names. No length of free days
                is typed here: it is App Store Connect's, like the price. */}
            <strong>Sona Premium opens Sona.</strong> In the Sona app on iPhone
            and iPad, a new family starts Sona Premium, with the free days and
            price shown in the App Store, to use daily practice, every game and
            every book. A free version — daily practice and free games, plus a
            free picture book — costs nothing and needs no card for families who
            set Sona up before October 3, 2026, families who joined through their
            speech therapist&apos;s link, and anywhere Sona Premium cannot be
            bought, such as speaksona.com today.
            <br />
            <br />
            {!WEB_SALES && (
              <>
                <strong>
                  A subscription already bought on speaksona.com keeps working.
                </strong>{" "}
                It stays active and keeps renewing at the price it was bought at
                until you cancel it — see Canceling &amp; refunds below for how.
                The terms that follow govern those subscriptions. Their prices
                and free days are the ones speaksona.com sold them at, not the
                App Store&apos;s.
                <br />
                <br />
              </>
            )}
            <PlanTerms />
            <br />
            <br />
            {/* A one-shot grandfather sweep ships with this build, so the
                free-era cohort is already entitled and never meets a paywall.
                If that sweep is ever changed or dropped, this sentence becomes
                a broken promise — delete it in the same commit or not at all. */}
            <strong>
              Families who were already practicing with Sona while it was free
              keep every game and book free.
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
      <Section title="Premium for clinicians">
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
        cancel it for you. A clinician&apos;s plans are canceled from the
        clinician dashboard: <strong>Premium &rarr; Manage billing</strong>.
        {/* That one IS self-serve: the dashboard's button opens Stripe's
            billing portal for the clinician's plans (app/api/slp/plan/portal). */}
        <br />
        <br />
        {!FREE_MODE && WEB_SALES && (
          <>
            A yearly family plan canceled during its 3 free days is never
            charged. The monthly plan has no free days: it is charged when you
            buy it and at the start of each month after that.{" "}
          </>
        )}
        {/* The two sentences above are the website's checkout: its free days
            and its charge-at-purchase. While the website is not selling they
            are still true of the plans already bought here, and only of
            those: how long a free trial bought in the app runs is Apple's to
            say, and this repo never types it. */}
        {!FREE_MODE && !WEB_SALES && (
          <>
            A yearly family plan bought on speaksona.com and canceled during
            its 3 free days is never charged. A monthly family plan bought there
            has no free days: it was charged when it was bought and is charged
            at the start of each month after that. For a subscription bought in the app, the
            free-trial length is the one the App Store showed at the time of
            purchase.{" "}
          </>
        )}
        Canceling stops the next renewal and leaves your access — or, for a
        clinician&apos;s caseload plan, your families&apos; Premium — in place until the period
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
        A clinician&apos;s Premium for their caseload covering the families on their own
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
 * everyone holding a plan bought before the flip, until they cancel. A third
 * case since 1 Oct 2026: priced, but not sold on the website (WEB_SALES false
 * in lib/pricing.ts). They render then too, under a sentence saying they are
 * the terms of subscriptions already bought on speaksona.com; every figure
 * below is what those were sold at, never Apple's.
 *
 * TWO PLANS again as of 1 Oct 2026 (Travis: "add to the paywall a $10 a month
 * option ... that does not have a free trial"). Monthly was retired on 18 Sep
 * and is back on sale: $9.99 a month (MONTHLY_PRICE in lib/charter.ts, the
 * amount checkout charges), charged at purchase, no free trial, never the
 * charter price. The comparison figures ($119.88, "saves $59.89") did NOT
 * come back with it: the saving is $59.89 only while the charter price lasts,
 * and a figure that turns false at family fifty-one is not a term of sale.
 * "Under $5 a month" stays: it is $59.99 / 12 ($4.9991), never written as
 * "$4.99 a month", which would imply $59.88 a year, and it always sits beside
 * "per year" so it cannot be read as the monthly plan's price. Move a price
 * and it moves here, on /subscribe, on the landing page and on the static
 * purchase surfaces in the same commit.
 */
function PlanTerms() {
  return (
    <>
      {/* "There are two plans", not "is sold two ways": this block renders
          while Sona is free too, under a sentence that says nothing is being
          sold, and has to be true there for the people still holding a plan. */}
      There are two Sona Premium plans: one billed by the year, one billed by
      the month. Both open the same things.
      <br />
      <br />
      <strong>Sona Premium, yearly</strong> (called Sona Yearly before
      24 September 2026) is <strong>$99.99 per year</strong> and starts
      with <strong>3 free days</strong>. Nothing is charged during those days —
      the first charge lands on day 3, and only if you keep Premium.
      <br />
      <br />
      {/* THE CHARTER PARAGRAPH IS AN OFFER ONLY WHILE THE WEBSITE SELLS. With
          WEB_SALES false there is no checkout and nobody new can take a
          charter place, so "the price you see at checkout" and "new
          subscriptions are $99.99" would describe a sale that cannot happen,
          four paragraphs under a lead saying Apple sells new plans at Apple's
          price. The off twin keeps only what is still true: what a charter
          subscription costs, and that it keeps its price. The selling
          paragraph stays whole (chartertest reads it as text). */}
      {WEB_SALES ? (
        <>
          <strong>Charter price.</strong> The first 50 families to subscribe pay a
          charter price of <strong>$59.99 per year</strong> (under $5 a month)
          instead, and keep that price for as long as their subscription continues
          without a break. The price you see at checkout is the price you will be
          charged; once the 50 charter places are taken, new subscriptions are
          $99.99 per year (under $8.50 a month). The charter price is for the
          yearly plan only.
        </>
      ) : (
        <>
          <strong>Charter price.</strong> A yearly subscription bought on
          speaksona.com at the charter price is <strong>$59.99 per year</strong>{" "}
          (under $5 a month), and keeps that price for as long as it continues
          without a break. The charter price was for the yearly plan only.
        </>
      )}
      <br />
      <br />
      <strong>Sona Premium, monthly</strong> (called Sona Monthly before
      24 September 2026) is <strong>$9.99 per month</strong>. It has{" "}
      <strong>no free trial</strong>: the first month is charged when you buy
      it, and it is charged again at the start of each month until you cancel.
      Its price does not change with the charter places.
      <br />
      <br />
      Prices are in US dollars and exclude any applicable taxes. Premium
      includes every game and every book, for every sound, plus every new
      game, book and sound we ship while it is active. Daily speech practice is part of the free
      version and is never behind the paywall.
      <br />
      <br />
      Sona Premium renews automatically at the price you subscribed at — the
      yearly plan each year, the monthly plan each month — unless you cancel at
      least 24 hours before the current period ends. A monthly subscription
      bought before 1 October 2026 is unaffected: it renews at $9.99 each
      month under these same terms until you cancel it.{" "}
      {!FREE_MODE && WEB_SALES && (
        <>
          After checkout, your confirmation page shows what you were charged:
          for the yearly plan, the exact date and amount of your first charge;
          for the monthly plan, the amount charged that day.
        </>
      )}
      {/* That last sentence is backed by app/subscribe/success/page.tsx, which
          reads trial_end and the amount back off the real Stripe subscription.
          We deliberately do NOT promise a reminder email: nothing in this repo
          sends one, and a promise no code keeps is the kind that gets found.
          It is dropped while free because there is no checkout to land on, and
          while the website is not selling (WEB_SALES false) for the same
          reason: /api/checkout refuses, so nobody reaches that page anew. */}
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
      clinician&apos;s caseload is covered by the clinician&apos;s caseload plan (below) — whether or
      not the family chooses to share practice with the clinician. Families who
      joined through a clinician&apos;s link before Premium launched keep every
      game free, as they were promised. Founding Families places are free and
      unaffected by these prices.
    </>
  );
}

/**
 * THE CLINICIAN PLANS (Travis, 24 Sep 2026; re-priced 29 Sep 2026). What the
 * checkout in app/api/slp/plan does, and nothing it doesn't: two yearly
 * plans, no trial, the caseload sold only on top of the clinician's own,
 * cancel in the billing portal, a cancelled plan runs to the end of the paid
 * year (Stripe keeps it active until then, and so does coverage). The
 * promises kept are lib/caseload.ts's WHO IS COVERED: an account with no
 * `terms` stamp was told "free forever, unlimited families — for you and
 * every kid on your caseload"; a 24 to 29 Sep account was told its own
 * Premium was free with a work email; a caseload plan bought before 29 Sep
 * keeps the price it was bought at and keeps switching on the clinician's
 * own phone.
 */
function CaseloadTerms() {
  return (
    <>
      A speech-language pathologist or other clinician can buy two yearly
      plans on speaksona.com:
      <br />
      <br />
      <strong>{SELF_NAME}</strong> is{" "}
      <strong>{SELF_PRICE} per year</strong> ({SELF_PER_MONTH}): Premium on
      your own phone or tablet, every game, turned on with a link the
      dashboard emails to your account&apos;s address. Each link works once.
      {/* Never "one phone" (24 Sep 2026): each self link works once, but the
          server sends a few a day and retires none, so a one-device limit
          would be a term nobody keeps. The words are app/api/slp/self's. */}
      <br />
      <br />
      <strong>{CASELOAD_NAME}</strong> is{" "}
      <strong>{CASELOAD_PRICE} per year</strong> ({CASELOAD_PER_MONTH}) on top
      of {SELF_NAME}, for the families on your own caseload. It can be bought
      once your own Premium is on, and it is billed as its own subscription.
      <br />
      <br />
      There is <strong>no free trial</strong> for either: the first year is
      charged at checkout, and each plan renews automatically each year at the
      price you subscribed at until you cancel it.
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
      While it is active, the plan covers every family on your caseload: every family who joins Sona through your link has Premium,
      whether or not they choose to share practice with you. A single link
      allows up to {COVERED_REDEEM_CAP} sign-ups a year, counted across every
      code you have used, and we raise it on request. If you cancel it, your
      families keep Premium until the end of the year you paid for, and then
      move to the free version, which stays free. The price does not depend on
      how many families join, and you never earn anything from families on
      your own caseload.
      <br />
      <br />
      <strong>Clinicians who signed up before 24 September 2026</strong> were
      promised Sona free for themselves and every family on their caseload.
      That promise stands: they and their caseload have Premium at no cost,
      with nothing to buy and nothing to renew.
      <br />
      <br />
      <strong>Clinicians who signed up from 24 to 29 September 2026</strong>{" "}
      were told their own Premium was free with a work email (or if we approve
      their request for access). It still is. A caseload plan bought before 29
      September 2026 (then {LEGACY_CASELOAD_PRICE} a year) keeps renewing at that price and
      also includes the clinician&apos;s own Premium, for as long as it
      renews.
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

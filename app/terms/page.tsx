import type { Metadata } from "next";
import BackLink from "@/app/components/BackLink";
import { FREE_MODE } from "@/lib/pricing";
// On its own line: tests/freetest.mjs pins the FREE_MODE import word for word.
import { WEB_SALES } from "@/lib/pricing";
import {
  CASELOAD_NAME, CASELOAD_PRICE, SELF_NAME, SELF_PRICE, LEGACY_CASELOAD_PRICE,
  PRO_NAME, PRO_PRICE, PRO_TRIAL_DAYS,
  CLINIC_NAME, CLINIC_PRICE, CLINIC_SEATS, CLINIC_TRIAL_DAYS,
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
// November 2026: Sona Pro (12 Nov), then Sona Clinic and the end of the free
// dashboard signup for new accounts (17 Nov). It said "October 2026" (the
// monthly plan's return) through both, which a clinician could not square
// with terms that name November dates.
const EFFECTIVE = "November 2026";

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
                  app on iPhone and iPad, by Apple, at the price, and with any
                  free trial, shown in the App Store.
                </strong>{" "}
                We are not selling new family subscriptions on speaksona.com. A
                clinician&apos;s plan is still sold here: see Sona Pro and Sona
                Clinic for clinicians below.
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
            and iPad, a new family starts Sona Premium, at the price, and with
            any free days, shown in the App Store, to use daily practice, every
            game and every book. A free version — daily practice and free games, plus a
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
          charges and the dashboard prints. Two plans since 17 Nov 2026: Sona
          Pro for one clinician, Sona Clinic for a practice. */}
      <Section title="Sona Pro and Sona Clinic for clinicians">
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
        clinician dashboard: <strong>Your plan &rarr; Manage billing</strong>.
        Only the practice owner who bought {CLINIC_NAME} can cancel it.
        {/* That one IS self-serve: the dashboard's button opens Stripe's
            billing portal for the clinician's plans (app/api/slp/plan/portal).
            The page was renamed "Your plan" on 17 Nov 2026 (it was "Sona
            Pro"). A Clinic member has no subscription of their own, so the
            portal answers them "Your clinic's owner manages billing". */}
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
            at the start of each month after that. For a subscription bought in the app, any
            free trial is the one the App Store showed at the time of
            purchase.{" "}
          </>
        )}
        Canceling stops the next renewal and leaves your access — or, for a
        clinician&apos;s plan, your dashboard and your families&apos; Premium — in place until the period
        you have already paid for ends. Except where required by law, payments
        already made are non-refundable.
      </Section>

      <Section title="Acceptable use">
        {/* "for anyone other than your own family" used to stand alone, which
            made a clinician buying Premium for a caseload a breach of the very
            Terms that sell it. The family-plan rule stays; the clinician plan
            is named as what it is. 24 Sep 2026. Sona Clinic the same way (17
            Nov 2026): one owner paying for the clinicians at their practice
            is what the plan is, not a resale of it. */}
        Please don&apos;t misuse Sona — including attempting to disrupt or reverse
        engineer the service, using a family&apos;s plan for anyone other than your
        own family, reselling access, or uploading unlawful or harmful content.
        A clinician&apos;s plan covering the families on their own caseload is
        what that plan is for, and is not reselling; nor is a {CLINIC_NAME}{" "}
        plan covering the clinicians at one practice and the families on their
        caseloads. We may suspend accounts that violate these Terms.
      </Section>

      {/* The Trophy Road (11 Oct 2026). Trophies, coins and the things they
          open are a play economy, never money: nothing in it is sold, and
          Premium (which opens every game and every book) does not open the
          levels inside games. Promised here: an item a child has is never
          taken away. */}
      <Section title="Trophies, coins and game levels">
        Children earn trophies by saying their sounds and words out loud, up to
        the day&apos;s goal, and coins from the daily chest and the Trophy Road.
        Trophies, coins, and the buddies, hats, places, stickers and game levels
        they open have no money value: they can&apos;t be bought, sold, traded or
        cashed out, and they live on your device (a backup moves them). Some
        levels inside games open as your child earns trophies; buying Premium
        does not open them. We may add items or change prices, but we won&apos;t
        take away an item a child already has, on this device or one a backup
        moves it to.
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
          We deliberately do NOT promise a reminder email: the only one Sona
          sends (lib/revenuecat.ts, since 16 Oct 2026) follows an App Store
          trial for a parent who gave the app an email, never a web purchase,
          and a promise no code keeps is the kind that gets found.
          It is dropped while free because there is no checkout to land on, and
          while the website is not selling (WEB_SALES false) for the same
          reason: /api/checkout refuses, so nobody reaches that page anew. */}
      <br />
      <br />
      Subscriptions started inside the iOS app are sold and billed by Apple, at
      the price, and with any free trial, shown in the App Store at the time of
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
      clinician&apos;s caseload is covered by the clinician&apos;s plan (below) — whether or
      not the family chooses to share practice with the clinician. Families who
      joined through a clinician&apos;s link before Premium launched keep every
      game free, as they were promised. Founding Families places are free and
      unaffected by these prices.
    </>
  );
}

/**
 * SONA PRO (Travis, 12 Nov 2026) AND SONA CLINIC (17 Nov 2026). What the
 * checkout in app/api/slp/plan does, and nothing it doesn't: two monthly
 * plans; ONE 14-day free trial per clinician across both (any Pro or Clinic
 * subscription an address ever held spends it), card up front, charged when
 * it ends unless cancelled; renews monthly; cancelled in the billing portal,
 * it runs to the end of the period paid for (Stripe keeps it active until
 * then, and so does coverage); no cap on families while it is on. Clinic is
 * one price for the practice (never divided per clinician), up to
 * CLINIC_SEATS clinicians with the owner, each joined only from their own
 * inbox; the owner sees two counts per clinician and never a child
 * (lib/team.ts). The promises kept are lib/caseload.ts's WHO IS COVERED:
 * every account made before 12 Nov 2026 keeps the free dashboard it signed
 * up with (since SLPPRO1, 17 Nov 2026, the homepage's free-dashboard signups
 * of 13 to 17 Nov need a plan like everyone after them: Travis, "Move them
 * to the trial"); an account with no `terms` stamp was told "free forever,
 * unlimited families — for you and every kid on your caseload"; a 24 to 29
 * Sep account was told its own Premium was free with a work email; and the
 * two yearly plans sold until 12 Nov 2026 keep renewing at their price.
 * Every figure is a lib/caseload.ts constant.
 */
function CaseloadTerms() {
  return (
    <>
      A speech-language pathologist or other clinician can buy{" "}
      <strong>{PRO_NAME}</strong> on speaksona.com for{" "}
      <strong>{PRO_PRICE} per month</strong>. It includes the clinician
      dashboard (Session games, which picks Sona games to play in your
      sessions and opens them on your device, sharing Sona with families, and
      your families&apos; home practice), and Premium on your own phone or tablet, every game, turned on
      with a link the dashboard emails to your account&apos;s address (each
      link works once); and Premium for every family who joins Sona through
      your link, whether or not they choose to share practice with you.
      {/* Never "one phone" (24 Sep 2026): each self link works once, but the
          server sends a few a day and retires none, so a one-device limit
          would be a term nobody keeps. The words are app/api/slp/self's. */}
      {/* UNLIMITED, AND TRUE (Travis, 12 Nov 2026: "Remove the limit"). A
          covered code has no redeem cap at all (app/api/slp/redeem), so
          "no limit" is what the server does, not a fair-use figure of speech.
          Until 12 Nov this said "up to 300 sign-ups a year". */}
      {" "}There is no limit on how many families join through your link while
      it is active.
      <br />
      <br />
      {/* SONA CLINIC (Travis, 17 Nov 2026). Its figures are lib/caseload's
          (CLINIC_PRICE, CLINIC_SEATS, CLINIC_TRIAL_DAYS). A seat is held by
          an invited address too, until it joins or is removed (lib/team.ts
          seatsUsed). Never a per-clinician price: the seat count is a
          ceiling, not a unit. */}
      <strong>{CLINIC_NAME}</strong> is for a practice. The clinician who buys
      it on speaksona.com (the owner) pays{" "}
      <strong>{CLINIC_PRICE} per month</strong>, and it covers up to{" "}
      {CLINIC_SEATS} clinicians at the practice, the owner included. Every
      clinician the owner adds, once they accept the invitation emailed to
      them, gets everything {PRO_NAME} includes: their own dashboard, Premium
      on their own phone or tablet, and Premium for every family who joins
      through their link, with no limit on families. An invited clinician holds
      a place until they join or the owner removes them. The price is the same
      however many clinicians or families are on it.
      <br />
      <br />
      {/* THE OWNER VIEW (lib/team.ts ownerView): two counts per clinician,
          rows by name, never a child. The words match the invite email and
          the plan page, so what a clinician is told before joining is what
          the Terms say. */}
      <strong>What the owner sees.</strong> For each clinician on the plan, the
      owner sees two numbers: how many children that clinician has on Sona,
      and how many of them practiced in the last 7 days. The owner never sees
      a child&apos;s name, initials, age, sounds, pass rate or homework. Each
      clinician&apos;s account, caseload and families stay their own: the owner
      cannot open, move or delete them.
      <br />
      <br />
      <strong>Joining, leaving and removal.</strong> A clinician joins a{" "}
      {CLINIC_NAME} plan only from the invitation in their own email, is on
      one practice&apos;s plan at a time, and can leave from their own
      dashboard at any time. {CLINIC_NAME} stops covering a clinician, and the
      families on their link, when they leave, when the owner removes them, or
      when the plan ends. After that, a clinician keeps only what their own
      account gives them without it, such as a plan of their own or a
      dashboard promised free in this section. Only the owner manages billing
      for {CLINIC_NAME} and can cancel it.
      <br />
      <br />
      <strong>Free trial.</strong> The first time you start {PRO_NAME}, the
      first {PRO_TRIAL_DAYS} days are free. You enter a card at checkout and
      are not charged that day. Unless you cancel before the trial ends, your
      card is charged {PRO_PRICE} when it ends and then each month until you
      cancel. If you cancel during the trial, you are never charged. One free
      trial per clinician.{" "}
      {/* One trial ACROSS both plans (lib/caseload proStatus, 17 Nov 2026):
          two plans with a trial each would be twenty-eight free days. */}
      {CLINIC_NAME} starts the same way: the first {CLINIC_TRIAL_DAYS} days
      are free, a card is entered at checkout and not charged that day, and
      unless the owner cancels before the trial ends the card is charged{" "}
      {CLINIC_PRICE} when it ends and then each month until it is canceled.
      The one free trial covers both plans: if you have had a {PRO_NAME} or{" "}
      {CLINIC_NAME} subscription before, either plan you start is charged at
      checkout, with no free days.
      <br />
      <br />
      <strong>Renewal and canceling.</strong> {PRO_NAME} renews automatically
      each month until you cancel it, from the clinician dashboard:{" "}
      <strong>Your plan &rarr; Manage billing</strong>. If you cancel, your
      dashboard and your families&apos; Premium stay on until the end of the
      month you paid for (or of the free trial); then your families move to
      the free version. {CLINIC_NAME} renews automatically each month in the
      same way until the owner cancels it there, and every clinician on it
      keeps what it gives them, and their families keep Premium, until the end
      of the month paid for (or of the free trial), unless the owner deletes
      their Sona account first: that ends it that day for every clinician on
      it and their families.{" "}
      {/* 18 Nov 2026 (review): lib/slpDelete takes the team with the
          owner's account, and allows it once the plan is cancelled; the
          dashboard's delete card says so too. */}
      Removing a child from your dashboard, and deleting your account, keep
      working. The price does not depend on how many families join, and you
      never earn anything from families on your own caseload; a{" "}
      {CLINIC_NAME} owner earns nothing from the families of the clinicians on
      it either.
      <br />
      <br />
      <strong>Clinicians who signed up before 12 November 2026</strong> were
      told the dashboard was free. It still is, with nothing to buy;{" "}
      {PRO_NAME} or {CLINIC_NAME} adds every game for them and their caseload.
      <br />
      <br />
      <strong>Clinicians who signed up before 24 September 2026</strong> were
      promised Sona free for themselves and every family on their caseload.
      That promise stands: they and their caseload have Premium at no cost,
      with no limit on families, nothing to buy and nothing to renew.
      <br />
      <br />
      <strong>Clinicians who signed up from 24 to 29 September 2026</strong>{" "}
      were told their own Premium was free with a work email (or if we approve
      their request for access). It still is.
      <br />
      <br />
      {/* Retired from sale, not cancelled: the people holding them keep them,
          as the family plan's retired monthly price is kept for its holders. */}
      <strong>Yearly plans sold until 12 November 2026.</strong> {SELF_NAME}{" "}
      ({SELF_PRICE} a year) and {CASELOAD_NAME} ({CASELOAD_PRICE} a year on top
      of it; {LEGACY_CASELOAD_PRICE} a year, including the clinician&apos;s own
      Premium, before 29 September 2026) were replaced by {PRO_NAME} and
      can&apos;t be bought now. If you hold one, it keeps renewing at the price
      you subscribed at, and keeps covering what it covered, until you cancel
      it; while your caseload is covered by one, there is no limit on families
      either.
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

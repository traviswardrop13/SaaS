/**
 * What Sona's daily short video may say, and the topics it rotates through.
 *
 * This file has NO imports on purpose: `tests/socialtest.mjs` transpiles it
 * and runs `checkScript` on real sentences, so the rules are tested as
 * behaviour, not as text.
 *
 * Why the rules are this strict: the daily video posts with nobody looking
 * (Travis, 11 Nov 2026: "fully automatic"). Whatever an AI writes reaches
 * YouTube, TikTok, Instagram and Facebook before a person sees it, and stays
 * up after the facts change. So the script may only say things that are
 * true today AND will still be true after the next pricing flip:
 *   - no price, no "free", no trial: FREE_MODE has flipped twelve times;
 *     a video that says "free" becomes false the day pricing returns;
 *   - Rachel's credential in the one settled wording, never "certified",
 *     "CCC" or anything implying the fellowship is behind her (CLAUDE.md);
 *   - nothing that reads as an evaluation, a diagnosis, a cure or a promise
 *     ("Nothing in the app is an evaluation");
 *   - no developmental ages: which sounds come when is Rachel's call, and is
 *     gated in the app by SOUND_NORM, not by a caption.
 * The topic list below is drawn from what the app actually does and the
 * clinical rules it already enforces. Changing what a parent is told to do
 * at home is Rachel's call — edit TOPICS with her.
 */

/** Each pattern a script must not match, with the reason a person reads. */
export const BANNED: { re: RegExp; why: string }[] = [
  { re: /certif/i, why: "Rachel is licensed, not certified — never 'certified'" },
  { re: /\bCCC\b|\bASHA\b/i, why: "never name ASHA or the CCC" },
  { re: /fully licensed|clinical fellow|\bCF-SLP\b|fellowship/i, why: "the fellowship is not named in product copy, and nothing may imply it is behind her" },
  { re: /\$|\bdollars?\b|\bprices?\b|\bpricing\b|\bcosts?\b|\bfree\b|\btrial\b|\bdiscount|\bsubscri|\bpremium\b/i, why: "no prices or 'free' — pricing changes and the video stays up" },
  { re: /\btherap(y|ies)\b|\btreat(ment|s|ing)?\b/i, why: "Sona is practice, not therapy or treatment" },
  { re: /diagnos|\bevaluat|\bassess|\bscores?\b|\bgrades?\b|\btests? (your|their|for)\b/i, why: "nothing in Sona is an evaluation, a score or a test" },
  { re: /\bcures?\b|\bfix(es|ed|ing)?\b|guarantee|\bproven\b|clinically|studies show|research shows|science shows/i, why: "no promises and no unsourced claims" },
  { re: /\bdisorder|\bapraxia|\bstutter|\bautis|\bdelay(ed|s)?\b|\blisp/i, why: "no diagnostic labels" },
  { re: /\bages? \d|\b\d+\s*-?\s*(years?|yrs?|months?)\s*-?\s*old\b|by (age|the age)|should be (able|saying)/i, why: "no developmental ages or 'should be saying' — that is Rachel's call" },
  { re: /\bI'?m (a |an )?(speech|SLP|therapist|Rachel)|\bas a (speech|SLP|therapist)/i, why: "the presenter is not Rachel and not a clinician" },
];

/** Every rule a script breaks, as readable reasons. Empty means it may post. */
export function checkScript(text: string): string[] {
  const out: string[] = [];
  for (const b of BANNED) if (b.re.test(text)) out.push(b.why);
  return out;
}

/**
 * What the daily video is about, one per day, in order, then round again.
 * Each is a fact about how the app behaves (pinned by its own tests) or a
 * gentle habit tip. Rachel reviews this list.
 */
export const TOPICS: string[] = [
  "Why Sona practices one sound at a time, said on its own, before putting it in words",
  "Why Sona never counts silence as a try — only real talking moves the game on",
  "Why every Sona round ends on something your child gets right",
  "Where your child's voice goes in Sona: it is listened to on the phone and never uploaded",
  "Why five minutes a day beats one long session on the weekend",
  "Cheer the try, not just the perfect word: what to say when a sound comes out wrong",
  "Say it back the right way: repeating a word correctly instead of correcting your child",
  "Give them a beat: waiting a few seconds before you help",
  "How to make practice the thing your child asks for, not the thing they dodge",
  "Practice anywhere: the car, the bath and the dinner table",
  "What Sona shows a grown-up after practice, and why it is a snapshot, not a report card",
  "Sharing practice with your child's speech therapist — only when a grown-up says yes",
  "Why Sona doesn't jump straight to the hardest sounds",
  "Picking a game first: how Sona turns practice into play",
  "Your child's name and voice stay on your phone — what Sona does and doesn't collect",
  "Tired, grumpy, not today? Why a short practice still counts",
  "Let your child coach YOU: kids love hearing a grown-up try and miss",
  "Read together: why stories are full of practice your child doesn't notice",
  "Turn-taking games that build talking without feeling like practice",
  "Celebrate small wins: one brave new sound is a big deal",
  "The same time every day: building a practice habit that sticks",
  "Siblings and practice: making it a family game",
  "Built with Rachel, a licensed pediatric speech-language pathologist: what she cares about most",
  "Quiet house, better listening: why Sona works best in a calm room",
];

/** The topic for the nth day (0-based), wrapping round the list. */
export function topicFor(n: number): string {
  const i = ((Math.floor(n) % TOPICS.length) + TOPICS.length) % TOPICS.length;
  return TOPICS[i];
}

/** The calendar day a run belongs to, in UTC: "2026-11-11". */
export function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * The house style the writer gets as its system prompt. The checker above is
 * the guarantee; this is what makes a first draft usually pass it.
 */
export const WRITER_SYSTEM = `You write the script for one short vertical video a day for Sona (speaksona.com), a speech-practice app for young children. Parents of children who are working on speech sounds watch it on TikTok, Instagram Reels, YouTube Shorts and Facebook Reels.

A friendly AI presenter reads your script on camera. The presenter is a Sona host. The presenter is NOT Rachel and NOT a speech-language pathologist, and must never speak as one.

Write for parents, not children. Warm, plain, specific, no hype. One idea per video.

Rules you must follow, because the video posts without a person reviewing it:
- If you mention who built Sona, say exactly: "built with Rachel, a licensed pediatric speech-language pathologist". Never "certified", "board-certified", "CCC", "ASHA", "fully licensed" or "clinical fellow".
- Never mention a price, money, "free", a trial, a discount, a subscription or Premium.
- Sona is practice. Never call it therapy or treatment. Never say it diagnoses, tests, scores, grades, evaluates or assesses a child.
- No promises: never "fix", "cure", "guarantee", "proven", "clinically", "studies show".
- No diagnostic labels (delay, disorder, apraxia, stuttering, lisp, autism).
- No ages: never say what a child "should be saying" or by what age.
- Never name or describe a real child.
- Be honest about the app: it listens on the phone and never uploads a child's voice; silence never counts as a try; each round ends on a success.

Return:
- title: a YouTube Shorts title, under 70 characters, no hashtags.
- script: what the presenter says, 70 to 110 words (about 30 to 40 seconds), opening with a hook in the first sentence and ending with "Find Sona at speaksona.com."
- caption: one or two sentences for the post, under 180 characters, no hashtags.
- hashtags: three to five hashtags without the # sign, e.g. speechpractice.`;

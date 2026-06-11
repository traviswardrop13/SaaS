"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DIAGNOSTIC_CHALLENGES,
  diagnosticToFocus,
  findSkill,
  GOAL_TILES,
  tilesToFocus,
} from "@/lib/lessons";
import {
  loadState,
  newChild,
  update,
  type Child,
} from "@/lib/storage";
import Mascot from "@/components/Mascot";
import OnboardingShell, {
  ChoiceCard,
  SquareTile,
} from "@/components/OnboardingShell";

const AVATARS = ["🦁", "🐸", "🐼", "🦊", "🐨", "🐵", "🦄", "🐙", "🐧", "🦉"];
const DAILY_GOALS = [
  { minutes: 5, label: "5 min / day", subtitle: "Casual" },
  { minutes: 10, label: "10 min / day", subtitle: "Regular" },
  { minutes: 15, label: "15 min / day", subtitle: "Serious" },
  { minutes: 20, label: "20 min / day", subtitle: "Intense" },
];

type Step =
  | "welcome"
  | "parent"
  | "childName"
  | "childAvatar"
  | "goalTiles"
  | "diagnostic"
  | "focusReview"
  | "routineIntro"
  | "dailyGoal"
  | "motivation"
  | "reminders"
  | "done";

export default function WelcomePage() {
  const router = useRouter();

  // Lock in starting conditions on mount so step order is stable across renders.
  const [hasExistingParent, setHasExistingParent] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [childName, setChildName] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [path, setPath] = useState<"diagnostic" | "manual" | null>(null);
  const [selectedTiles, setSelectedTiles] = useState<Set<string>>(new Set());
  const [challenges, setChallenges] = useState<Set<string>>(new Set());
  const [focus, setFocus] = useState<Set<string>>(new Set());
  const [dailyGoal, setDailyGoal] = useState<number>(10);
  const [remindersEnabled, setRemindersEnabled] = useState<boolean | null>(
    null,
  );

  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    const s = loadState();
    if (s.parent) {
      setHasExistingParent(true);
      setParentName(s.parent.name);
      setParentEmail(s.parent.email);
    }
    setMounted(true);
  }, []);

  // Build the step list — if a parent already exists we skip the parent
  // steps so this same flow works for "add another child" too.
  const steps = useMemo<Step[]>(() => {
    const base: Step[] = ["welcome"];
    if (!hasExistingParent) base.push("parent");
    base.push("childName", "childAvatar", "goalTiles");
    if (path === "diagnostic") base.push("diagnostic");
    base.push(
      "focusReview",
      "routineIntro",
      "dailyGoal",
      "motivation",
      "reminders",
      "done",
    );
    return base;
  }, [hasExistingParent, path]);

  // Auto-derive focus areas from whichever picker the parent used so the
  // review step always reflects the latest choice. Diagnostic wins if the
  // parent took that branch; otherwise tile selections drive focus.
  // IMPORTANT: this hook must stay above the `!mounted` early return below,
  // otherwise we'd skip it on first render and violate the rules of hooks
  // (silent in dev, hard crash in production).
  useEffect(() => {
    if (path === "diagnostic") {
      setFocus(new Set(diagnosticToFocus(Array.from(challenges))));
    } else {
      setFocus(new Set(tilesToFocus(Array.from(selectedTiles))));
    }
  }, [challenges, selectedTiles, path]);

  if (!mounted) return null;

  const step = steps[stepIdx] ?? "done";

  function go(delta: number) {
    setStepIdx((i) => Math.min(steps.length - 1, Math.max(0, i + delta)));
  }
  const back = stepIdx > 0 ? () => go(-1) : undefined;

  function toggleSet(s: Set<string>, id: string): Set<string> {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  }

  function commitAndFinish() {
    const child: Child = {
      ...newChild(childName.trim(), avatar),
      focusAreas: Array.from(focus),
      dailyGoalMinutes: dailyGoal,
      remindersEnabled: remindersEnabled ?? false,
    };
    update((s) => {
      if (!s.parent) {
        s.parent = {
          name: parentName.trim() || "Parent",
          email: parentEmail.trim(),
        };
      }
      s.children.push(child);
      s.activeChildId = child.id;
    });
    router.push(`/kid/${child.id}`);
  }

  // ───── per-step rendering ─────

  if (step === "welcome") {
    return (
      <OnboardingShell
        step={stepIdx}
        totalSteps={steps.length}
        onBack={back}
        stepKey={step}
        ctaLabel="Get started"
        onContinue={() => go(1)}
      >
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="text-7xl">🦁</div>
          <h1 className="mt-4 font-display text-4xl font-extrabold text-brand-600 sm:text-5xl">
            SpeakUp Kids
          </h1>
          <p className="mt-3 max-w-sm text-gray-600">
            A friendly, game-style way for kids to practice tricky speech
            sounds. Let&apos;s set things up — it only takes a minute.
          </p>
        </div>
      </OnboardingShell>
    );
  }

  if (step === "parent") {
    return (
      <OnboardingShell
        step={stepIdx}
        totalSteps={steps.length}
        onBack={back}
        stepKey={step}
        ctaLabel="Continue"
        ctaDisabled={!parentName.trim()}
        onContinue={() => go(1)}
      >
        <Mascot message="Hi grown-up! What should I call you?" />
        <div className="mt-8 space-y-4">
          <Field label="Your name">
            <input
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              placeholder="e.g. Sam"
              className="onboarding-input"
              autoFocus
            />
          </Field>
          <Field label="Email (optional)">
            <input
              type="email"
              value={parentEmail}
              onChange={(e) => setParentEmail(e.target.value)}
              placeholder="you@example.com"
              className="onboarding-input"
            />
          </Field>
        </div>
        <InlineStyles />
      </OnboardingShell>
    );
  }

  if (step === "childName") {
    return (
      <OnboardingShell
        step={stepIdx}
        totalSteps={steps.length}
        onBack={back}
        stepKey={step}
        ctaLabel="Continue"
        ctaDisabled={!childName.trim()}
        onContinue={() => go(1)}
      >
        <Mascot message="Who are we practicing with?" />
        <div className="mt-8">
          <Field label="Child's first name">
            <input
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              placeholder="e.g. Mia"
              className="onboarding-input"
              autoFocus
            />
          </Field>
        </div>
        <InlineStyles />
      </OnboardingShell>
    );
  }

  if (step === "childAvatar") {
    return (
      <OnboardingShell
        step={stepIdx}
        totalSteps={steps.length}
        onBack={back}
        stepKey={step}
        ctaLabel="Continue"
        onContinue={() => go(1)}
      >
        <Mascot message={`Pick a buddy for ${childName || "your child"}!`} />
        <div className="mt-8 grid grid-cols-5 gap-3">
          {AVATARS.map((a) => (
            <button
              type="button"
              key={a}
              onClick={() => setAvatar(a)}
              className={`flex aspect-square items-center justify-center rounded-2xl text-4xl shadow-chunky-sm transition ${
                avatar === a
                  ? "scale-110 bg-brand-100 ring-4 ring-brand-500"
                  : "bg-white hover:bg-gray-50"
              }`}
              aria-label={`Avatar ${a}`}
              aria-pressed={avatar === a}
            >
              {a}
            </button>
          ))}
        </div>
      </OnboardingShell>
    );
  }

  if (step === "goalTiles") {
    return (
      <OnboardingShell
        step={stepIdx}
        totalSteps={steps.length}
        onBack={back}
        stepKey={step}
        ctaLabel={
          selectedTiles.size === 0 ? "Pick at least one" : "Continue"
        }
        ctaDisabled={selectedTiles.size === 0}
        onContinue={() => {
          setPath("manual");
          go(1);
        }}
        secondaryAction={{
          label: "Not sure? Help me figure it out",
          onClick: () => {
            setSelectedTiles(new Set());
            setPath("diagnostic");
            // After re-render, "diagnostic" will be at idx+1.
            go(1);
          },
        }}
      >
        <Mascot
          message={`What does ${childName || "your child"} want to work on?`}
          align="center"
        />
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {GOAL_TILES.map((tile) => (
            <SquareTile
              key={tile.id}
              selected={selectedTiles.has(tile.id)}
              onClick={() =>
                setSelectedTiles((prev) => toggleSet(prev, tile.id))
              }
              emoji={tile.emoji}
              title={tile.title}
              subtitle={tile.subtitle}
            />
          ))}
        </div>
      </OnboardingShell>
    );
  }

  if (step === "diagnostic") {
    return (
      <OnboardingShell
        step={stepIdx}
        totalSteps={steps.length}
        onBack={back}
        stepKey={step}
        ctaLabel={challenges.size === 0 ? "Pick at least one" : "Continue"}
        ctaDisabled={challenges.size === 0}
        onContinue={() => go(1)}
        secondaryAction={{
          label: "I'm not sure — show me everything",
          onClick: () => {
            setFocus(new Set());
            go(2); // skip review, go straight to dailyGoal
          },
        }}
      >
        <Mascot
          message={`Which of these sounds like ${childName || "your child"}?`}
        />
        <p className="mt-4 text-sm text-gray-500">
          Pick all that apply. We&apos;ll build a custom plan from these.
        </p>
        <div className="mt-4 space-y-2.5">
          {DIAGNOSTIC_CHALLENGES.map((c) => (
            <ChoiceCard
              key={c.id}
              selected={challenges.has(c.id)}
              onClick={() =>
                setChallenges((prev) => toggleSet(prev, c.id))
              }
              emoji={c.emoji}
              title={c.label}
              description={c.example}
            />
          ))}
        </div>
      </OnboardingShell>
    );
  }

  if (step === "focusReview") {
    // If diagnostic produced nothing usable (e.g. parent went manual with no
    // picks yet), let them pick everything from the catalog later — push
    // them to the dedicated focus picker after onboarding finishes.
    const focusList = Array.from(focus)
      .map((id) => findSkill(id))
      .filter(Boolean) as ReturnType<typeof findSkill>[];

    return (
      <OnboardingShell
        step={stepIdx}
        totalSteps={steps.length}
        onBack={back}
        stepKey={step}
        ctaLabel={
          focus.size > 0 ? "Looks good!" : "I'll pick goals after"
        }
        onContinue={() => go(1)}
        secondaryAction={{
          label: "Edit goals in detail",
          onClick: () => {
            // Defer to the dedicated focus picker AFTER the child profile
            // exists. We'll first finish the rest of onboarding so we have
            // a child to attach to.
            go(1);
          },
        }}
      >
        <Mascot
          message={
            focus.size > 0
              ? `Here's ${childName || "their"} starter plan!`
              : "We'll show everything for now."
          }
        />
        {focus.size > 0 ? (
          <div className="mt-8 space-y-2">
            {focusList.map((s) =>
              s ? (
                <div
                  key={s.id}
                  className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-chunky-sm"
                >
                  <span className="text-3xl" aria-hidden>
                    {s.emoji}
                  </span>
                  <div className="flex-1">
                    <div className="font-display text-lg font-bold">
                      {s.title}
                    </div>
                    <div className="text-sm text-gray-500">{s.subtitle}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setFocus((prev) => {
                        const n = new Set(prev);
                        n.delete(s.id);
                        return n;
                      })
                    }
                    className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-500 hover:bg-gray-200"
                  >
                    Remove
                  </button>
                </div>
              ) : null,
            )}
          </div>
        ) : (
          <p className="mt-8 text-center text-gray-500">
            No worries — you can pick goals later from the parent dashboard.
          </p>
        )}
      </OnboardingShell>
    );
  }

  if (step === "routineIntro") {
    return (
      <OnboardingShell
        step={stepIdx}
        totalSteps={steps.length}
        onBack={back}
        stepKey={step}
        ctaLabel="Continue"
        onContinue={() => go(1)}
      >
        <Mascot
          message={`Let's set up ${childName || "their"} learning routine!`}
        />
      </OnboardingShell>
    );
  }

  if (step === "dailyGoal") {
    return (
      <OnboardingShell
        step={stepIdx}
        totalSteps={steps.length}
        onBack={back}
        stepKey={step}
        ctaLabel="I'm committed"
        onContinue={() => go(1)}
      >
        <Mascot message="What's your daily learning goal?" />
        <div className="mt-8 space-y-3">
          {DAILY_GOALS.map((g) => (
            <ChoiceCard
              key={g.minutes}
              selected={dailyGoal === g.minutes}
              onClick={() => setDailyGoal(g.minutes)}
              title={g.label}
              description={g.subtitle}
              recommended={g.minutes === 10}
            />
          ))}
        </div>
      </OnboardingShell>
    );
  }

  if (step === "motivation") {
    return (
      <OnboardingShell
        step={stepIdx}
        totalSteps={steps.length}
        onBack={back}
        stepKey={step}
        ctaLabel="Continue"
        onContinue={() => go(1)}
      >
        <Mascot
          message={`Here's what ${childName || "your child"} can build!`}
        />
        <ul className="mt-8 space-y-4">
          <Outcome
            emoji="🗣️"
            title="Clearer everyday speech"
            body="Targeted practice on the exact sounds that need work."
          />
          <Outcome
            emoji="💪"
            title="Confidence to speak up"
            body="Short, fun wins so practice never feels like a chore."
          />
          <Outcome
            emoji="📅"
            title="A daily speech habit"
            body={`Just ${dailyGoal} minutes a day keeps the streak alive.`}
          />
        </ul>
      </OnboardingShell>
    );
  }

  if (step === "reminders") {
    return (
      <OnboardingShell
        step={stepIdx}
        totalSteps={steps.length}
        onBack={back}
        stepKey={step}
        ctaLabel={
          remindersEnabled
            ? "Remind me to practice"
            : remindersEnabled === false
              ? "Continue"
              : "Yes, remind me"
        }
        onContinue={async () => {
          if (
            remindersEnabled !== false &&
            typeof window !== "undefined" &&
            "Notification" in window
          ) {
            try {
              const perm = await Notification.requestPermission();
              setRemindersEnabled(perm === "granted");
            } catch {
              setRemindersEnabled(false);
            }
          }
          go(1);
        }}
        secondaryAction={{
          label: "Not now",
          onClick: () => {
            setRemindersEnabled(false);
            go(1);
          },
        }}
      >
        <Mascot
          message={`I'll remind ${childName || "you"} to practice — so it becomes a habit!`}
        />
        <div className="mt-8 rounded-3xl bg-white p-6 text-center shadow-chunky-sm">
          <div className="text-6xl">🔔</div>
          <h2 className="mt-3 font-display text-2xl font-extrabold">
            Daily reminder
          </h2>
          <p className="mt-2 text-gray-500">
            One gentle nudge a day. You can turn it off anytime.
          </p>
        </div>
      </OnboardingShell>
    );
  }

  // "done" — recap + commit
  return (
    <OnboardingShell
      step={stepIdx}
      totalSteps={steps.length}
      onBack={back}
      stepKey={step}
      ctaLabel={`Let's start ${childName || "practicing"}!`}
      onContinue={commitAndFinish}
    >
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="text-7xl">🎉</div>
        <h1 className="mt-4 font-display text-4xl font-extrabold text-brand-600">
          All set!
        </h1>
        <p className="mt-3 max-w-sm text-gray-600">
          {childName || "Your child"} is ready to roar. Tap below to open
          their map and start the first lesson.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm text-gray-500">
          <Pill>{dailyGoal} min/day</Pill>
          {focus.size > 0 ? (
            <Pill>
              {focus.size} goal{focus.size === 1 ? "" : "s"} picked
            </Pill>
          ) : (
            <Pill>All goals available</Pill>
          )}
          {remindersEnabled ? <Pill>🔔 Reminders on</Pill> : null}
        </div>
      </div>
    </OnboardingShell>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-display font-bold text-gray-700">
        {label}
      </span>
      {children}
    </label>
  );
}

function Outcome({
  emoji,
  title,
  body,
}: {
  emoji: string;
  title: string;
  body: string;
}) {
  return (
    <li className="flex items-start gap-4 rounded-2xl bg-white p-4 shadow-chunky-sm">
      <span className="text-3xl" aria-hidden>
        {emoji}
      </span>
      <div>
        <div className="font-display text-lg font-extrabold">{title}</div>
        <p className="text-sm text-gray-600">{body}</p>
      </div>
    </li>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-white px-3 py-1 font-bold shadow-chunky-sm">
      {children}
    </span>
  );
}

function InlineStyles() {
  return (
    <style jsx>{`
      :global(.onboarding-input) {
        width: 100%;
        border-radius: 16px;
        border: 2px solid #e5e7eb;
        padding: 14px 16px;
        font-size: 18px;
        background: #fff;
      }
      :global(.onboarding-input:focus) {
        outline: none;
        border-color: #fb923c;
        box-shadow: 0 0 0 4px rgba(251, 146, 60, 0.2);
      }
    `}</style>
  );
}

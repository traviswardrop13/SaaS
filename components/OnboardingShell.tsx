"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ReactNode } from "react";

/**
 * Shared chrome around every onboarding step — Duolingo-style: progress
 * bar + back arrow at top, scrolling content in the middle, sticky CTA
 * footer at the bottom. Each step renders into `children`; the parent
 * controls progress + CTA wiring.
 */
export default function OnboardingShell({
  step,
  totalSteps,
  onBack,
  ctaLabel,
  ctaDisabled,
  onContinue,
  secondaryAction,
  stepKey,
  children,
}: {
  step: number;
  totalSteps: number;
  onBack?: () => void;
  ctaLabel: string;
  ctaDisabled?: boolean;
  onContinue: () => void;
  secondaryAction?: { label: string; onClick: () => void };
  /** Unique key so AnimatePresence transitions between steps */
  stepKey: string;
  children: ReactNode;
}) {
  const pct = Math.max(
    5,
    Math.round(((step + 1) / Math.max(1, totalSteps)) * 100),
  );
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 py-4 sm:py-8">
      <header className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={!onBack}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-500 shadow-chunky-sm transition hover:text-gray-700 disabled:cursor-default disabled:opacity-30"
        >
          ←
        </button>
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-white shadow-inner">
          <div
            className="h-full rounded-full bg-grass-500 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </header>

      <div className="flex flex-1 flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={stepKey}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2 }}
            className="flex flex-1 flex-col"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="sticky bottom-2 mt-6 space-y-2 sm:bottom-4">
        <button
          type="button"
          disabled={ctaDisabled}
          onClick={onContinue}
          className="btn-primary w-full text-lg disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none"
        >
          {ctaLabel}
        </button>
        {secondaryAction && (
          <button
            type="button"
            onClick={secondaryAction.onClick}
            className="block w-full rounded-2xl px-6 py-2 text-center font-display font-bold text-gray-500 hover:text-gray-700"
          >
            {secondaryAction.label}
          </button>
        )}
      </div>
    </main>
  );
}

/**
 * Big square tile — Duolingo's "I want to learn…" grid pattern. Used for
 * top-level multi-select choices where a row of long cards would feel less
 * inviting than chunky tappable squares.
 */
export function SquareTile({
  selected,
  onClick,
  emoji,
  title,
  subtitle,
}: {
  selected: boolean;
  onClick: () => void;
  emoji: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`relative flex aspect-square flex-col items-center justify-center gap-1 rounded-3xl border-4 p-3 text-center transition ${
        selected
          ? "border-grass-500 bg-grass-500/10"
          : "border-gray-100 bg-white hover:border-gray-200"
      }`}
    >
      <span className="text-5xl" aria-hidden>
        {emoji}
      </span>
      <span className="mt-1 font-display text-sm font-extrabold text-gray-800 sm:text-base">
        {title}
      </span>
      {subtitle && (
        <span className="text-[11px] text-gray-500 sm:text-xs">{subtitle}</span>
      )}
      {selected && (
        <span
          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-grass-500 text-xs font-bold text-white"
          aria-hidden
        >
          ✓
        </span>
      )}
    </button>
  );
}

export function ChoiceCard({
  selected,
  onClick,
  emoji,
  title,
  description,
  recommended,
}: {
  selected: boolean;
  onClick: () => void;
  emoji?: string;
  title: string;
  description?: string;
  recommended?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`relative flex w-full items-center gap-4 rounded-3xl border-4 p-4 text-left transition ${
        selected
          ? "border-grass-500 bg-grass-500/10"
          : "border-gray-100 bg-white hover:border-gray-200"
      }`}
    >
      {recommended && (
        <span className="absolute -top-3 right-4 rounded-full bg-sky-500 px-3 py-0.5 text-xs font-extrabold uppercase tracking-wide text-white shadow-chunky-sm">
          Recommended
        </span>
      )}
      {emoji && (
        <span className="text-4xl" aria-hidden>
          {emoji}
        </span>
      )}
      <span className="flex-1">
        <span className="block font-display text-lg font-extrabold text-gray-800">
          {title}
        </span>
        {description && (
          <span className="block text-sm text-gray-500">{description}</span>
        )}
      </span>
      {selected && (
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-grass-500 font-bold text-white"
          aria-hidden
        >
          ✓
        </span>
      )}
    </button>
  );
}

import { NextRequest, NextResponse } from "next/server";
import { getSession, mutateSession } from "@/lib/store";
import { toPublic } from "@/lib/publicView";
import { buildStudy } from "@/lib/study";
import type { Phase } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // building study may call the AI

const PHASES: Phase[] = ["ask", "vote", "study"];

/**
 * Host-only: change the class phase. Moving to "study" with a selectedQuestionId
 * builds the scripture/quote study for that question and caches it on the
 * session so every device shows the same result.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { code: string } },
) {
  const code = params.code.toUpperCase();

  let body: { phase?: Phase; selectedQuestionId?: string; hostToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const phase = body.phase;
  if (!phase || !PHASES.includes(phase)) {
    return NextResponse.json({ error: "Invalid phase." }, { status: 400 });
  }

  const existing = await getSession(code);
  if (!existing) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }
  if (existing.hostToken && existing.hostToken !== body.hostToken) {
    return NextResponse.json(
      { error: "Only the teacher's device can control the class." },
      { status: 403 },
    );
  }

  if (phase === "study") {
    const selectedQuestionId = (body.selectedQuestionId || "").trim();
    const q = existing.questions.find((x) => x.id === selectedQuestionId);
    if (!q) {
      return NextResponse.json({ error: "Pick a question to study." }, { status: 400 });
    }
    // Build study material outside the lock (it may call the AI + read data).
    const study = await buildStudy(q.text);
    const updated = await mutateSession(code, (s) => {
      s.phase = "study";
      s.selectedQuestionId = selectedQuestionId;
      s.study = study;
    });
    return NextResponse.json(toPublic(updated!, undefined));
  }

  // ask / vote: clear any previous selection + study so a re-pick rebuilds.
  const updated = await mutateSession(code, (s) => {
    s.phase = phase;
    s.selectedQuestionId = undefined;
    s.study = undefined;
  });
  return NextResponse.json(toPublic(updated!, undefined));
}

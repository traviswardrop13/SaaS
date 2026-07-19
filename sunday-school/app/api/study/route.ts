import { NextRequest, NextResponse } from "next/server";
import { buildStudy } from "@/lib/study";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Standalone study endpoint: given a gospel question, return relevant real
 * scripture verses and verified prophet/apostle quotes. Used for previewing /
 * testing; the live class flow builds study through the phase route.
 */
export async function POST(req: NextRequest) {
  let body: { question?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const question = (body.question || "").trim();
  if (!question) {
    return NextResponse.json({ error: "Provide a question." }, { status: 400 });
  }

  const study = await buildStudy(question);
  return NextResponse.json(study, { headers: { "Cache-Control": "no-store" } });
}

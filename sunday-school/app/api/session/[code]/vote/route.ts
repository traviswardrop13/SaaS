import { NextRequest, NextResponse } from "next/server";
import { mutateSession } from "@/lib/store";
import { toPublic } from "@/lib/publicView";

export const dynamic = "force-dynamic";

/** Toggle this client's upvote on a question (during "vote" or "study"). */
export async function POST(
  req: NextRequest,
  { params }: { params: { code: string } },
) {
  const code = params.code.toUpperCase();

  let body: { questionId?: string; clientId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const questionId = (body.questionId || "").trim();
  const clientId = (body.clientId || "").trim();
  if (!questionId || !clientId) {
    return NextResponse.json({ error: "Missing question or client id." }, { status: 400 });
  }

  const updated = await mutateSession(code, (s) => {
    if (s.phase === "ask") return null; // voting not open yet
    const q = s.questions.find((x) => x.id === questionId);
    if (!q) return null;
    const i = q.voters.indexOf(clientId);
    if (i === -1) q.voters.push(clientId);
    else q.voters.splice(i, 1);
  });

  if (!updated) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }
  return NextResponse.json(toPublic(updated, clientId));
}

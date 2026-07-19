import { NextRequest, NextResponse } from "next/server";
import { getSession, mutateSession } from "@/lib/store";
import { toPublic } from "@/lib/publicView";
import { genId } from "@/lib/ids";

export const dynamic = "force-dynamic";

const MAX_TEXT = 300;
const MAX_AUTHOR = 40;
const MAX_QUESTIONS = 300;

/** Submit a gospel question (only while the class is in the "ask" phase). */
export async function POST(
  req: NextRequest,
  { params }: { params: { code: string } },
) {
  const code = params.code.toUpperCase();

  let body: { text?: string; author?: string; clientId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const text = (body.text || "").trim();
  if (!text) {
    return NextResponse.json({ error: "Please write a question first." }, { status: 400 });
  }
  const clientId = (body.clientId || "").trim();
  if (!clientId) {
    return NextResponse.json({ error: "Missing client id." }, { status: 400 });
  }
  const author = (body.author || "").trim().slice(0, MAX_AUTHOR) || undefined;

  const existing = await getSession(code);
  if (!existing) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }
  if (existing.phase !== "ask") {
    return NextResponse.json(
      { error: "The teacher has closed new questions for now." },
      { status: 409 },
    );
  }
  if (existing.questions.length >= MAX_QUESTIONS) {
    return NextResponse.json({ error: "This class has reached its question limit." }, { status: 409 });
  }

  const updated = await mutateSession(code, (s) => {
    if (s.phase !== "ask") return null; // aborted; keep as-is
    s.questions.push({
      id: genId(),
      text: text.slice(0, MAX_TEXT),
      author,
      by: clientId,
      voters: [],
      createdAt: Date.now(),
    });
  });

  if (!updated) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }
  return NextResponse.json(toPublic(updated, clientId));
}

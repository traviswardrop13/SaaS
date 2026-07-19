import { NextResponse } from "next/server";
import { getSession, putSession } from "@/lib/store";
import { genCode, genId } from "@/lib/ids";
import type { Session } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Create a new class session. Returns the join code and a host token. */
export async function POST() {
  let code = "";
  for (let i = 0; i < 12; i++) {
    const candidate = genCode();
    if (!(await getSession(candidate))) {
      code = candidate;
      break;
    }
  }
  if (!code) {
    return NextResponse.json(
      { error: "Could not allocate a join code, please try again." },
      { status: 500 },
    );
  }

  const session: Session = {
    code,
    createdAt: Date.now(),
    hostToken: genId(),
    phase: "ask",
    questions: [],
  };
  await putSession(session);

  return NextResponse.json({ code, hostToken: session.hostToken });
}

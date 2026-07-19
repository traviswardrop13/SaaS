import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/store";
import { toPublic } from "@/lib/publicView";

export const dynamic = "force-dynamic";

/** Live session state for a client (poll this). */
export async function GET(
  req: NextRequest,
  { params }: { params: { code: string } },
) {
  const code = params.code.toUpperCase();
  const clientId = req.nextUrl.searchParams.get("clientId") || undefined;

  const session = await getSession(code);
  if (!session) {
    return NextResponse.json(
      { error: "That class code wasn't found. Double-check it with your teacher." },
      { status: 404 },
    );
  }

  return NextResponse.json(toPublic(session, clientId), {
    headers: { "Cache-Control": "no-store" },
  });
}

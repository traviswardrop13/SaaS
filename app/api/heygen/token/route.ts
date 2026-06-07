import { NextResponse } from "next/server";

/**
 * Creates a short-lived HeyGen Streaming Avatar access token. The HEYGEN_API_KEY
 * stays server-side; the browser/app gets only the ephemeral token to start a
 * session. (Classic Interactive Avatar API — api.heygen.com.)
 */
export async function POST() {
  const key = process.env.HEYGEN_API_KEY;
  if (!key) {
    return NextResponse.json(
      { ok: false, error: "Server is missing HEYGEN_API_KEY." },
      { status: 500 },
    );
  }
  try {
    const r = await fetch("https://api.heygen.com/v1/streaming.create_token", {
      method: "POST",
      headers: { "x-api-key": key, "Content-Type": "application/json" },
    });
    const json = await r.json();
    const token = json?.data?.token;
    if (!token) {
      return NextResponse.json(
        { ok: false, error: "No token returned from HeyGen.", raw: json },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true, token });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Token request failed." },
      { status: 502 },
    );
  }
}

// Allow GET too, for easy testing in a browser.
export const GET = POST;

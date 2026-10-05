"use client";

import type { PublicSession, Phase } from "./types";

// ── Anonymous client identity (per browser) ──────────────────────────────────

export function clientId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("gq_client_id");
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("gq_client_id", id);
  }
  return id;
}

// ── Small typed fetch helpers ────────────────────────────────────────────────

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as { error?: string }).error || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

export async function createSession(): Promise<{ code: string; hostToken: string }> {
  const res = await fetch("/api/session", { method: "POST" });
  return jsonOrThrow(res);
}

export async function fetchSession(
  code: string,
  cid: string,
): Promise<PublicSession> {
  const res = await fetch(
    `/api/session/${encodeURIComponent(code)}?clientId=${encodeURIComponent(cid)}`,
    { cache: "no-store" },
  );
  return jsonOrThrow(res);
}

export async function submitQuestion(
  code: string,
  payload: { text: string; author?: string; clientId: string },
): Promise<PublicSession> {
  const res = await fetch(`/api/session/${encodeURIComponent(code)}/questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow(res);
}

export async function toggleVote(
  code: string,
  payload: { questionId: string; clientId: string },
): Promise<PublicSession> {
  const res = await fetch(`/api/session/${encodeURIComponent(code)}/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow(res);
}

export async function setPhase(
  code: string,
  payload: { phase: Phase; selectedQuestionId?: string; hostToken: string },
): Promise<PublicSession> {
  const res = await fetch(`/api/session/${encodeURIComponent(code)}/phase`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow(res);
}

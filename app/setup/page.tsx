"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loadState, newChild, update } from "@/lib/storage";

const AVATARS = ["🦁", "🐸", "🐼", "🦊", "🐨", "🐵", "🦄", "🐙", "🐧", "🦉"];

export default function SetupPage() {
  const router = useRouter();
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [hasParent, setHasParent] = useState(false);

  const [childName, setChildName] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);

  useEffect(() => {
    const s = loadState();
    if (s.parent) {
      setHasParent(true);
      setParentName(s.parent.name);
      setParentEmail(s.parent.email);
    }
  }, []);

  function handleSaveParent(e: React.FormEvent) {
    e.preventDefault();
    if (!parentName.trim()) return;
    update((s) => {
      s.parent = {
        name: parentName.trim(),
        email: parentEmail.trim(),
      };
    });
    setHasParent(true);
  }

  function handleAddChild(e: React.FormEvent) {
    e.preventDefault();
    const name = childName.trim();
    if (!name) return;
    const child = newChild(name, avatar);
    update((s) => {
      s.children.push(child);
      s.activeChildId = child.id;
    });
    router.push(`/kid/${child.id}`);
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link
        href="/"
        className="mb-6 inline-block font-display text-sm text-gray-500 hover:text-gray-700"
      >
        ← Home
      </Link>

      {!hasParent ? (
        <div className="card">
          <h1 className="font-display text-3xl font-extrabold text-brand-600">
            Hi grown-up! 👋
          </h1>
          <p className="mt-2 text-gray-600">
            We&apos;ll keep your child&apos;s progress on this device. You can
            add a name and email for the dashboard.
          </p>

          <form onSubmit={handleSaveParent} className="mt-6 space-y-4">
            <Field label="Your name">
              <input
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                placeholder="e.g. Sam"
                className="input"
                required
              />
            </Field>
            <Field label="Email (optional)">
              <input
                type="email"
                value={parentEmail}
                onChange={(e) => setParentEmail(e.target.value)}
                placeholder="you@example.com"
                className="input"
              />
            </Field>
            <button className="btn-primary w-full text-lg" type="submit">
              Continue
            </button>
          </form>
        </div>
      ) : (
        <div className="card">
          <h1 className="font-display text-3xl font-extrabold text-brand-600">
            Add a child 🧒
          </h1>
          <p className="mt-2 text-gray-600">
            Pick a name and a friendly avatar.
          </p>

          <form onSubmit={handleAddChild} className="mt-6 space-y-5">
            <Field label="Child's first name">
              <input
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                placeholder="e.g. Mia"
                className="input"
                required
                autoFocus
              />
            </Field>

            <div>
              <p className="mb-2 font-display font-bold">Pick an avatar</p>
              <div className="grid grid-cols-5 gap-3">
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
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <button className="btn-primary w-full text-lg" type="submit">
              Start playing
            </button>
          </form>
        </div>
      )}

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 16px;
          border: 2px solid #e5e7eb;
          padding: 12px 16px;
          font-size: 16px;
          background: #fff;
        }
        .input:focus {
          outline: none;
          border-color: #fb923c;
          box-shadow: 0 0 0 4px rgba(251, 146, 60, 0.2);
        }
      `}</style>
    </main>
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

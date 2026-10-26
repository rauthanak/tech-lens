"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import PlainHeader from "@/components/PlainHeader";
import { errorText, sendJson } from "@/lib/api";
import { type Me, safeNext } from "@/lib/me";

const FIELD = "mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm";

function SignIn() {
  const next = safeNext(useSearchParams().get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const me = await sendJson<Me>("/api/auth/sign-in", "POST", { email, password });
      // a full page load: nothing of an earlier person stays in the tab
      window.location.assign(me.must_change ? `/account/password?next=${encodeURIComponent(next)}` : next);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-card border border-line bg-white px-6 py-6">
      <h1 className="font-display text-2xl text-ink">Sign in</h1>
      <label className="mt-5 block text-sm text-neutral-700">Email
        <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)}
          className={FIELD} />
      </label>
      <label className="mt-4 block text-sm text-neutral-700">Password
        <input type="password" autoComplete="current-password" required value={password}
          onChange={(e) => setPassword(e.target.value)} className={FIELD} />
      </label>
      {error && <p role="alert" className="mt-4 text-sm text-failed">{error}</p>}
      <button type="submit" disabled={busy}
        className="mt-5 rounded-full bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-strong disabled:opacity-50">
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <p className="mt-5 text-xs text-muted">
        Forgot your password? Ask a radar admin to set a temporary one.
      </p>
    </form>
  );
}

export default function SignInPage() {
  return (
    <PlainHeader>
      <Suspense fallback={null}><SignIn /></Suspense>
    </PlainHeader>
  );
}

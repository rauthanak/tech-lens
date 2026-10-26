"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import PlainHeader from "@/components/PlainHeader";
import { errorText, sendJson } from "@/lib/api";
import { type Me, safeNext, signOut, useMe } from "@/lib/me";

const FIELD = "mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm";

function ChangePassword() {
  const next = safeNext(useSearchParams().get("next"));
  const me = useMe();
  const [current, setCurrent] = useState("");
  const [fresh, setFresh] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (fresh !== again) {
      setError("The two new passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sendJson<Me>("/api/auth/password", "POST", { current, new: fresh });
      window.location.assign(next); // a full page load, as the person's state changed
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-card border border-line bg-white px-6 py-6">
      <h1 className="font-display text-2xl text-ink">{me?.must_change ? "Choose a new password" : "Change password"}</h1>
      {me && <p className="mt-1 text-sm text-muted">{me.name} · {me.email}</p>}
      {me?.must_change && (
        <p className="mt-3 rounded bg-azure/10 px-3 py-2 text-sm text-navy">
          Choose a new password to go on. Until you do, the password you were given opens only this page.
        </p>
      )}
      <label className="mt-5 block text-sm text-neutral-700">
        {me?.must_change ? "The password you were given" : "Current password"}
        <input type="password" autoComplete="current-password" required value={current}
          onChange={(e) => setCurrent(e.target.value)} className={FIELD} />
      </label>
      <label className="mt-4 block text-sm text-neutral-700">New password (at least 8 characters)
        <input type="password" autoComplete="new-password" required minLength={8} value={fresh}
          onChange={(e) => setFresh(e.target.value)} className={FIELD} />
      </label>
      <label className="mt-4 block text-sm text-neutral-700">The new password again
        <input type="password" autoComplete="new-password" required minLength={8} value={again}
          onChange={(e) => setAgain(e.target.value)} className={FIELD} />
      </label>
      {error && <p role="alert" className="mt-4 text-sm text-failed">{error}</p>}
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button type="submit" disabled={busy}
          className="rounded-full bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-strong disabled:opacity-50">
          {busy ? "Saving…" : "Save the new password"}
        </button>
        {me && !me.must_change && <Link href={next} className="text-sm text-link hover:underline">Back</Link>}
        <button type="button" onClick={signOut} className="text-sm text-link hover:underline">Sign out</button>
      </div>
      <p className="mt-5 text-xs text-muted">Saving it signs you out on every other browser.</p>
    </form>
  );
}

export default function ChangePasswordPage() {
  return (
    <PlainHeader>
      <Suspense fallback={null}><ChangePassword /></Suspense>
    </PlainHeader>
  );
}

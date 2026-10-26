"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import ConfirmAction from "@/components/ConfirmAction";
import PageHeader from "@/components/PageHeader";
import { errorText, fetchJson, sendJson } from "@/lib/api";
import { formatAt, formatDay, plural } from "@/lib/format";
import { useMe } from "@/lib/me";

type Role = "admin" | "leader";
type Person = { email: string; name: string; role: Role; must_change: boolean; disabled: boolean;
  paused_until: string | null; last_signed_in: string | null; created_at: string | null;
  created_by: string | null }; // who added them (none: from the starting setup)

const FIELD = "w-full rounded border border-neutral-300 bg-white px-2.5 py-1.5 text-sm";
const PRIMARY = "rounded-full bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-strong disabled:opacity-50";
const SECONDARY = "rounded-full border border-line bg-white px-3.5 py-1.5 text-sm hover:bg-ground disabled:opacity-50";

/** What each role is, in the words the whole page uses. */
const ROLES: Record<Role, { title: string; one: string; sees: string }> = {
  admin: { title: "Administrators", one: "administrator",
    sees: "The whole portal: everything the radar team does. They can open the leaders' view to check it; their visits aren't counted." },
  leader: { title: "Leaders", one: "leader",
    sees: "The leaders' view only: the published edition and its Points of View. Their reads are counted, by name." },
};

const first = (p: Person) => p.name.split(" ")[0];

/** Where someone stands, as one chip: what a reader most needs to know about their access. */
function standing(p: Person): { word: string; style: string; why?: string } {
  if (p.disabled) return { word: "Switched off", style: "bg-neutral-200 text-neutral-700", why: "Can't sign in until switched on." };
  if (p.paused_until && Date.parse(p.paused_until) > Date.now())
    return { word: "Paused", style: "bg-amber-50 text-amber-900",
      why: `Too many wrong passwords, until ${formatAt(p.paused_until)}` };
  if (p.must_change && !p.last_signed_in) return { word: "Not signed in yet", style: "bg-amber-50 text-amber-900" };
  if (p.must_change) return { word: "Temporary password", style: "bg-amber-50 text-amber-900",
    why: "Chooses a new password at the next sign-in." };
  return { word: "Active", style: "bg-emerald-50 text-emerald-800" };
}

/** Add a person: who, which role (each explained), and the temporary password you will tell them. */
function AddPerson({ onAdded, onCancel }: { onAdded: (p: Person) => void; onCancel: () => void }) {
  const [form, setForm] = useState<{ name: string; email: string; role: Role; password: string }>(
    { name: "", email: "", role: "leader", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: "name" | "email" | "password") => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onAdded(await sendJson<Person>("/api/accounts", "POST", form));
    } catch (err) {
      setError(`Not added: ${errorText(err)}`);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={add} className="mt-5 rounded-card border border-azure/40 bg-white px-5 py-5 text-sm">
      <h2 className="text-base font-semibold text-ink">Add a person</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-neutral-700">Name
          <input required autoFocus value={form.name} onChange={set("name")} className={`mt-1 ${FIELD}`} /></label>
        <label className="block text-neutral-700">Email (what they sign in with)
          <input required type="email" value={form.email} onChange={set("email")} className={`mt-1 ${FIELD}`} /></label>
      </div>
      <fieldset className="mt-4">
        <legend className="text-neutral-700">What they see</legend>
        <div className="mt-1 grid gap-3 sm:grid-cols-2">
          {(["leader", "admin"] as Role[]).map((r) => (
            <label key={r} className={`flex cursor-pointer gap-2.5 rounded-card border px-3.5 py-3 ${
              form.role === r ? "border-azure bg-azure/5" : "border-line hover:bg-ground"}`}>
              <input type="radio" name="role" checked={form.role === r} onChange={() => setForm({ ...form, role: r })}
                className="mt-1" />
              <span><b className="font-semibold capitalize">{ROLES[r].one}</b>
                <span className="mt-0.5 block text-xs text-muted">{ROLES[r].sees}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="mt-4 block max-w-sm text-neutral-700">Temporary password
        <input required minLength={8} value={form.password} onChange={set("password")} className={`mt-1 ${FIELD}`} />
        <span className="mt-1 block text-xs text-muted">At least 8 characters. Tell them yourself; they choose their own
          when they first sign in.</span>
      </label>
      {error && <p role="alert" className="mt-3 text-failed">{error}</p>}
      <div className="mt-5 flex items-center gap-3">
        <button type="submit" disabled={busy} className={PRIMARY}>{busy ? "Adding…" : "Add"}</button>
        <button type="button" onClick={onCancel} className="text-link hover:underline">Cancel</button>
      </div>
    </form>
  );
}

/** What can be changed for one person, each with what it will do before it's done. */
function Manage({ p, onDone }: { p: Person; onDone: (what: string) => void }) {
  const [temporary, setTemporary] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const other: Role = p.role === "admin" ? "leader" : "admin";
  const put = (body: object) => sendJson(`/api/accounts/${encodeURIComponent(p.email)}`, "PUT", body);

  async function setPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await sendJson(`/api/accounts/${encodeURIComponent(p.email)}/password`, "POST", { password: temporary });
      setTemporary("");
      onDone(`Temporary password set for ${p.name}. Tell ${first(p)}; they choose their own at the next sign-in.`);
    } catch (err) {
      setError(`Not set: ${errorText(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 border-t border-neutral-100 bg-ground/60 px-5 py-4 text-sm lg:grid-cols-3">
      <section>
        <h3 className="font-semibold text-ink">Forgot their password</h3>
        <form onSubmit={setPassword} className="mt-2 flex flex-wrap items-center gap-2">
          <input required minLength={8} value={temporary} onChange={(e) => setTemporary(e.target.value)}
            placeholder="a temporary password" aria-label="Temporary password" className={`${FIELD} max-w-56`} />
          <button type="submit" disabled={busy} className={SECONDARY}>{busy ? "Setting…" : "Set"}</button>
        </form>
        <p className="mt-1.5 text-xs text-muted">They choose their own at the next sign-in. It also lifts a pause after
          wrong passwords.</p>
        {error && <p role="alert" className="mt-1 text-xs text-failed">{error}</p>}
      </section>
      <section>
        <h3 className="font-semibold text-ink">Role</h3>
        <p className="mt-1 text-xs text-muted">Now: {ROLES[p.role].one}. As {other === "admin" ? "an" : "a"}{" "}
          {ROLES[other].one}: {ROLES[other].sees.split(":")[0].toLowerCase()}.</p>
        <div className="mt-2">
          <ConfirmAction secondary label={`Make ${ROLES[other].one}`} confirmLabel={`Make ${ROLES[other].one}`} doneLabel="Done"
            question={`Make ${first(p)} ${other === "admin" ? "an" : "a"} ${ROLES[other].one}? They're signed out now.`}
            onConfirm={async () => {
              await put({ role: other });
              onDone(`${p.name} is now ${other === "admin" ? "an" : "a"} ${ROLES[other].one}, and was signed out.`);
            }} />
        </div>
      </section>
      <section>
        <h3 className="font-semibold text-ink">Access</h3>
        <p className="mt-1 text-xs text-muted">{p.disabled ? "Switched off: they can't sign in."
          : "Switching off signs them out at once; nothing they did is removed."}</p>
        <div className="mt-2">
          {p.disabled ? (
            <ConfirmAction secondary label="Switch on" confirmLabel="Switch on" doneLabel="Done"
              question={`Let ${first(p)} sign in again?`}
              onConfirm={async () => { await put({ disabled: false }); onDone(`${p.name} can sign in again.`); }} />
          ) : (
            <ConfirmAction secondary label="Switch off" confirmLabel="Switch off" doneLabel="Done"
              question={`Switch off ${first(p)}? They're signed out and can't sign in until switched on.`}
              onConfirm={async () => { await put({ disabled: true }); onDone(`${p.name} is switched off and was signed out.`); }} />
          )}
        </div>
      </section>
    </div>
  );
}

/** One person: who, where they stand, when they last signed in, and Manage. */
function PersonRow({ p, self, open, onToggle, onDone }: {
  p: Person; self: boolean; open: boolean; onToggle: () => void; onDone: (what: string) => void }) {
  const s = standing(p);
  return (
    <li>
      <div className="grid items-center gap-x-4 gap-y-1.5 px-5 py-3 text-sm sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1.2fr)_13rem_11rem]">
        <div className="min-w-0">
          <span className="font-medium text-ink">{p.name}</span>
          {self && <span className="ml-2 rounded-full bg-azure/15 px-2 py-0.5 text-[11px] text-navy">You</span>}
          <span className="block truncate text-[13px] text-muted">{p.email}</span>
          <span className="block text-xs text-muted">
            {p.created_by ? `Added by ${p.created_by}${p.created_at ? `, ${formatDay(p.created_at)}` : ""}` : "From the starting setup"}
          </span>
        </div>
        <div>
          <span className={`inline-block rounded-full px-2 py-0.5 text-[12px] ${s.style}`}>{s.word}</span>
          {s.why && <span className="mt-0.5 block text-xs text-muted">{s.why}</span>}
        </div>
        <div className="text-[13px] text-muted">
          {p.last_signed_in && <>Last signed in<span className="block text-neutral-700">{formatAt(p.last_signed_in)}</span></>}
        </div>
        <div className="sm:text-right">
          {self ? (
            <Link href="/account/password" className="text-[13px] text-link hover:underline">Change your password</Link>
          ) : (
            <button type="button" onClick={onToggle} aria-expanded={open} className={SECONDARY}>
              {open ? "Close" : "Manage"}
            </button>
          )}
        </div>
      </div>
      {open && !self && <Manage p={p} onDone={onDone} />}
    </li>
  );
}

/** Setup › People: who may sign in and what each sees, grouped by role. */
export default function PeoplePage() {
  const me = useMe();
  const [people, setPeople] = useState<Person[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const load = useCallback(() => {
    fetchJson<{ accounts: Person[] }>("/api/accounts")
      .then((r) => { setPeople(r.accounts); setError(null); })
      .catch(setError);
  }, []);
  useEffect(load, [load]);
  const done = (what: string) => { setNotice(what); load(); };

  const waiting = people?.filter((p) => !p.disabled && p.must_change).length ?? 0;
  const off = people?.filter((p) => p.disabled).length ?? 0;

  return (
    <div>
      <PageHeader title="People"
        intro="Who can sign in to the radar, and what each of them sees. Nobody else can open it."
        right={!adding && <button type="button" onClick={() => { setAdding(true); setNotice(null); }} className={PRIMARY}>
          + Add a person</button>}
        help={<>
          <li>Each person is an administrator or a leader; the two groups below say what each sees.</li>
          <li>Add a person with a temporary password and tell them it yourself: they choose their own the first time
            they sign in. There is no reset by email yet, so someone who forgot theirs asks you for a temporary one.</li>
          <li>Manage opens what you can change for a person. A new role or switching someone off asks first, then signs
            them out at once. Nobody can change their own role or switch themselves off: another administrator does it.</li>
          <li>After five wrong passwords in a row an account pauses for 15 minutes; a temporary password lifts the pause.</li>
        </>}>
        {people && (
          <p className="mt-2 text-sm text-neutral-600">
            {plural(people.length, "person", "people")}: {plural(people.filter((p) => p.role === "admin").length, "administrator")},{" "}
            {plural(people.filter((p) => p.role === "leader").length, "leader")}
            {waiting > 0 && <> · {waiting} still to choose a password</>}
            {off > 0 && <> · {off} switched off</>}
          </p>
        )}
      </PageHeader>

      {error != null && <BackendError error={error} />}
      {adding && <AddPerson onCancel={() => setAdding(false)} onAdded={(p) => {
        setAdding(false);
        done(`${p.name} was added as ${p.role === "admin" ? "an" : "a"} ${ROLES[p.role].one}. Tell ${first(p)} the temporary password.`);
      }} />}
      {notice && (
        <p role="status" className="mt-5 flex items-start justify-between gap-3 rounded-card border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="text-emerald-900/70 hover:text-emerald-900">✕</button>
        </p>
      )}

      {people && (["admin", "leader"] as Role[]).map((role) => {
        const group = people.filter((p) => p.role === role);
        return (
          <section key={role} className="mt-7">
            <h2 className="text-base font-semibold text-ink">{ROLES[role].title} <span className="font-normal text-muted">· {group.length}</span></h2>
            <p className="mt-0.5 text-sm text-muted">{ROLES[role].sees}</p>
            {group.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Nobody yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-neutral-100 rounded-card border border-line bg-white">
                {group.map((p) => (
                  <PersonRow key={p.email} p={p} self={p.email === me?.email} open={open === p.email}
                    onToggle={() => setOpen(open === p.email ? null : p.email)} onDone={done} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

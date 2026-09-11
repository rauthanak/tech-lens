"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import PageHeader from "@/components/PageHeader";
import { ApiError, fetchJson, sendJson } from "@/lib/api";

type Source = {
  source_id: string;
  name: string;
  url: string;
  horizon: "H1" | "H2" | "H3";
  cluster: string;
  cost: string;
  enabled: boolean;
  updated_at?: string;
};

const field =
  "mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-neutral-500";
const label = "block text-sm font-medium";

export default function SourceEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [form, setForm] = useState<Source | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchJson<Source>(`/api/sources/${id}`).then(setForm).catch(setError);
  }, [id]);

  const set = (patch: Partial<Source>) => setForm((f) => (f ? { ...f, ...patch } : f));

  async function save() {
    if (!form) return;
    setSaving(true);
    setSaveError(null);
    try {
      await sendJson(`/api/sources/${id}`, "PUT", {
        name: form.name,
        url: form.url,
        horizon: form.horizon,
        cluster: form.cluster,
        cost: form.cost,
        enabled: form.enabled,
      });
      router.push("/admin/sources");
    } catch (e) {
      setSaveError(e instanceof ApiError ? (e.detail ?? e.message) : "save failed");
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Sources" title={form?.name ?? "Edit source"}>
        <p className="mt-2 font-mono text-xs text-neutral-500">{id}</p>
      </PageHeader>

      {error != null && <BackendError error={error} />}

      {form && (
        <form
          className="mt-7 max-w-xl space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div>
            <label className={label} htmlFor="name">Name</label>
            <input
              id="name"
              className={field}
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              required
            />
          </div>

          <div>
            <label className={label} htmlFor="url">URL</label>
            <input
              id="url"
              className={`${field} font-mono text-xs`}
              value={form.url}
              onChange={(e) => set({ url: e.target.value })}
              type="url"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className={label}>Horizon</span>
              <div className="mt-1 flex overflow-hidden rounded border border-neutral-300 bg-white text-sm">
                {(["H1", "H2", "H3"] as const).map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => set({ horizon: h })}
                    className={`flex-1 px-3 py-1.5 ${
                      form.horizon === h
                        ? "bg-[#1c1a17] font-medium text-white"
                        : "hover:bg-neutral-100"
                    }`}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={label} htmlFor="cost">Cost</label>
              <select
                id="cost"
                className={field}
                value={form.cost}
                onChange={(e) => set({ cost: e.target.value })}
              >
                <option value="free">Free</option>
                <option value="free_tier">Free tier</option>
                <option value="licensed">Licensed</option>
              </select>
            </div>
          </div>

          <div>
            <label className={label} htmlFor="cluster">Cluster</label>
            <input
              id="cluster"
              className={`${field} font-mono text-xs`}
              value={form.cluster}
              onChange={(e) => set({ cluster: e.target.value })}
              required
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => set({ enabled: e.target.checked })}
            />
            Enabled — the radar reads this source
          </label>

          {saveError && (
            <p className="text-sm text-[#7a3c1e]">Save failed: {saveError}</p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-[#171513] px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <Link
              href="/admin/sources"
              className="px-2 py-2 text-sm text-neutral-600 hover:text-black"
            >
              Cancel
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}

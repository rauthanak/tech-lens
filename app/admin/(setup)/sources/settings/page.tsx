"use client";

import { useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import ListEditor from "@/components/ListEditor";
import PageHeader from "@/components/PageHeader";
import SavedNote from "@/components/SavedNote";
import { ApiError, configChanged, fetchJson, sendJson } from "@/lib/api";

type CrawlSettings = {
  skip_url_patterns: string[];
  pages_per_source: number;
  page_part_chars: number;
  page_part_concurrency: number;
  lookback_days: number;
};

const field =
  "mt-1 w-40 rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-neutral-500";

export default function CrawlSettingsPage() {
  const [form, setForm] = useState<CrawlSettings | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchJson<CrawlSettings>("/api/settings/crawl").then(setForm).catch(setError);
  }, []);

  async function save() {
    if (!form) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const updated = await sendJson<CrawlSettings>("/api/settings/crawl", "PUT", {
        skip_url_patterns: form.skip_url_patterns,
        pages_per_source: Number(form.pages_per_source),
        page_part_chars: Number(form.page_part_chars),
        page_part_concurrency: Number(form.page_part_concurrency),
        lookback_days: Number(form.lookback_days),
      });
      setForm(updated);
      setSaved(true);
      configChanged();
    } catch (e) {
      setSaveError(e instanceof ApiError ? (e.detail ?? e.message) : "save failed");
    } finally {
      setSaving(false);
    }
  }

  const number = (key: keyof CrawlSettings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => (f ? { ...f, [key]: e.target.value === "" ? "" : Number(e.target.value) } : f));

  return (
    <div>
      <PageHeader title="Crawl settings"
        intro="Limits for every collection: how far the crawler goes and how long pages are read."
        help={<>
          <li>Links the crawler never follows: a link is skipped when its address contains any of these. Images,
            scripts and other files are always skipped.</li>
          <li>Page budget per source: the most pages one collection takes from each website, and from each data
            source, shared across its saved searches. A website that reaches it is noted under Coverage on
            Operations.</li>
          <li>Page part size and parts processed in parallel: a long page is split into parts and read in parallel,
            and nothing is cut. Each part is one model call.</li>
          <li>First-run lookback: how far back a new saved search reaches the first time it runs.</li>
          <li>Saving costs nothing; the settings are read at the start of each collection. A bigger budget means
            more pages, and each new or changed page uses at least one model call.</li>
        </>} />

      {error != null && <BackendError error={error} />}

      {form && (
        <form className="mt-7 space-y-6" onSubmit={(e) => { e.preventDefault(); save(); }}>
          {/* two columns on wide screens: the skipped links, then the limits */}
          <div className="grid grid-cols-1 items-start gap-x-10 gap-y-6 lg:grid-cols-2">
            <div>
              <span className="block text-sm font-medium">Links the crawler never follows</span>
              <span className="block text-xs text-neutral-500">
                A link is skipped when its address contains any of these. File types such as images are
                always skipped.
              </span>
              <ListEditor items={form.skip_url_patterns} placeholder="e.g. /events/"
                onChange={(items) => setForm({ ...form, skip_url_patterns: items })} />
            </div>
            <div className="space-y-6">
              <label className="block text-sm font-medium">
                Page budget per source
                <input type="number" min={1} max={500} className={field} value={form.pages_per_source}
                  onChange={number("pages_per_source")} />
                <span className="mt-1 block text-xs font-normal text-neutral-500">
                  The most pages one collection takes from each website, and from each data source
                  across its saved searches (1–500). A website that reaches it is noted on Operations;
                  everything collected is kept.
                </span>
              </label>
              <label className="block text-sm font-medium">
                Page part size (characters)
                <input type="number" min={20000} className={field} value={form.page_part_chars}
                  onChange={number("page_part_chars")} />
                <span className="mt-1 block text-xs font-normal text-neutral-500">
                  Pages longer than this are split into parts and processed in parallel; nothing is cut.
                </span>
              </label>
              <label className="block text-sm font-medium">
                Parts processed in parallel
                <input type="number" min={1} max={16} className={field} value={form.page_part_concurrency}
                  onChange={number("page_part_concurrency")} />
              </label>
              <label className="block text-sm font-medium">
                First-run lookback (days)
                <input type="number" min={1} max={365} className={field} value={form.lookback_days}
                  onChange={number("lookback_days")} />
                <span className="mt-1 block text-xs font-normal text-neutral-500">
                  How far back a data source&apos;s saved search reaches the first time it runs.
                </span>
              </label>
            </div>
          </div>
          {saveError && <p className="text-sm text-failed">Save failed: {saveError}</p>}
          <SavedNote show={saved} />
          <button type="submit" disabled={saving}
            className="rounded-full bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-strong disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </form>
      )}
    </div>
  );
}

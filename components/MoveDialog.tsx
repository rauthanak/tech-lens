"use client";

import { useEffect, useState } from "react";
import ChoiceForm from "@/components/ChoiceForm";
import { errorText, fetchJson } from "@/lib/api";
import type { ListItem } from "@/lib/classification";
import { decide } from "@/lib/decisions";

type Field = "availability" | "domain" | "subdomain" | "trl";
const LIST: Record<Field, string> = { availability: "availability", domain: "domains", subdomain: "subdomains", trl: "trl_levels" };
const WORDS: Record<Field, string> = { availability: "Commercial availability", domain: "Domain", subdomain: "Sub-domain",
  trl: "Readiness (TRL)" };

/** "Change": a person moves a technology to another value of a list. The
 *  choice is kept and wins over what the model judged; it can be undone. */
export default function MoveDialog({ techId, field, current, domainId, onDone, label = "Change" }: {
  techId: string;
  field: Field;
  current?: string | number | null;
  domainId?: string;
  onDone: () => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) fetchJson<{ items: ListItem[] }>(`/api/lists/${LIST[field]}`).then((d) => { setItems(d.items); setError(null); })
      .catch((e) => setError(errorText(e)));
  }, [open, field]);
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="text-link hover:underline">{label}</button>;
  const options = (field === "subdomain" ? items.filter((i) => !domainId || i.domain_id === domainId) : items)
    .map((i) => field === "trl" ? { value: String(i.level), label: `${i.level}: ${i.name}` } : { value: i._id, label: i.name });
  return (
    <div className="basis-full">
      <ChoiceForm label={WORDS[field]} options={options} value={current != null ? String(current) : ""} reasonRequired={false}
        onSubmit={(v, reason) => decide({ kind: "move", tech_id: techId, field, value: field === "trl" ? Number(v) : v,
          reason: reason || null }).then(() => { setOpen(false); onDone(); })}
        onCancel={() => setOpen(false)} />
      {error && <p className="mt-1 text-xs text-failed">The choices didn&apos;t load: {error}</p>}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/api";

function StatusCard({ name, ok, note }: { name: string; ok: boolean | null; note: string }) {
  const dot = ok === null ? "bg-neutral-300" : ok ? "bg-azure" : "bg-failed-dot";
  const text = ok === null ? "Unknown" : ok ? "Operational" : "Down";
  return (
    <div className="flex items-center gap-4 rounded-card border border-line bg-white px-5 py-4">
      <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
      <div>
        <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">{name}</div>
        <div className="text-sm font-medium">
          {text}
          <span className="ml-2 font-normal text-neutral-500">{note}</span>
        </div>
      </div>
    </div>
  );
}

/** Is the Tech Atlas API answering, and can it reach MongoDB? */
export default function ServiceHealth() {
  const [health, setHealth] = useState<{ mongo: boolean } | null>(null);
  const [down, setDown] = useState(false);
  useEffect(() => {
    fetchJson<{ mongo: boolean }>("/api/health").then(setHealth).catch(() => setDown(true));
  }, []);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <StatusCard name="Tech Atlas API" ok={down ? false : health ? true : null}
        note={down ? "nothing answered on port 8100" : "port 8100"} />
      <StatusCard name="MongoDB" ok={down ? null : health ? health.mongo : null}
        note={down ? "unknown while the API is down" : "via /api/health"} />
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/api";
import { plural } from "@/lib/format";

type Listed = { _id: string; waiting?: number; replaced_by?: unknown };

/** On Technologies: the way to the catalog's import, which says when proposed
 *  matches wait for a decision and then opens that import. */
export default function ImportLink() {
  const [due, setDue] = useState<Listed | null>(null);
  useEffect(() => {
    fetchJson<{ imports: Listed[] }>("/api/imports")
      .then((d) => setDue(d.imports.find((i) => i.waiting && !i.replaced_by) ?? null)).catch(() => setDue(null));
  }, []);
  return due ? (
    <Link href={`/admin/import?id=${encodeURIComponent(due._id)}`} className="text-sm text-link hover:underline">
      Import a catalog file · <b className="font-semibold">{plural(due.waiting!, "match", "matches")} to review</b> →
    </Link>
  ) : (
    <Link href="/admin/import" className="text-sm text-link hover:underline">Import a catalog file →</Link>
  );
}

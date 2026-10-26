"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Bottlenecks from "@/components/Bottlenecks";
import FabricLabel from "@/components/FabricLabel";
import FinanceCard from "@/components/FinanceCard";
import PathToScale from "@/components/PathToScale";
import UseCases from "@/components/UseCases";
import { errorText, fetchJson } from "@/lib/api";
import { type Finance, FINANCE_SHOWN, hasFigures, type Pages, type PathStep, type UseCase, useValueLists } from "@/lib/value";

export type Fab = { fabric: string; finance: Finance; path: PathStep[]; cited_pages: Pages;
  use_case_decisions: Record<string, { _id: string; value: string }>;
  assessment: { fabric_id: string; fabric: string; use_cases?: UseCase[]; suggested_use_cases?: UseCase[];
    no_use_case?: { reason: string; evidence_needed: string } | null; value_failed?: string | null } };

const LABEL = "font-mono text-[10.5px] uppercase tracking-wider text-neutral-500";

/** Where the value lands, fabric by fabric, read-only: the use cases with
 *  their lever chains, the execution bottlenecks, the path to scale and the
 *  finance figures; until figures exist, "for Tata to fill in", linking to
 *  the technology's finance card. */
export default function PovValue({ techId, fabricIds, admin = false, frozen }: {
  techId: string;
  fabricIds: string[];
  admin?: boolean;
  frozen?: Fab[]; // an edition's copy: shown as it was published, nothing fetched
}) {
  const [live, setFabs] = useState<Fab[]>([]);
  const fabs = frozen ?? live;
  const [error, setError] = useState<string | null>(null);
  const lists = useValueLists();
  const key = fabricIds.join(",");
  useEffect(() => {
    if (!key || frozen || !admin) return; // the leaders' side shows only an edition's copy
    Promise.all(key.split(",").map((f) => fetchJson<Fab>(`/api/technologies/${techId}/assessment?fabric=${encodeURIComponent(f)}`)))
      .then(setFabs).catch((e) => setError(errorText(e)));
  }, [techId, key, frozen, admin]);
  if (error) return <p className="text-[13px] text-failed">Couldn&apos;t load where the value lands: {error}</p>;
  if (fabs.length === 0) return null;
  return (
    <div className="space-y-4">
      {fabs.map((f) => {
        const fid = f.assessment.fabric_id;
        return (
          <div key={fid} className="break-inside-avoid rounded-card border border-line bg-white px-4 py-3">
            <FabricLabel id={fid} name={f.assessment.fabric} />
            <div className="mt-2">
              <UseCases readOnly cases={f.assessment.use_cases ?? []}
                suggested={(f.assessment.suggested_use_cases ?? []).filter((s) => f.use_case_decisions[s.key]?.value === "accept")}
                none={f.assessment.no_use_case ?? null} failed={f.assessment.value_failed} decisions={f.use_case_decisions}
                pages={f.cited_pages} lists={lists} techId={techId} fabricId={fid} />
            </div>
            <div className="mt-3">
              <div className={LABEL}>What could stop it scaling</div>
              <div className="mt-1">
                <Bottlenecks readOnly picked={f.finance.bottlenecks} techId={techId} fabricId={fid} />
              </div>
            </div>
            <div className="mt-3">
              <div className={LABEL}>Path to scale: how far Tata has got</div>
              <div className="mt-1">
                <PathToScale readOnly steps={f.path} current={f.finance.step} next={f.finance.next_step} techId={techId} fabricId={fid} />
              </div>
            </div>
            {FINANCE_SHOWN && <div className="mt-3">
              <div className={`mb-1 ${LABEL}`}>Finance</div>
              {hasFigures(f.finance) ? <FinanceCard readOnly f={f.finance} techId={techId} fabricId={fid} /> : (
                <p className="rounded-lg bg-neutral-100 px-3 py-2 text-[13px] text-neutral-500 print:bg-transparent">
                  Contribution margin, payback and break-even: for Tata to fill in.{" "}
                  {admin && ( // the leaders' address can't open the admin's finance card
                    <Link href={`/admin/technologies/${techId}?fabric=${encodeURIComponent(fid)}#finance`} className="text-link hover:underline print:hidden">
                      Open its finance card →
                    </Link>
                  )}
                </p>
              )}
            </div>}
          </div>
        );
      })}
    </div>
  );
}

import PageRefs from "@/components/PageRefs";
import type { CitedPage } from "@/lib/classification";
import { CHAIN, type Lever } from "@/lib/value";

/** One value lever, in one line: "Lever 1 · Contribution", how it creates
 *  value (its mechanism, Setup › Mechanisms), its pages or "evidence needed",
 *  and what Tata would do differently. The full chain, from that change to
 *  when to take the next step, opens under it. */
export default function LeverChain({ lever, name, order, mechanism, pages }: {
  lever: Lever; name?: string; order?: number; mechanism?: string; pages: Record<string, CitedPage>;
}) {
  const n = lever.order ?? order;
  const needed = lever.evidence === "needed" || lever.pages.length === 0;
  return (
    <div className="rounded-lg border border-line bg-ground/40 px-3 py-2 text-[13px]">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="font-semibold">{n ? `Lever ${n} · ` : ""}{name ?? lever.lever_id}</span>
        <span className="rounded bg-navy/[0.07] px-1.5 text-[11.5px] text-navy" title="How it creates value: Setup › Mechanisms">
          {mechanism ?? lever.mechanism_id}
        </span>
        {needed ? <span className="rounded bg-amber-100 px-1.5 text-[11.5px] text-amber-900">Evidence needed: the pages don&apos;t show it yet</span>
          : <PageRefs ids={lever.pages} pages={pages} />}
      </div>
      <p className="mt-0.5 text-neutral-800">{lever.operating_change || "—"}</p>
      <details className="mt-1">
        <summary className="cursor-pointer text-[12.5px] text-link hover:underline">How it makes money, step by step</summary>
        <ol className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-5">
          {CHAIN.map(([key, label], i) => (
            <li key={key} className={`relative rounded bg-white px-2 py-1.5 text-[12.5px] ring-1 ${needed && key === "evidence_needed" ? "ring-amber-300" : "ring-line"}`}>
              <div className="text-[11.5px] font-medium text-muted">{i + 1}. {label}</div>
              <div className="mt-0.5 text-neutral-800">{String(lever[key] || "—")}</div>
              {i < CHAIN.length - 1 && <span aria-hidden className="absolute -right-2 top-1/2 hidden -translate-y-1/2 text-faint sm:block">→</span>}
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}

import { explain } from "@/lib/api";

export default function BackendError({ error }: { error: unknown }) {
  const { title, hint } = explain(error);
  return (
    <div className="mt-7 rounded-card border border-failed/40 bg-failed/5 px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="bg-navy px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-white">
          Backend
        </span>
        <span className="font-semibold text-failed">{title}</span>
      </div>
      <p className="mt-1.5 font-mono text-xs text-failed/80">{hint}</p>
    </div>
  );
}

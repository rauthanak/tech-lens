import { explain } from "@/lib/api";

export default function BackendError({ error }: { error: unknown }) {
  const { title, hint } = explain(error);
  return (
    <div className="mt-7 max-w-3xl border border-[#c4552f]/40 bg-[#fdf3ee] px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="bg-[#8a4b2d] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-white">
          Backend
        </span>
        <span className="font-semibold text-[#7a3c1e]">{title}</span>
      </div>
      <p className="mt-1.5 font-mono text-xs text-[#7a3c1e]/80">{hint}</p>
    </div>
  );
}

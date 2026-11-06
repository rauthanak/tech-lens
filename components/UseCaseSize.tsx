import type { Size } from "@/lib/value";

/** A use case's ballpark size, as the server words it, with its page (`refs`)
 *  beside it: a comparable says what it compares with and why; none says why;
 *  one from before sizing (or a model's suggestion) says it isn't sized yet. */
export default function UseCaseSize({ size, refs }: { size?: Size | null; refs?: React.ReactNode }) {
  if (!size) return (
    <span className="text-muted">Not sized yet<span className="block text-[12.5px]">The next assessment sizes it.</span></span>
  );
  if (size.basis === "none") return (
    <span className="text-muted">No reliable data<span className="block text-[12.5px]">{size.reason}</span></span>
  );
  return (
    <span>
      {size.words} {refs}
      {size.quote && <span className="block text-[12.5px] text-muted">&ldquo;{size.quote}&rdquo;</span>}
      {size.basis === "comparable" && (
        <span className="block text-[12.5px] text-muted">Comparable: {size.comparable}. {size.why_comparable}</span>
      )}
    </span>
  );
}

/** The industry a use case serves, as a small label beside its title. */
export function Industry({ name }: { name: string }) {
  return <span className="whitespace-nowrap rounded border border-line px-1 text-[11px] font-normal text-muted">{name}</span>;
}

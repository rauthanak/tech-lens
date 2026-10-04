import { FABRIC } from "@/lib/theme";

/** A fabric's name on its business-line colour; an unknown fabric gets a neutral pill. */
export default function FabricLabel({ id, name }: { id?: string; name: string }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium text-ink ${
      (id && FABRIC[id]) || "bg-neutral-100"}`}>
      {name}
    </span>
  );
}

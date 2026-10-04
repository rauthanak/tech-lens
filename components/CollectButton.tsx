"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ConfirmAction from "@/components/ConfirmAction";
import { collectQuestion, fetchRunsPreview, type RunsPreview, startCollection } from "@/lib/actions";
import { blockedReason, usePipeline } from "@/lib/pipeline";

/** "Collect now": asks first, with what the collection will cover, then
 *  opens the new collection's page. */
export default function CollectButton({ label = "Collect now" }: { label?: string }) {
  const router = useRouter();
  const p = usePipeline();
  const [preview, setPreview] = useState<RunsPreview | null>(null);
  useEffect(() => { fetchRunsPreview().then(setPreview).catch(() => {}); }, []);
  return (
    <ConfirmAction label={label} question={collectQuestion(preview)}
      disabled={blockedReason(p, "collect")}
      onConfirm={async () => router.push(`/admin/runs/${await startCollection()}`)} />
  );
}

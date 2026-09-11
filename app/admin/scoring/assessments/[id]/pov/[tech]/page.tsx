"use client";

// The PoV detail page moved under the Points of View tab so the nav
// highlights correctly — this old address just forwards.
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function PovRedirect() {
  const { id, tech } = useParams<{ id: string; tech: string }>();
  const router = useRouter();
  useEffect(() => {
    router.replace(`/admin/scoring/pov/${id}/${tech}`);
  }, [id, tech, router]);
  return null;
}

import { redirect } from "next/navigation";

/** A technology's result in one fabric now lives on the technology's own page,
 *  as that fabric's tab. Old links (bookmarks, PDFs) land there, keeping their
 *  back link. The id is "<run>:<technology>:<fabric>". */
export default async function AssessmentRedirect({ params, searchParams }: {
  params: Promise<{ id: string; aid: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id, aid } = await params;
  const [, tech, fabric] = decodeURIComponent(aid).split(":");
  const from = (await searchParams).from;
  if (!tech) redirect(`/admin/scoring/assessments/${id}`);
  const q = new URLSearchParams({ ...(fabric ? { fabric } : {}), ...(typeof from === "string" ? { from } : {}) });
  redirect(`/admin/technologies/${encodeURIComponent(tech)}?${q.toString()}`);
}

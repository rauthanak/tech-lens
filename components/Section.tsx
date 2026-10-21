/** One part of a technology's fabric tab: a plain title with a short summary
 *  beside it (so it still says something when folded), then what it is, what
 *  you do here and where it shows up, then the part itself. Click the title
 *  to fold it; open unless `closed`. */
export default function Section({ id, title, summary, what, todo, shows, closed, children }: {
  id?: string;
  title: React.ReactNode;
  summary?: React.ReactNode;
  what: React.ReactNode;
  todo?: React.ReactNode;
  shows?: React.ReactNode;
  closed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details id={id} open={!closed} className="group mt-3 scroll-mt-6 rounded-card border border-line bg-white px-5 py-3">
      <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-2.5 gap-y-0.5 [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="inline-block w-3 text-[11px] text-muted transition-transform group-open:rotate-90">▶</span>
        <h3 className="font-semibold">{title}</h3>
        {summary && <span className="text-[13px] text-muted">{summary}</span>}
      </summary>
      <dl className="mb-3 mt-1.5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 pl-5 text-[12.5px] text-neutral-700">
        <dt className="text-muted">What it is</dt><dd>{what}</dd>
        {todo && <><dt className="text-muted">What you do</dt><dd>{todo}</dd></>}
        {shows && <><dt className="text-muted">Where it shows</dt><dd>{shows}</dd></>}
      </dl>
      {children}
    </details>
  );
}

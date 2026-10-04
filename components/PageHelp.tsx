/** "How to read this page": closed whenever the page opens, so it never gets
 *  in the way; open, a few short points on what's listed, what the labels
 *  mean and what you can do, across the full width (two columns on wide
 *  screens, so lines stay readable). Pass the points as <li> elements. */
export default function PageHelp({ children }: { children: React.ReactNode }) {
  return (
    <details className="group mt-3 text-sm print:hidden">
      <summary className="group/summary -mx-1.5 inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md px-1.5 py-0.5 text-link focus:outline-none focus-visible:ring-2 focus-visible:ring-azure/40 [&::-webkit-details-marker]:hidden">
        {/* only the words underline: an underlined arrow turns into a bar when it rotates */}
        <span aria-hidden className="inline-block text-[10px] transition-transform group-open:rotate-90">▶</span>
        <span className="group-hover/summary:underline">How to read this page</span>
      </summary>
      <ul className="mt-2 list-disc gap-x-12 space-y-1.5 rounded-card border border-line bg-white py-3 pl-9 pr-6 text-[13.5px] leading-relaxed text-neutral-700 lg:columns-2 [&>li]:break-inside-avoid">
        {children}
      </ul>
    </details>
  );
}

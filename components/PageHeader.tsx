import PageHelp from "@/components/PageHelp";

/** Every page's top: the title, one plain sentence on what the page is for
 *  (`intro`) and any live lines (`children`), with `right` beside them
 *  (below them on narrow screens); then "How to read this page" (`help`,
 *  closed until opened) across the full width. */
export default function PageHeader({
  eyebrow,
  title,
  intro,
  help,
  right,
  children,
}: {
  eyebrow?: string;
  title: string;
  intro?: React.ReactNode;
  help?: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1 basis-96">
          {eyebrow && (
            <div className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.3em] text-neutral-500">
              {eyebrow}
            </div>
          )}
          <h1 className="font-display text-[34px] leading-tight">
            {title}
          </h1>
          {intro && <p className="mt-2 max-w-4xl text-sm text-neutral-600">{intro}</p>}
          {children}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      {help && <PageHelp>{help}</PageHelp>}
    </div>
  );
}

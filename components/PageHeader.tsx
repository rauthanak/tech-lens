export default function PageHeader({
  eyebrow,
  title,
  right,
  children,
}: {
  eyebrow: string;
  title: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-neutral-500">
          {eyebrow}
        </div>
        <h1 className="font-display mt-1.5 text-[34px] font-semibold leading-tight">
          {title}
        </h1>
        {children}
      </div>
      {right}
    </div>
  );
}

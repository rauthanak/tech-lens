/** The notice after a setup edit is saved: what it means, in one line. */
export default function SavedNote({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span role="status" className="text-sm text-ink">
      ✓ Saved. Applies from the next run. Listed in Changes.
    </span>
  );
}

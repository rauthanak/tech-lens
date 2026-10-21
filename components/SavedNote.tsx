/** The notice after a setup edit is saved: what it means, in one line
 *  (`what`, when the page says more exactly than "from the next run"). */
export default function SavedNote({ show, what = "Applies from the next run." }: { show: boolean; what?: string }) {
  if (!show) return null;
  return (
    <span role="status" className="text-sm text-ink">
      ✓ Saved. {what} Listed in Changes.
    </span>
  );
}

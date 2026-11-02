"use client";

import { useEffect, useRef } from "react";

/** A form or panel over the page instead of in it, so opening it never moves
 *  the page: the browser's own modal <dialog> keeps focus inside, closes on
 *  Esc, and puts focus back on the button that opened it. A click on the
 *  dimmed backdrop closes it too. */
export default function Dialog({ open, onClose, title, children }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} aria-label={title} onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      className="m-auto w-[min(34rem,calc(100vw-2rem))] max-h-[85vh] rounded-card border border-line bg-white p-0 text-ink shadow-xl backdrop:bg-ink/30">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Close"
          className="ml-auto rounded-full px-2 text-xl leading-none text-muted hover:bg-ground hover:text-ink">×</button>
      </div>
      <div className="max-h-[calc(85vh-3.5rem)] overflow-y-auto px-4 py-3">{open && children}</div>
    </dialog>
  );
}

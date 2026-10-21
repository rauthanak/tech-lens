"use client";

import { useState } from "react";

/** Edit a list of strings: add, edit in place, remove. Used for start pages,
 * saved searches and the crawl skip list. `ordered` adds up and down arrows,
 * for a list whose order the radar uses: start pages (the crawl visits them
 * in this order, which decides what it reads when there are more start pages
 * than its page limit, or when the model's choice of links fails and it
 * keeps crawl order). The skip list matches any entry, and saved searches
 * share the page limit equally, so their order changes nothing. */
export default function ListEditor({
  items,
  onChange,
  placeholder,
  mono = true,
  disabled = false,
  ordered = false,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  mono?: boolean;
  disabled?: boolean;
  ordered?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const input = `w-full rounded border border-neutral-300 bg-white px-2.5 py-1 text-sm outline-none focus:border-neutral-500 disabled:bg-neutral-50 ${mono ? "font-mono text-xs" : ""}`;
  const small = "rounded-full border border-line bg-white px-2 py-1 text-xs hover:bg-neutral-100 disabled:opacity-40";

  const set = (i: number, value: string) => onChange(items.map((x, j) => (j === i ? value : x)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...items];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  const add = () => {
    const value = draft.trim();
    if (value && !items.includes(value)) onChange([...items, value]);
    setDraft("");
  };

  return (
    <div className="mt-1 space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input className={input} value={item} disabled={disabled}
            onChange={(e) => set(i, e.target.value)} />
          {ordered && <>
            <button type="button" className={small} disabled={disabled || i === 0}
              onClick={() => move(i, -1)} title="Move up: read earlier">↑</button>
            <button type="button" className={small} disabled={disabled || i === items.length - 1}
              onClick={() => move(i, 1)} title="Move down: read later">↓</button>
          </>}
          <button type="button" className={small} disabled={disabled}
            onClick={() => onChange(items.filter((_, j) => j !== i))} title="Remove">✕</button>
        </div>
      ))}
      {!disabled && (
        <div className="flex items-center gap-1.5">
          <input className={input} value={draft} placeholder={placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
          <button type="button" className={small} onClick={add} disabled={!draft.trim()}>Add</button>
        </div>
      )}
    </div>
  );
}

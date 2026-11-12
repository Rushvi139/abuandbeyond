"use client";

import { useEffect, useRef, useState } from "react";

type Suggestion = { id: string; name: string; zone: string | null };

/**
 * The hotel box, with suggestions from our Stay Directory (Google Places
 * data). Picking one ties the order to that exact place, so the rider's
 * Navigate opens it instead of searching for whatever was typed. Typing a
 * name that isn't listed still works — it just isn't linked.
 */
export function PropertyField({
  id,
  value,
  stayId,
  onChange,
  placeholder,
  className,
  suggest = true,
}: {
  id: string;
  value: string;
  stayId: string;
  onChange: (name: string, stayId: string) => void;
  placeholder: string;
  className: string;
  suggest?: boolean;
}) {
  const [list, setList] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (!suggest || stayId || value.trim().length < 2) {
      setList([]);
      return;
    }
    const mine = ++seq.current;
    const t = setTimeout(() => {
      fetch(`/api/stays/search?q=${encodeURIComponent(value.trim())}`)
        .then((r) => r.json())
        .then((j: { data?: Suggestion[] }) => {
          if (mine === seq.current) setList(j.data ?? []);
        })
        .catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [value, stayId, suggest]);

  return (
    <div className="relative">
      <input
        id={id}
        value={value}
        autoComplete="off"
        onChange={(e) => {
          // Editing the name after picking a hotel un-links it: the order
          // must not navigate to a hotel the guest has since typed over.
          onChange(e.target.value, "");
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className={`${className} w-full`}
      />
      {stayId && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-hill">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
          Found on the map — your rider will navigate straight here.
        </p>
      )}
      {open && list.length > 0 && (
        <ul role="listbox" className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border-[1.5px] border-line bg-surface shadow-lg">
          {list.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(s.name, s.id);
                  setOpen(false);
                }}
                className="flex w-full items-baseline justify-between gap-3 px-3.5 py-2.5 text-left text-[15px] hover:bg-paper"
              >
                <span className="font-semibold">{s.name}</span>
                {s.zone && <span className="flex-none text-[12px] text-muted">{s.zone}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

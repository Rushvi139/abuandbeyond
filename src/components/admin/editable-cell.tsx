"use client";

import { useEffect, useRef, useState } from "react";
import type { CellResult } from "@/lib/admin/register-actions";

type Kind = "text" | "money" | "date" | "select";

export type CellProps = {
  value: string;
  display?: string;
  kind?: Kind;
  options?: { value: string; label: string }[];
  /** Hint shown inside the input while editing — never in place of a value,
   *  or an empty cell reads as filled in. */
  placeholder?: string;
  /** What an empty cell shows. A dash, unless the column needs more. */
  emptyLabel?: string;
  align?: "left" | "right";
  save: (next: string) => Promise<CellResult>;
  /** A column the signed-in role may read but not change. */
  readOnly?: boolean;
};

/**
 * A spreadsheet cell: tap it, it becomes an input, Enter or blur commits, Esc
 * puts it back. The new value is shown immediately and rolled back if the
 * server refuses, so a rejected edit never leaves a wrong number on screen
 * pretending to be saved.
 */
export function Cell({ value, display, kind = "text", options, placeholder, emptyLabel = "—", align = "left", save, readOnly }: CellProps) {
  const [editing, setEditing] = useState(false);
  const [shown, setShown] = useState(value);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement | HTMLSelectElement>(null);

  // The row can be re-rendered by a revalidate after someone else's edit.
  useEffect(() => setShown(value), [value]);

  useEffect(() => {
    if (!editing) return;
    ref.current?.focus();
    if (ref.current instanceof HTMLInputElement) ref.current.select();
  }, [editing]);

  async function commit(next: string) {
    setEditing(false);
    if (next === shown) return;
    const before = shown;
    setShown(next);
    setBusy(true);
    setErr(null);
    try {
      const r = await save(next);
      if (r?.error) {
        setShown(before);
        setErr(r.error);
      }
    } catch {
      setShown(before);
      setErr("Didn't save.");
    } finally {
      setBusy(false);
    }
  }

  const label = display && shown === value ? display : shown || emptyLabel;

  if (readOnly) return <span className={align === "right" ? "block text-right" : undefined}>{label}</span>;

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(shown);
          setErr(null);
          setEditing(true);
        }}
        title={err ?? "Tap to edit"}
        className={`-mx-1 block w-[calc(100%+0.5rem)] rounded px-1 py-0.5 text-left hover:bg-paper focus:bg-paper focus:outline-none focus:ring-1 focus:ring-ink ${
          align === "right" ? "text-right" : ""
        } ${busy ? "opacity-50" : ""} ${err ? "ring-1 ring-error" : ""} ${!shown ? "text-muted" : ""}`}
      >
        {label}
        {err && <span className="block text-[11px] font-semibold text-error">{err}</span>}
      </button>
    );
  }

  const shared = {
    ref: ref as never,
    defaultValue: draft,
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => commit(e.target.value),
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      if (e.key === "Escape") {
        e.preventDefault();
        setEditing(false);
      }
    },
    className: `-mx-1 w-[calc(100%+0.5rem)] rounded border border-ink bg-surface px-1 py-0.5 outline-none ${align === "right" ? "text-right" : ""}`,
  };

  if (kind === "select") {
    return (
      <select {...shared} onChange={(e) => commit(e.target.value)}>
        {options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      {...shared}
      type={kind === "date" ? "date" : kind === "money" ? "number" : "text"}
      step={kind === "money" ? "0.01" : undefined}
      inputMode={kind === "money" ? "decimal" : undefined}
      placeholder={placeholder}
    />
  );
}

/** Confirm-once delete, so a mis-tap on a phone can't wipe a row. */
export function DeleteCell({ onDelete, what }: { onDelete: () => Promise<CellResult>; what: string }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  if (err) {
    return (
      <button type="button" onClick={() => setErr(null)} className="text-[11px] font-semibold text-error" title={err}>
        {err.length > 28 ? `${err.slice(0, 27)}…` : err}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      aria-label={armed ? `Confirm delete ${what}` : `Delete ${what}`}
      onClick={async () => {
        if (!armed) return setArmed(true);
        setBusy(true);
        const r = await onDelete().catch(() => ({ error: "Didn't delete." }));
        setBusy(false);
        setArmed(false);
        if (r?.error) setErr(r.error);
      }}
      className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${armed ? "bg-error text-reversed" : "text-muted hover:text-error"}`}
    >
      {busy ? "…" : armed ? "Sure?" : "Delete"}
    </button>
  );
}

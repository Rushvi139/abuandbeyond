"use client";

import { useTransition, useState } from "react";
import { updateCateringEnquiry } from "@/lib/admin/catering-actions";

type Props = {
  id: string;
  name: string;
  phone: string | null;
  occasion: string | null;
  guests: number | null;
  eventOn: string | null;
  notes: string | null;
};

export function CateringEdit({ id, name, phone, occasion, guests, eventOn, notes }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-8 rounded-lg bg-paper px-3 text-xs font-semibold text-muted hover:bg-line transition-colors"
      >
        Edit details
      </button>
    );
  }

  return (
    <form
      className="mt-3 flex flex-col gap-2 rounded-2xl border border-line bg-paper p-3"
      action={(fd) =>
        start(async () => {
          try {
            await updateCateringEnquiry(id, fd);
            setOpen(false);
            setErr(null);
          } catch (e) {
            setErr(e instanceof Error ? e.message : "Something went wrong");
          }
        })
      }
    >
      <p className="text-xs font-bold uppercase tracking-wide text-muted">Edit enquiry</p>
      {err && <p className="rounded-lg bg-error/10 px-3 py-2 text-xs text-error">{err}</p>}

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-muted">Name *</span>
          <input name="name" defaultValue={name} required maxLength={100}
            className="h-9 rounded-xl border border-line bg-surface px-3 text-sm" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-muted">Phone</span>
          <input name="phone" defaultValue={phone ?? ""} maxLength={20}
            className="h-9 rounded-xl border border-line bg-surface px-3 text-sm" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-muted">Occasion</span>
          <input name="occasion" defaultValue={occasion ?? ""} maxLength={100}
            className="h-9 rounded-xl border border-line bg-surface px-3 text-sm" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-muted">Guests</span>
          <input name="guests" type="number" min={1} max={5000} defaultValue={guests ?? ""}
            className="h-9 rounded-xl border border-line bg-surface px-3 text-sm" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-muted">Event date</span>
          <input name="eventOn" type="date" defaultValue={eventOn ?? ""}
            className="h-9 rounded-xl border border-line bg-surface px-3 text-sm" />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold text-muted">Notes</span>
        <textarea name="notes" defaultValue={notes ?? ""} rows={3} maxLength={1000}
          className="rounded-xl border border-line bg-surface px-3 py-2 text-sm resize-none" />
      </label>

      <div className="flex gap-2">
        <button type="submit" disabled={pending}
          className="h-9 rounded-xl bg-ink px-4 text-sm font-semibold text-reversed disabled:opacity-60">
          {pending ? "Saving…" : "Save changes"}
        </button>
        <button type="button" onClick={() => { setOpen(false); setErr(null); }}
          className="h-9 rounded-xl border border-line px-4 text-sm font-semibold text-muted">
          Cancel
        </button>
      </div>
    </form>
  );
}

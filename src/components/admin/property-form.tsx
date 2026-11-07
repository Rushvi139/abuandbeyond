"use client";

import { useState, useTransition } from "react";
import { saveProperty, toggleProperty } from "@/lib/crm/actions";

type P = { id: string; name: string; kind: string; contactPerson: string | null; phone: string | null; address: string | null; notes: string | null };

export function PropertyForm({ property }: { property?: P }) {
  const [open, setOpen] = useState(!property);
  const [pending, start] = useTransition();
  const inp = "h-10 rounded-xl border border-line bg-paper px-3 text-sm";

  if (property && !open) return <button type="button" onClick={() => setOpen(true)} className="h-8 rounded-lg bg-paper px-3 text-xs font-semibold">Edit</button>;

  return (
    <form
      action={(fd) => start(async () => { await saveProperty(fd); if (property) setOpen(false); else (document.getElementById("pform") as HTMLFormElement | null)?.reset(); })}
      id={property ? undefined : "pform"}
      className={`flex w-full flex-col gap-2 rounded-2xl bg-surface p-4 ${property ? "mt-2 border border-line" : ""}`}
    >
      {property && <input type="hidden" name="id" value={property.id} />}
      <input name="name" required defaultValue={property?.name} placeholder="Hotel / villa name" className={inp} />
      <select name="kind" defaultValue={property?.kind ?? "hotel"} className={inp}>
        <option value="hotel">Hotel</option><option value="villa">Villa</option><option value="homestay">Homestay</option><option value="other">Other</option>
      </select>
      <input name="contactPerson" defaultValue={property?.contactPerson ?? ""} placeholder="Contact person (reception / manager)" className={inp} />
      <input name="phone" defaultValue={property?.phone ?? ""} placeholder="Phone" className={inp} />
      <input name="address" defaultValue={property?.address ?? ""} placeholder="Address / landmark" className={inp} />
      <input name="notes" defaultValue={property?.notes ?? ""} placeholder="Notes (commission deal, where the QR is placed…)" className={inp} />
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="h-10 flex-1 rounded-xl bg-ink text-sm font-semibold text-reversed disabled:opacity-50">{pending ? "Saving…" : property ? "Save" : "Add property"}</button>
        {property && <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-xl px-3 text-sm font-semibold text-muted">Cancel</button>}
      </div>
    </form>
  );
}

export function PropertyToggle({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(() => toggleProperty(id, !active))} className="h-8 rounded-lg px-3 text-xs font-semibold text-muted">
      {active ? "Deactivate" : "Activate"}
    </button>
  );
}

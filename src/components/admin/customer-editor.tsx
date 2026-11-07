"use client";

import { useState, useTransition } from "react";
import { updateCustomer } from "@/lib/crm/actions";

const TAGS = ["tourist", "local", "repeat", "vip", "hotel-staff", "late-night"];

export function CustomerEditor({ id, name, tags, notes, optIn }: { id: string; name: string; tags: string[]; notes: string; optIn: boolean }) {
  const [n, setN] = useState(name);
  const [t, setT] = useState<string[]>(tags);
  const [no, setNo] = useState(notes);
  const [wa, setWa] = useState(optIn);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  function save() {
    start(async () => {
      await updateCustomer(id, { name: n, tags: t, notes: no, whatsappOptIn: wa });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
      <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-muted">
        Name
        <input value={n} onChange={(e) => setN(e.target.value)} className="h-10 rounded-xl border border-line bg-paper px-3 text-sm font-normal normal-case tracking-normal text-ink" />
      </label>
      <div>
        <div className="text-xs font-bold uppercase tracking-wide text-muted">Tags</div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {TAGS.map((tag) => {
            const on = t.includes(tag);
            return (
              <button key={tag} type="button" onClick={() => setT((p) => (on ? p.filter((x) => x !== tag) : [...p, tag]))} className={`h-8 rounded-full px-3 text-xs font-semibold ${on ? "bg-ink text-reversed" : "border border-line bg-paper"}`}>
                {tag}
              </button>
            );
          })}
        </div>
      </div>
      <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-muted">
        Notes
        <textarea value={no} onChange={(e) => setNo(e.target.value)} rows={3} placeholder="Allergies, how they like it, room they usually stay in…" className="rounded-xl border border-line bg-paper px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={wa} onChange={(e) => setWa(e.target.checked)} className="h-4 w-4 accent-clay" /> OK to message on WhatsApp
      </label>
      <button type="button" onClick={save} disabled={pending} className="h-10 rounded-xl bg-ink text-sm font-semibold text-reversed disabled:opacity-50">{saved ? "Saved" : pending ? "Saving…" : "Save"}</button>
    </div>
  );
}

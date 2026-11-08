"use client";

import { useState } from "react";

const OCCASIONS = ["Birthday", "House party", "Office lunch", "Wedding function", "Trek / picnic box", "Something else"];

/** Catering enquiries from the help page: parties, office lunches, trek boxes. */
export function CateringForm() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", occasion: "", guests: "", eventOn: "", notes: "" });
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: k === "phone" ? e.target.value.replace(/\D/g, "").slice(0, 10) : e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    setError(null);
    const res = await fetch("/api/catering", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...form, guests: form.guests ? Number(form.guests) : undefined }),
    }).then((r) => r.json()).catch(() => ({ ok: false, error: "Network trouble. Try again." }));
    if (res.ok) setState("done");
    else {
      setState("idle");
      setError(res.error ?? "Check the details");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-2xl bg-surface p-5 text-center">
        <p className="font-display text-[22px] uppercase leading-none">We&apos;ll call you</p>
        <p className="mt-2 text-[15px] text-muted">Someone from the kitchen will ring within a day to talk menu and numbers.</p>
      </div>
    );
  }

  const field = "h-12 w-full rounded-xl border-[1.5px] border-line bg-paper px-3.5 text-[15px]";
  return (
    <div className="rounded-2xl bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-[22px] uppercase leading-none">Feeding a crowd?</p>
          <p className="mt-1.5 text-[15px] text-muted">Birthdays, office lunches, trek boxes, a house full of family. Tell us the date and how many, and we&apos;ll build a menu and a price.</p>
        </div>
      </div>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="mt-4 h-12 w-full rounded-xl bg-hill text-sm font-bold text-reversed">
          Ask about catering
        </button>
      ) : (
        <form onSubmit={submit} className="mt-4 flex flex-col gap-2.5">
          <input value={form.name} onChange={set("name")} placeholder="Your name" className={field} />
          <label className="flex h-12 items-center gap-2 rounded-xl border-[1.5px] border-line bg-paper px-3.5">
            <span className="text-[15px] text-muted">+91</span>
            <input value={form.phone} onChange={set("phone")} inputMode="numeric" placeholder="Mobile number" className="h-full flex-1 bg-transparent text-[15px] outline-none" />
          </label>
          <div className="flex flex-wrap gap-2">
            {OCCASIONS.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setForm((f) => ({ ...f, occasion: f.occasion === o ? "" : o }))}
                aria-pressed={form.occasion === o}
                className={`h-9 rounded-full border-[1.5px] px-3.5 text-[13px] font-semibold ${form.occasion === o ? "border-clay bg-clay text-ink" : "border-line text-ink"}`}
              >
                {o}
              </button>
            ))}
          </div>
          <div className="flex gap-2.5">
            <input value={form.guests} onChange={set("guests")} inputMode="numeric" placeholder="How many people" className={field} />
            <input value={form.eventOn} onChange={set("eventOn")} type="date" aria-label="Date of the event" className={field} />
          </div>
          <textarea value={form.notes} onChange={set("notes")} rows={3} maxLength={500} placeholder="Anything we should know — veg only, allergies, where it is…" className="w-full rounded-xl border-[1.5px] border-line bg-paper p-3.5 text-[15px]" />
          {error && <p className="text-sm text-error">{error}</p>}
          <button disabled={state === "busy" || form.name.length < 2 || form.phone.length !== 10} className="h-12 rounded-xl bg-hill text-sm font-bold text-reversed disabled:opacity-50">
            {state === "busy" ? "Sending…" : "Send enquiry"}
          </button>
        </form>
      )}
    </div>
  );
}

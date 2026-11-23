"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { addDaybookPages, deleteDaybookPage } from "@/lib/admin/photo-actions";

const today = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

/** Snap the day's book page (or several) and file it under its date. */
export function DaybookUpload() {
  const [day, setDay] = useState(today());
  const [note, setNote] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const [count, setCount] = useState(0);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();
  const inp = "h-11 rounded-xl border-[1.5px] border-line bg-paper px-3 text-sm";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const files = Array.from(ref.current?.files ?? []);
        if (!files.length) return setMsg({ ok: false, text: "Pick a photo of the page first." });
        const fd = new FormData();
        fd.set("day", day);
        fd.set("note", note);
        for (const f of files) fd.append("photos", f);
        start(async () => {
          setMsg(null);
          const r: { error?: string; added?: number } = await addDaybookPages(fd).catch(() => ({ error: "Didn't upload. Check your connection and try again." }));
          if (r.error) return setMsg({ ok: false, text: r.error });
          setMsg({ ok: true, text: `Saved ${r.added} photo${r.added === 1 ? "" : "s"} for ${new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })}.` });
          setNote("");
          setCount(0);
          if (ref.current) ref.current.value = "";
          router.refresh();
        });
      }}
      className="flex flex-col gap-3 rounded-2xl bg-surface p-4"
    >
      <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          Date of the page
          <input type="date" value={day} max={today()} onChange={(e) => setDay(e.target.value)} className={inp} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          Note (optional)
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. lunch + dinner, page 2" className={inp} />
        </label>
      </div>
      <input ref={ref} id="daybook-photos" type="file" multiple accept="image/*,application/pdf" className="sr-only" onChange={(e) => setCount(e.target.files?.length ?? 0)} />
      <div className="flex flex-wrap gap-2">
        <label htmlFor="daybook-photos" className="flex h-11 flex-1 cursor-pointer items-center justify-center rounded-xl border-[1.5px] border-dashed border-ink text-sm font-semibold">
          {count ? `${count} photo${count > 1 ? "s" : ""} picked · change` : "Take or pick photos of the page"}
        </label>
        <button type="submit" disabled={pending} className="h-11 rounded-xl bg-clay px-5 text-sm font-bold text-ink disabled:opacity-50">
          {pending ? "Uploading…" : "Save"}
        </button>
      </div>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm font-semibold ${msg.ok ? "text-success" : "text-error"}`}>{msg.text}</p>}
    </form>
  );
}

export function DeletePage({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [sure, setSure] = useState(false);
  const router = useRouter();
  if (!sure) return <button type="button" onClick={() => setSure(true)} className="text-[11px] font-semibold text-muted hover:text-error">Remove</button>;
  return (
    <button type="button" disabled={pending} onClick={() => start(async () => { await deleteDaybookPage(id); router.refresh(); })} className="text-[11px] font-bold text-error">
      {pending ? "…" : "Tap again to remove"}
    </button>
  );
}

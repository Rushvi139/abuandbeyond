"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createStatement, markStatementPaid, rotatePartnerLink, setPartnerBilling, unmarkStatementPaid } from "@/lib/partners/actions";
import { PAID_FROM, PAID_FROM_LABEL } from "@/lib/admin/paid-from";

const inp = "h-10 rounded-xl border border-line bg-paper px-3 text-sm";
const btn = "h-10 rounded-xl bg-ink px-4 text-sm font-semibold text-reversed disabled:opacity-50";
const today = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

function Err({ msg }: { msg: string | null }) {
  return msg ? <p role="alert" className="text-sm font-semibold text-error">{msg}</p> : null;
}

/** Guests pay as usual, or every order goes on the partner's account. */
export function BillingForm({ id, billing, creditDays }: { id: string; billing: "guest" | "credit"; creditDays: number }) {
  const [mode, setMode] = useState(billing);
  const [days, setDays] = useState(String(creditDays));
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const chip = (on: boolean) => `h-10 rounded-xl px-3 text-sm font-semibold ${on ? "bg-ink text-reversed" : "border border-line bg-paper"}`;
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" onClick={() => setMode("credit")} className={chip(mode === "credit")}>Partner pays (credit)</button>
        <button type="button" onClick={() => setMode("guest")} className={chip(mode === "guest")}>Guests pay</button>
      </div>
      <p className="text-[12px] text-muted">
        {mode === "credit"
          ? "Every order from this partner's QR goes on their account. Guests pay nothing; you send a statement."
          : "Guests pay as usual. The QR only tracks which orders came from here."}
      </p>
      {mode === "credit" && (
        <label className="flex items-center gap-2 text-sm">
          Pay within
          <input type="number" min={1} max={90} value={days} onChange={(e) => setDays(e.target.value)} className={`${inp} w-20`} />
          days of the statement
        </label>
      )}
      <Err msg={err} />
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setErr(null);
            setSaved(false);
            const r = await setPartnerBilling({ id, billing: mode, creditDays: Number(days) || 15 });
            if (r.error) setErr(r.error);
            else setSaved(true);
          })
        }
        className={btn}
      >
        {pending ? "Saving…" : saved ? "Saved" : "Save billing"}
      </button>
    </div>
  );
}

/** Bill everything unbilled up to a date. */
export function CreateStatement({ propertyId, unbilledOrders }: { propertyId: string; unbilledOrders: number }) {
  const [upTo, setUpTo] = useState(today());
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm" htmlFor="st-upto">Orders up to</label>
        <input id="st-upto" type="date" value={upTo} max={today()} onChange={(e) => setUpTo(e.target.value)} className={inp} />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className={`${inp} min-w-0 flex-1`} />
      </div>
      <Err msg={err} />
      <button
        type="button"
        disabled={pending || unbilledOrders === 0}
        onClick={() =>
          start(async () => {
            setErr(null);
            const r = await createStatement({ propertyId, upTo, note });
            if (r.error) setErr(r.error);
            else if (r.id) router.push(`/admin/partners/statement/${r.id}`);
          })
        }
        className={btn}
      >
        {pending ? "Making statement…" : unbilledOrders ? `Make statement (${unbilledOrders} order${unbilledOrders > 1 ? "s" : ""} unbilled)` : "Nothing unbilled"}
      </button>
    </div>
  );
}

export function MarkPaid({ id, paid, isOwner }: { id: string; paid: boolean; isOwner: boolean }) {
  const [open, setOpen] = useState(false);
  const [paidOn, setPaidOn] = useState(today());
  const [from, setFrom] = useState<string>("hdfc");
  const [ref, setRef] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  if (paid) {
    return isOwner ? (
      <button type="button" disabled={pending} onClick={() => start(async () => void (await unmarkStatementPaid(id)))} className="text-xs font-semibold text-muted underline-offset-2 hover:underline">
        Undo paid
      </button>
    ) : null;
  }
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="h-9 rounded-lg bg-ink px-3 text-xs font-bold text-reversed">Mark paid</button>;
  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      <input type="date" value={paidOn} max={today()} onChange={(e) => setPaidOn(e.target.value)} className={inp} aria-label="Paid on" />
      <select value={from} onChange={(e) => setFrom(e.target.value)} className={inp} aria-label="Paid into">
        {PAID_FROM.map((f) => <option key={f} value={f}>Into {PAID_FROM_LABEL[f]}</option>)}
      </select>
      <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="UTR / cheque / UPI ref" className={`${inp} min-w-0 flex-1`} />
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setErr(null);
            const r = await markStatementPaid({ id, paidOn, paidFrom: from, reference: ref });
            if (r.error) setErr(r.error);
            else setOpen(false);
          })
        }
        className={btn}
      >
        {pending ? "Saving…" : "Save payment"}
      </button>
      <Err msg={err} />
    </div>
  );
}

export function PartnerLink({ url, propertyId }: { url: string; propertyId: string }) {
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-1.5">
      <code className="break-all rounded-lg bg-paper px-3 py-2 text-xs">{url}</code>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(url).then(() => setCopied(true)).catch(() => {})}
          className="h-8 rounded-lg bg-paper px-3 text-xs font-semibold"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
        <button type="button" disabled={pending} onClick={() => start(async () => void (await rotatePartnerLink(propertyId)))} className="h-8 rounded-lg px-3 text-xs font-semibold text-muted">
          {pending ? "Making a new one…" : "New link (old one stops)"}
        </button>
      </div>
    </div>
  );
}

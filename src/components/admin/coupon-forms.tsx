"use client";

import { useState, useTransition } from "react";
import { deleteCoupon, saveCoupon, setCouponActive } from "@/lib/admin/coupon-actions";

export type CouponRow = {
  id: string;
  code: string;
  description: string | null;
  kind: "percent" | "flat";
  percent: number | null;
  valuePaise: number | null;
  maxDiscountPaise: number | null;
  minOrderPaise: number;
  startsOn: string | null;
  endsOn: string | null;
  maxRedemptions: number | null;
  perCustomerLimit: number;
  firstOrderOnly: boolean;
  active: boolean;
  used: number;
  discounted: number;
};

const inp = "h-10 w-full rounded-xl border-[1.5px] border-line bg-paper px-2.5 text-sm outline-none focus:border-ink";

export function CouponForm({ coupon, onDone }: { coupon?: CouponRow; onDone?: () => void }) {
  const [kind, setKind] = useState<"percent" | "flat">(coupon?.kind ?? "percent");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      action={(fd) =>
        start(async () => {
          setErr(null);
          const r = await saveCoupon(fd).catch(() => ({ error: "Couldn't save that." }));
          if (r?.error) setErr(r.error);
          else onDone?.();
        })
      }
      className="grid grid-cols-2 gap-2 rounded-2xl bg-surface p-3"
    >
      {coupon && <input type="hidden" name="id" value={coupon.id} />}

      <L label="Code" wide>
        <input name="code" defaultValue={coupon?.code} required placeholder="MOUNTABU20" className={`${inp} uppercase`} />
      </L>
      <L label="What it's for (internal)" wide>
        <input name="description" defaultValue={coupon?.description ?? ""} placeholder="Diwali week, Instagram" className={inp} />
      </L>

      <L label="Type">
        <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as "percent" | "flat")} className={inp}>
          <option value="percent">% off</option>
          <option value="flat">₹ off</option>
        </select>
      </L>
      {kind === "percent" ? (
        <L label="Percent off">
          <input name="percent" type="number" min={1} max={100} defaultValue={coupon?.percent ?? 10} className={inp} />
        </L>
      ) : (
        <L label="₹ off">
          <input name="valueInr" type="number" min={1} step="1" defaultValue={coupon?.valuePaise ? coupon.valuePaise / 100 : 50} className={inp} />
        </L>
      )}

      <L label={kind === "percent" ? "Most it can take off ₹" : "Cap (optional) ₹"}>
        <input
          name="maxDiscountInr"
          type="number"
          min={0}
          step="1"
          required={kind === "percent"}
          defaultValue={coupon?.maxDiscountPaise ? coupon.maxDiscountPaise / 100 : ""}
          placeholder={kind === "percent" ? "required" : "none"}
          className={inp}
        />
      </L>
      <L label="Minimum order ₹">
        <input name="minOrderInr" type="number" min={0} step="1" defaultValue={coupon?.minOrderPaise ? coupon.minOrderPaise / 100 : 0} className={inp} />
      </L>

      <L label="From"><input name="startsOn" type="date" defaultValue={coupon?.startsOn ?? ""} className={inp} /></L>
      <L label="Until"><input name="endsOn" type="date" defaultValue={coupon?.endsOn ?? ""} className={inp} /></L>

      <L label="Total uses (blank = no limit)">
        <input name="maxRedemptions" type="number" min={1} defaultValue={coupon?.maxRedemptions ?? ""} placeholder="unlimited" className={inp} />
      </L>
      <L label="Per customer">
        <input name="perCustomerLimit" type="number" min={1} max={50} defaultValue={coupon?.perCustomerLimit ?? 1} className={inp} />
      </L>

      <label className="col-span-2 flex items-center gap-2 text-sm">
        <input type="checkbox" name="firstOrderOnly" defaultChecked={coupon?.firstOrderOnly} className="h-4 w-4" />
        First order only
      </label>

      {err && <p className="col-span-2 text-xs font-semibold text-error">{err}</p>}
      <button type="submit" disabled={pending} className="col-span-2 h-10 rounded-xl bg-ink text-sm font-semibold text-reversed disabled:opacity-50">
        {pending ? "Saving…" : coupon ? "Save changes" : "Create coupon"}
      </button>
    </form>
  );
}

function L({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`block ${wide ? "col-span-2" : ""}`}>
      <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}

export function CouponControls({ coupon, canDelete }: { coupon: CouponRow; canDelete: boolean }) {
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const [pending, start] = useTransition();

  if (editing) {
    return (
      <div className="col-span-full mt-2">
        <CouponForm coupon={coupon} onDone={() => setEditing(false)} />
        <button type="button" onClick={() => setEditing(false)} className="mt-1 text-xs text-muted">Cancel</button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {err && <span className="text-[11px] font-semibold text-error">{err}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => { const r = await setCouponActive(coupon.id, !coupon.active); if (r?.error) setErr(r.error); })}
        className={`h-8 rounded-lg px-2.5 text-xs font-semibold ${coupon.active ? "bg-paper" : "bg-success text-reversed"}`}
      >
        {coupon.active ? "Switch off" : "Switch on"}
      </button>
      <button type="button" onClick={() => setEditing(true)} className="h-8 rounded-lg bg-paper px-2.5 text-xs font-semibold">Edit</button>
      {canDelete && coupon.used === 0 && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!armed) return setArmed(true);
            start(async () => { const r = await deleteCoupon(coupon.id); if (r?.error) setErr(r.error); setArmed(false); });
          }}
          className={`h-8 rounded-lg px-2.5 text-xs font-semibold ${armed ? "bg-error text-reversed" : "text-muted hover:text-error"}`}
        >
          {armed ? "Sure?" : "Delete"}
        </button>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { formatINR } from "@/lib/pricing";

export type Applied = { code: string; discountPaise: number; description: string | null } | null;

/**
 * The code box at checkout. What it shows is a preview — the discount is
 * worked out again on the server when the order is created, against the server's
 * own prices, so an edited number here buys nothing.
 */
export function CouponField({
  subtotalPaise,
  phone,
  applied,
  onChange,
}: {
  subtotalPaise: number;
  phone: string;
  applied: Applied;
  onChange: (a: Applied) => void;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subtotalAtApply = useRef(subtotalPaise);

  // The bag can change after a code is applied, and the discount moves with it
  // — or stops qualifying. Re-check rather than quietly keeping a stale number.
  useEffect(() => {
    if (!applied || subtotalPaise === subtotalAtApply.current) return;
    let gone = false;
    (async () => {
      const r = await ask(applied.code, subtotalPaise, phone);
      if (gone) return;
      subtotalAtApply.current = subtotalPaise;
      if (r.ok) onChange({ code: r.code, discountPaise: r.discountPaise, description: r.description });
      else {
        onChange(null);
        setError(r.reason);
        setOpen(true);
        setCode(applied.code);
      }
    })();
    return () => {
      gone = true;
    };
  }, [subtotalPaise, applied, phone, onChange]);

  async function apply() {
    const entered = code.trim();
    if (!entered || busy) return;
    setBusy(true);
    setError(null);
    const r = await ask(entered, subtotalPaise, phone);
    setBusy(false);
    if (r.ok) {
      subtotalAtApply.current = subtotalPaise;
      onChange({ code: r.code, discountPaise: r.discountPaise, description: r.description });
      setOpen(false);
      setCode("");
    } else {
      setError(r.reason);
    }
  }

  if (applied) {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-success/10 px-4 py-3 text-[15px]">
        <span className="flex-1">
          <b className="font-semibold uppercase">{applied.code}</b> applied
          <span className="block text-[13px] text-muted">You save {formatINR(applied.discountPaise)}</span>
        </span>
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setError(null);
          }}
          className="text-sm font-semibold text-muted underline-offset-2 hover:underline"
        >
          Remove
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-left text-[15px] font-semibold text-hill underline-offset-2 hover:underline">
        Have a coupon code?
      </button>
    );
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), apply())}
          placeholder="Enter code"
          autoCapitalize="characters"
          autoComplete="off"
          aria-label="Coupon code"
          className="h-12 min-w-0 flex-1 rounded-2xl border-[1.5px] border-line bg-surface px-4 text-[17px] uppercase outline-none focus:border-ink"
        />
        <button
          type="button"
          onClick={apply}
          disabled={busy || !code.trim()}
          className="h-12 flex-none rounded-2xl bg-ink px-5 text-[15px] font-bold text-reversed disabled:opacity-40"
        >
          {busy ? "…" : "Apply"}
        </button>
      </div>
      {error && <p className="mt-1.5 text-[13px] font-semibold text-error">{error}</p>}
    </div>
  );
}

type Answer =
  | { ok: true; code: string; discountPaise: number; description: string | null }
  | { ok: false; reason: string };

async function ask(code: string, subtotalPaise: number, phone: string): Promise<Answer> {
  try {
    const res = await fetch("/api/coupon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, subtotalPaise, phone: /^[6-9]\d{9}$/.test(phone) ? phone : "" }),
    });
    return (await res.json()) as Answer;
  } catch {
    return { ok: false, reason: "Couldn't check that code. Try again." };
  }
}

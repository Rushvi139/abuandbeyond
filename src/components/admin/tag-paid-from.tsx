"use client";

import { useState, useTransition } from "react";
import { tagPaidFrom } from "@/lib/admin/money-actions";
import { PAID_FROM, PAID_FROM_MODE } from "@/lib/admin/paid-from";

/** Three buttons on an untagged entry: tap the account it was paid from. */
export function TagPaidFrom({ kind, id }: { kind: "expense" | "payment"; id: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="flex flex-wrap items-center gap-1">
      {PAID_FROM.map((f) => (
        <button
          key={f}
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setErr(null);
              const r = await tagPaidFrom({ kind, id, from: f });
              if (r.error) setErr(r.error);
            })
          }
          className="h-7 rounded-lg border-[1.5px] border-ink px-2 text-[11px] font-bold disabled:opacity-40"
        >
          {PAID_FROM_MODE[f]}
        </button>
      ))}
      {err && <span role="alert" className="text-[11px] font-semibold text-error">{err}</span>}
    </span>
  );
}

"use client";

import { useTransition, useState } from "react";
import { setUpiId } from "@/lib/orders/override-actions";

export function UpiSetting({ current }: { current: string }) {
  const [value, setValue] = useState(current);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      await setUpiId(value.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-semibold text-muted whitespace-nowrap">UPI ID</label>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="yourname@upi"
        className="h-9 rounded-xl border border-line bg-surface px-3 text-sm font-mono w-48"
      />
      <button
        type="button"
        onClick={save}
        disabled={pending || value.trim() === current}
        className="h-9 rounded-xl bg-ink px-3 text-sm font-semibold text-reversed disabled:opacity-40"
      >
        {saved ? "Saved ✓" : "Save"}
      </button>
    </div>
  );
}

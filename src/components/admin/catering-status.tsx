"use client";

import { setCateringStatus } from "@/lib/admin/catering-actions";

const STEPS = [
  { id: "new", label: "New" },
  { id: "quoted", label: "Quoted" },
  { id: "confirmed", label: "Confirmed" },
  { id: "closed", label: "Closed" },
];

export function CateringStatus({ id, status }: { id: string; status: string }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {STEPS.map((s) => (
        <form key={s.id} action={setCateringStatus.bind(null, id, s.id)}>
          <button
            className={`h-9 rounded-full border-[1.5px] px-3.5 text-[13px] font-semibold ${status === s.id ? "border-ink bg-ink text-reversed" : "border-line text-ink"}`}
            aria-pressed={status === s.id}
          >
            {s.label}
          </button>
        </form>
      ))}
    </div>
  );
}

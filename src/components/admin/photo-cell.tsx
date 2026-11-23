"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { addExpensePhotos } from "@/lib/admin/photo-actions";

/**
 * The photos on one expense: each opens full size, and "+ photo" adds more
 * from the phone's camera or gallery, even long after the spend was entered.
 */
export function PhotoCell({ expenseId, photos, canEdit }: { expenseId: string; photos: string[]; canEdit: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  return (
    <span className="flex flex-wrap items-center justify-end gap-1">
      {photos.map((p, i) => (
        <a
          key={p}
          href={`/files/${p}`}
          target="_blank"
          rel="noreferrer"
          title={`Photo ${i + 1}`}
          className="flex h-7 min-w-7 items-center justify-center rounded-md bg-paper px-1.5 text-[11px] font-bold text-hill ring-1 ring-inset ring-hill/20 hover:bg-hill hover:text-reversed"
        >
          {photos.length === 1 ? "slip" : i + 1}
        </a>
      ))}
      {canEdit && (
        <>
          <input
            ref={ref}
            type="file"
            multiple
            accept="image/*,application/pdf"
            className="sr-only"
            aria-label="Add photos to this expense"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (!files.length) return;
              const fd = new FormData();
              fd.set("expenseId", expenseId);
              for (const f of files) fd.append("photos", f);
              start(async () => {
                setErr(null);
                const r = await addExpensePhotos(fd).catch(() => ({ error: "Didn't upload. Try again." }));
                if (r.error) setErr(r.error);
                else router.refresh();
                if (ref.current) ref.current.value = "";
              });
            }}
          />
          <button type="button" onClick={() => ref.current?.click()} disabled={pending} className="h-7 rounded-md border border-dashed border-line px-1.5 text-[11px] font-semibold text-muted hover:border-ink hover:text-ink">
            {pending ? "…" : "+ photo"}
          </button>
        </>
      )}
      {err && <span role="alert" className="w-full text-right text-[11px] font-semibold text-error">{err}</span>}
    </span>
  );
}

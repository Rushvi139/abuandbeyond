"use client";

import { useState, useTransition } from "react";
import { importStays, type ImportResult } from "@/lib/admin/stays";

/**
 * The sweep CSV is read in the browser and sent as text, so there is no file
 * upload path to secure and nothing lands on disk. A few hundred rows is a
 * handful of kilobytes.
 */
export function StayImport() {
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setResult(null);
    setError(null);
    if (file.size > 4_000_000) return setError("That file is over 4 MB — too big for a stay list. Check you picked the right one.");
    file
      .text()
      .then((text) => start(async () => {
        try {
          setResult(await importStays(text, file.name));
        } catch {
          setError("The import failed partway and nothing was saved. Try again, or send me the file.");
        }
      }))
      .catch(() => setError("Couldn't read that file."));
  }

  return (
    <div className="rounded-2xl bg-surface p-4">
      <h2 className="font-display text-[20px] uppercase">Load the sweep</h2>
      <p className="mt-1 text-sm text-muted">
        Pick <code className="text-hill">mount_abu_all_stays.csv</code>. Re-running the sweep updates what&apos;s here rather than
        duplicating it — your notes and QR links are kept.
      </p>
      <label className="mt-3 flex h-12 cursor-pointer items-center justify-center rounded-xl bg-ink px-4 text-sm font-bold text-reversed has-[:disabled]:opacity-60">
        <input type="file" accept=".csv,text/csv" onChange={onPick} disabled={pending} className="hidden" />
        {pending ? "Loading…" : "Choose CSV"}
      </label>

      {error && <p className="mt-3 rounded-xl bg-error/10 p-3 text-sm font-medium text-error">{error}</p>}
      {result && (
        <div className="mt-3 rounded-xl bg-paper p-3 text-sm">
          <p>
            <b>{result.rowsInFile}</b> rows read · <b>{result.inserted}</b> new · <b>{result.updated}</b> updated
            {result.skipped > 0 && (
              <>
                {" "}
                · <b className="text-error">{result.skipped}</b> skipped
              </>
            )}
          </p>
          {result.problems.length > 0 && (
            <ul className="mt-2 flex flex-col gap-0.5 text-[13px] text-muted">
              {result.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

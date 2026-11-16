import Link from "next/link";
import { PRESETS, rangeLabel, type Range } from "@/lib/date-range";

/**
 * The one date control on every back-office list: quick presets, or any from–to.
 * A plain GET form, so the range lives in the URL and a link can be shared.
 * `keep` carries the page's other filters through a change of dates.
 */
export function DateRangeBar({ path, range, keep = {} }: { path: string; range: Range; keep?: Record<string, string | undefined> }) {
  const extra = Object.entries(keep).filter(([, v]) => v) as [string, string][];
  const href = (q: Record<string, string>) => `${path}?${new URLSearchParams([...extra, ...Object.entries(q)])}`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <Link
            key={p.key}
            href={href({ range: p.key })}
            className={`h-9 rounded-lg px-2.5 text-[13px] font-semibold leading-9 ${range.preset === p.key ? "bg-ink text-reversed" : "bg-surface hover:bg-line"}`}
          >
            {p.label}
          </Link>
        ))}
      </div>
      <form action={path} className="flex items-center gap-1">
        {extra.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <input type="date" name="from" defaultValue={range.from} aria-label="From" className="h-9 rounded-lg border border-line bg-paper px-2 text-[13px]" />
        <span className="text-muted">–</span>
        <input type="date" name="to" defaultValue={range.to} aria-label="To" className="h-9 rounded-lg border border-line bg-paper px-2 text-[13px]" />
        <button type="submit" className="h-9 rounded-lg bg-ink px-3 text-[13px] font-semibold text-reversed">Show</button>
      </form>
      <span className="text-[13px] text-muted">{rangeLabel(range)}</span>
    </div>
  );
}

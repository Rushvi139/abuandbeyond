import { DaybookUpload, DeletePage } from "@/components/admin/daybook-upload";
import { BOOKKEEPERS, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Daily book — Abu & Beyond" };

type Page = { id: string; day: string; file: string; note: string | null; by: string | null; at: string };

const longDay = (s: string) => new Date(`${s}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

/**
 * The handwritten daily book, photographed: one or more pictures per day,
 * filed by date, so the paper book and the app can be checked side by side.
 */
export default async function DaybookPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const staff = await requireRole(BOOKKEEPERS, "/admin/accounts/daybook");
  const sp = await searchParams;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const monthAgo = (() => { const d = new Date(`${today}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 30); return d.toISOString().slice(0, 10); })();
  const from = isDate(sp.from) ? sp.from! : monthAgo;
  const to = isDate(sp.to) ? sp.to! : today;

  const pages = await db()<Page[]>`
    select p.id, p.day::text as day, p.file_path as file, p.note, u.full_name as by, p.created_at::text as at
    from daybook_pages p left join staff_users u on u.id = p.created_by
    where p.day >= ${from}::date and p.day <= ${to}::date
    order by p.day desc, p.created_at`;
  const days = [...new Set(pages.map((p) => p.day))];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-[32px] uppercase leading-none">Daily book</h1>
        <p className="mt-1 text-sm text-muted">Photos of the handwritten book, one or more per day. Take them on the phone at closing.</p>
      </div>

      <DaybookUpload />

      <form className="flex flex-wrap items-end gap-2 text-sm">
        <label className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wide text-muted">From<input type="date" name="from" defaultValue={from} className="h-10 rounded-xl border-[1.5px] border-line bg-paper px-2.5 text-sm normal-case" /></label>
        <label className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wide text-muted">To<input type="date" name="to" defaultValue={to} className="h-10 rounded-xl border-[1.5px] border-line bg-paper px-2.5 text-sm normal-case" /></label>
        <button type="submit" className="h-10 rounded-xl bg-ink px-4 font-semibold text-reversed">Show</button>
      </form>

      {days.length === 0 ? (
        <p className="rounded-2xl bg-surface p-5 text-sm text-muted">No book photos for these dates yet. Upload today&apos;s page above.</p>
      ) : (
        days.map((d) => (
          <section key={d} className="rounded-2xl bg-surface p-4">
            <h2 className="mb-3 font-display text-[20px] uppercase leading-none">{longDay(d)}</h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {pages.filter((p) => p.day === d).map((p) => (
                <li key={p.id} className="flex flex-col gap-1">
                  <a href={`/files/${p.file}`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-line bg-paper">
                    {p.file.endsWith(".pdf") ? (
                      <span className="flex aspect-[3/4] items-center justify-center text-sm font-bold">PDF</span>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/files/${p.file}`} alt={`Book page for ${longDay(d)}`} loading="lazy" className="aspect-[3/4] w-full object-cover" />
                    )}
                  </a>
                  <div className="flex items-start justify-between gap-2 text-[11px] text-muted">
                    <span>{p.note ? <b className="text-ink">{p.note}</b> : null}{p.note ? " · " : ""}{p.by ?? "—"}</span>
                    {staff.role === "owner" && <DeletePage id={p.id} />}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

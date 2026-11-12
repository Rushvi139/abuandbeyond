import { StayImport } from "@/components/admin/stay-import";
import { StayFinder, type StayRow } from "@/components/admin/stay-finder";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminStaysPage() {
  const staff = await requireRole(["owner", "manager"], "/admin/stays");
  const sql = db();
  const [stays, zones, imports] = await Promise.all([
    sql<StayRow[]>`
      select s.id, s.name, s.zone, s.km_from_kitchen::float as km, s.lat, s.lng, s.phone, s.address, s.note,
        (s.property_id is not null) as partner, (s.source = 'guest') as "fromGuest"
      from stays s where s.active order by s.km_from_kitchen nulls last, s.name`,
    sql<{ zone: string | null; n: number; pinned: number }[]>`
      select zone, count(*)::int as n, count(lat)::int as pinned from stays where active group by zone order by count(*) desc`,
    sql<{ fileName: string | null; rowsInFile: number; inserted: number; updated: number; skipped: number; when: string; by: string | null }[]>`
      select i.file_name as "fileName", i.rows_in_file as "rowsInFile", i.inserted, i.updated, i.skipped,
        to_char(i.created_at at time zone 'Asia/Kolkata', 'DD Mon, HH24:MI') as "when", u.full_name as by
      from stay_imports i left join staff_users u on u.id = i.actor_id order by i.created_at desc limit 5`,
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-[32px] uppercase">Stays</h1>
        <p className="text-sm text-muted">
          Every hotel, villa and homestay on the plateau — what riders search when a guest gives a name instead of an address.
          Separate from Properties, which is the handful we put QR codes in.
        </p>
        {stays.some((x) => x.fromGuest) && (
          <p className="mt-2 rounded-xl bg-acid/30 px-3 py-2 text-sm">
            <b>{stays.filter((x) => x.fromGuest).length} added by guests</b> at checkout (marked &ldquo;From a guest&rdquo;). They show in
            suggestions straight away — check the spelling, and delete any that aren&apos;t real places.
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-1">
          <StayImport />
          {zones.length > 0 && (
            <div className="rounded-2xl bg-surface p-4">
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">By zone</h2>
              <ul className="flex flex-col gap-1 text-sm">
                {zones.map((z) => (
                  <li key={z.zone ?? "none"} className="flex justify-between gap-2">
                    <span>{z.zone ?? "Unzoned"}</span>
                    <span className="text-muted">
                      {z.n} · {z.pinned} pinned
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {imports.length > 0 && (
            <div className="rounded-2xl bg-surface p-4">
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Recent loads</h2>
              <ul className="flex flex-col gap-2 text-[13px]">
                {imports.map((i, n) => (
                  <li key={n}>
                    <b>{i.when}</b> — {i.inserted} new, {i.updated} updated
                    {i.skipped > 0 && `, ${i.skipped} skipped`}
                    <span className="block text-muted">
                      {i.fileName} {i.by && `· ${i.by}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          {stays.length === 0 ? (
            <p className="rounded-2xl bg-surface p-6 text-center text-muted">
              Nothing loaded yet. Run the Mount Abu sweep and pick the CSV on the left.
            </p>
          ) : (
            <>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                {stays.length} stays — this is what the rider sees
              </h2>
              <StayFinder stays={stays} canDelete={staff.role === "owner"} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

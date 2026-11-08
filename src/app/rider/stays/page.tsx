import Link from "next/link";
import { StayFinder, type StayRow } from "@/components/admin/stay-finder";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Find a stay — Abu & Beyond" };

export default async function RiderStaysPage() {
  await requireRole(["owner", "manager", "rider"], "/rider/stays");
  const stays = await db()<StayRow[]>`
    select s.id, s.name, s.zone, s.km_from_kitchen::float as km, s.lat, s.lng, s.phone, s.address, s.note,
      (s.property_id is not null) as partner
    from stays s
    where s.active
    order by s.km_from_kitchen nulls last, s.name`;

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-paper p-4">
      <header className="mb-4 flex items-center gap-3">
        <Link href="/rider" className="h-10 rounded-xl border-[1.5px] border-ink px-3 text-sm font-semibold leading-10">
          Back
        </Link>
        <h1 className="font-display text-[26px] uppercase">Find a stay</h1>
      </header>
      {stays.length === 0 ? (
        <p className="rounded-2xl bg-surface p-6 text-center text-muted">
          The stay directory is empty. An owner loads it from Admin → Stays.
        </p>
      ) : (
        <>
          <p className="mb-3 text-[13px] text-muted">
            {stays.length} places on the plateau, nearest first. Distance is from the kitchen, as the crow flies.
          </p>
          <StayFinder stays={stays} />
        </>
      )}
    </div>
  );
}

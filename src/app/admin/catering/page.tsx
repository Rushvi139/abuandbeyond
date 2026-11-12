import { CateringEdit } from "@/components/admin/catering-edit";
import { CateringStatus } from "@/components/admin/catering-status";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  name: string;
  phone: string;
  occasion: string | null;
  guests: number | null;
  eventOn: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
};

const d = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }) : "—");

export default async function CateringPage() {
  await requireRole(["owner", "manager"], "/admin/catering");
  const rows = await db()<Row[]>`
    select id, name, phone, occasion, guests, event_on as "eventOn", notes, status, created_at as "createdAt"
    from catering_enquiries order by (status = 'new') desc, coalesce(event_on, created_at::date) asc limit 100`;
  const open = rows.filter((r) => r.status === "new").length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-[32px] uppercase">Catering</h1>
        <p className="text-sm text-muted">{rows.length} enquiries · <span className={open ? "font-semibold text-clay" : ""}>{open} waiting for a call</span></p>
      </div>

      <div className="flex flex-col gap-3">
        {rows.map((r) => (
          <article key={r.id} className={`rounded-2xl bg-surface p-4 ${r.status === "new" ? "border border-clay" : ""}`}>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-semibold">{r.name}</span>
              <a href={`tel:${r.phone}`} className="text-sm text-hill">{r.phone}</a>
              <a href={`https://wa.me/${r.phone.replace("+", "")}`} target="_blank" rel="noreferrer" className="text-sm font-semibold text-hill underline-offset-2 hover:underline">WhatsApp</a>
              <span className="ml-auto text-xs uppercase tracking-wide text-muted">asked {d(r.createdAt)}</span>
            </div>
            <p className="mt-1.5 text-sm">
              {[r.occasion, r.guests ? `${r.guests} people` : null, r.eventOn ? `on ${d(r.eventOn)}` : null].filter(Boolean).join(" · ") || "No details given"}
            </p>
            {r.notes && <p className="mt-1.5 text-sm text-muted">{r.notes}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <CateringEdit id={r.id} name={r.name} phone={r.phone} occasion={r.occasion} guests={r.guests} eventOn={r.eventOn} notes={r.notes} />
            </div>
            <CateringStatus id={r.id} status={r.status} />
          </article>
        ))}
        {rows.length === 0 && <p className="rounded-2xl bg-surface p-6 text-center text-muted">No catering enquiries yet.</p>}
      </div>
    </div>
  );
}

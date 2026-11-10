import { notFound } from "next/navigation";
import { PrintOnLoad } from "@/components/kitchen/print-on-load";
import { requireRole } from "@/lib/auth";
import { getOrderById } from "@/lib/orders/queries";

export const dynamic = "force-dynamic";

const time = (s: string) => new Date(s).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const date = (s: string) => new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

/**
 * One kitchen ticket, sized for an 80 mm thermal roll. No prices: the kitchen
 * cooks, it does not take money. Everything here is what someone at the pass
 * needs at arm's length — big order number, big item names, notes impossible
 * to miss.
 */
export default async function KotPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ auto?: string }>;
}) {
  await requireRole(["owner", "manager", "kitchen"], "/kitchen");
  const { id } = await params;
  const { auto } = await searchParams;
  const o = await getOrderById(id);
  if (!o) notFound();

  const where = [o.propertyName, o.roomOrLandmark].filter(Boolean).join(", ");
  const reprint = o.kotPrintedAt != null;

  return (
    <div className="kot">
      {auto === "1" && <PrintOnLoad />}

      <header>
        <div className="row">
          <span className="big">#{o.number}</span>
          <span className="right">
            {time(o.createdAt)}
            <br />
            {date(o.createdAt)}
          </span>
        </div>
        <div className="muted">
          {o.stayType.toUpperCase()}
          {o.isDemo && " · DEMO"}
          {reprint && " · REPRINT"}
        </div>
        {where && <div className="where">{where}</div>}
      </header>

      <hr />

      <ul className="items">
        {o.lines.map((l) => (
          <li key={l.id}>
            <div className="row">
              <span className="qty">{l.qty}×</span>
              <span className="name">
                <span className={l.isVeg ? "veg" : "nonveg"} aria-hidden="true">
                  {l.isVeg ? "●" : "▲"}
                </span>{" "}
                {l.name}
              </span>
            </div>
            {l.options.length > 0 && <div className="sub">{l.options.join(" · ")}</div>}
            {l.addons.length > 0 && <div className="sub">+ {l.addons.join(", ")}</div>}
            {l.note && <div className="note">! {l.note}</div>}
          </li>
        ))}
      </ul>

      {(o.notes || o.kitchenNote) && (
        <>
          <hr />
          {o.kitchenNote && <div className="note big-note">!! {o.kitchenNote}</div>}
          {o.notes && <div className="note">Customer: {o.notes}</div>}
        </>
      )}

      <hr />
      <footer>
        <div className="row">
          <span>{o.lines.reduce((n, l) => n + l.qty, 0)} items</span>
          <span className="right">{o.customer.name ?? ""}</span>
        </div>
        <div className="muted">Abu &amp; Beyond · {o.code.toUpperCase()}</div>
      </footer>

      {/* Deliberately plain CSS rather than Tailwind: this page is handed to a
          thermal printer, where millimetres and monospace matter more than the
          design system. */}
      <style>{`
        /* auto height, so the roll is cut after the last line instead of
           feeding a full page of blank paper. */
        @page { size: 80mm auto; margin: 3mm; }
        html, body { margin: 0; padding: 0; height: auto; background: #fff; }
        /* Browsers drop backgrounds and shading when printing unless told
           otherwise, which is what turns a boxed note into plain text. */
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .kot {
          width: 74mm; margin: 0 auto; padding: 2mm 0;
          font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
          color: #000; font-size: 12px; line-height: 1.35;
        }
        .row { display: flex; align-items: flex-start; gap: 6px; }
        .right { margin-left: auto; text-align: right; }
        .big { font-size: 30px; font-weight: 700; line-height: 1; }
        .muted { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
        .where { margin-top: 2px; font-size: 14px; font-weight: 700; }
        hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
        .items { list-style: none; margin: 0; padding: 0; }
        .items li { margin-bottom: 7px; page-break-inside: avoid; break-inside: avoid; }
        .qty { font-size: 17px; font-weight: 700; min-width: 30px; }
        .name { font-size: 17px; font-weight: 700; }
        .veg { color: #000; }
        .nonveg { color: #000; }
        .sub { margin-left: 36px; font-size: 12px; }
        .note {
          margin-top: 2px; margin-left: 36px; padding: 2px 4px;
          font-weight: 700; border: 1px solid #000;
          page-break-inside: avoid; break-inside: avoid;
        }
        .big-note { margin-left: 0; font-size: 14px; }
        footer .muted { margin-top: 3px; }
        @media screen {
          html, body { background: #e9e5dd; }
          .kot { margin: 16px auto; padding: 10mm 6mm; background: #fff; box-shadow: 0 2px 14px rgba(0,0,0,.18); }
        }
      `}</style>
    </div>
  );
}

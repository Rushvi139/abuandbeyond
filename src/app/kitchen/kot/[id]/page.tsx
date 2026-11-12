import { notFound } from "next/navigation";
import { PrintOnLoad } from "@/components/kitchen/print-on-load";
import { requireRole } from "@/lib/auth";
import { clockLabel } from "@/lib/hours";
import { getOrderById, type OrderLine } from "@/lib/orders/queries";
import { printable as p } from "@/lib/text";

export const dynamic = "force-dynamic";

const time = (s: string) => clockLabel(new Date(s));
const date = (s: string) => new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

const RULE = "--------------------------------";
const DOUBLE = "================================";

/**
 * One kitchen ticket for the thermal roll. No prices: the kitchen cooks, it
 * does not take money.
 *
 * Built for the worst printer, not the best one. The kitchen's printer
 * prints the page as plain text: it ignores font sizes, pulls anything
 * floated to the right up to the top, and turns "×", "●" and "·" into "#?"
 * and "π". So every fact is its own line, in the order a cook reads it,
 * using only plain keyboard characters (`printable`). The CSS still makes it
 * bigger and bolder on a printer that honours it, but nothing depends on it.
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

  const where = p([o.propertyName, o.roomOrLandmark].filter(Boolean).join(", "));
  const reprint = o.kotPrintedAt != null;
  const count = o.lines.reduce((n, l) => n + l.qty, 0);

  // Grouped under their category, in menu order of first appearance, so
  // "Paneer" is never on its own — it is under ROLLS or BOWLS.
  const groups: { category: string; lines: OrderLine[] }[] = [];
  for (const l of o.lines) {
    const c = p(l.category).toUpperCase() || "OTHER";
    const g = groups.find((x) => x.category === c);
    if (g) g.lines.push(l);
    else groups.push({ category: c, lines: [l] });
  }

  return (
    <div className="kot">
      {auto === "1" && <PrintOnLoad />}

      <div>{DOUBLE}</div>
      <div className="big">ORDER #{o.number}</div>
      <div>
        {date(o.createdAt)} {time(o.createdAt)}
        {reprint ? " - REPRINT" : ""}
      </div>
      <div>{RULE}</div>

      {o.scheduledFor && <div className="alert">** DELIVER AT {clockLabel(new Date(o.scheduledFor))} **</div>}
      {o.paymentMode === "on_delivery" && !o.collectedAt && (
        <div className="alert">** COLLECT Rs {(o.totalPaise / 100).toLocaleString("en-IN")} - NOT PAID **</div>
      )}
      <div>{o.stayType.toUpperCase()}</div>
      {where && <div className="where">{where}</div>}
      {o.customer.name && <div>Guest: {p(o.customer.name)}</div>}
      <div>{RULE}</div>

      {groups.map((g) => (
        <div key={g.category} className="group">
          <div className="cat">[ {g.category} ]</div>
          {g.lines.map((l) => (
            <div key={l.id} className="item">
              <div className="name">
                {l.qty} x {p(l.name)} {l.isVeg ? "(VEG)" : "(NON-VEG)"}
              </div>
              {l.options.map((x, i) => (
                <div key={`o${i}`} className="sub">
                  - {p(x)}
                </div>
              ))}
              {l.addons.map((x, i) => (
                <div key={`a${i}`} className="sub">
                  + {p(x)}
                </div>
              ))}
              {l.note && <div className="note">! NOTE: {p(l.note)}</div>}
            </div>
          ))}
        </div>
      ))}

      {(o.notes || o.kitchenNote) && <div>{RULE}</div>}
      {o.kitchenNote && <div className="note">!! KITCHEN: {p(o.kitchenNote)}</div>}
      {o.notes && <div className="note">! DELIVERY: {p(o.notes)}</div>}

      <div>{RULE}</div>
      <div>
        {count} item{count === 1 ? "" : "s"}
      </div>
      <div>ABU &amp; BEYOND - REF {o.code.toUpperCase()}</div>
      <div>{DOUBLE}</div>

      {/* Plain CSS, not Tailwind: this goes to a thermal printer. Only block
          elements, no flex, no floats — the printer's text mode reorders them. */}
      <style>{`
        @page { size: 80mm auto; margin: 3mm; }
        html, body { margin: 0; padding: 0; height: auto; background: #fff; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .kot {
          width: 74mm; margin: 0 auto; padding: 2mm 0;
          font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
          color: #000; font-size: 13px; line-height: 1.4; white-space: pre-wrap; word-break: break-word;
        }
        .kot > div, .kot .group > div, .kot .item > div { display: block; }
        .big { font-size: 28px; font-weight: 700; line-height: 1.15; }
        .alert { font-size: 15px; font-weight: 700; }
        .where { font-size: 15px; font-weight: 700; }
        .group { margin-top: 4px; }
        .cat { font-weight: 700; }
        .item { margin: 2px 0 5px; }
        .name { font-size: 17px; font-weight: 700; }
        .sub { padding-left: 4ch; }
        .note { font-weight: 700; }
        .item .note { padding-left: 4ch; }
        @media screen {
          html, body { background: #e9e5dd; }
          .kot { margin: 16px auto; padding: 10mm 6mm; background: #fff; box-shadow: 0 2px 14px rgba(0,0,0,.18); }
        }
      `}</style>
    </div>
  );
}

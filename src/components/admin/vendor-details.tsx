"use client";

import { Cell } from "@/components/admin/editable-cell";
import { updateVendorCell } from "@/lib/admin/register-actions";

export type VendorDetails = {
  id: string;
  name: string;
  category: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  paymentTermsDays: number | null;
  notes: string | null;
};

const FIELDS: { key: keyof VendorDetails; column: string; label: string; placeholder: string }[] = [
  { key: "category", column: "category", label: "Trade", placeholder: "vegetables, dairy, gas…" },
  { key: "contactPerson", column: "contact_person", label: "Who to ask for", placeholder: "their name" },
  { key: "phone", column: "phone", label: "Phone", placeholder: "+91…" },
  { key: "email", column: "email", label: "Email", placeholder: "name@…" },
  { key: "gstin", column: "gstin", label: "GSTIN", placeholder: "15 characters" },
  { key: "paymentTermsDays", column: "payment_terms_days", label: "Terms (days)", placeholder: "e.g. 15" },
];

/** Everything about a vendor is editable here, which is also the only place a
 *  vendor created by typing a name into a register gets filled in properly. */
export function VendorDetailsCard({ vendor, canEdit }: { vendor: VendorDetails; canEdit: boolean }) {
  return (
    <div>
      <h1 className="font-display text-[32px] uppercase">
        <Cell value={vendor.name} readOnly={!canEdit} save={(v) => updateVendorCell(vendor.id, "name", v)} />
      </h1>

      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 rounded-2xl bg-surface p-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
        {FIELDS.map((f) => (
          <div key={f.key} className="min-w-0">
            <dt className="text-[10px] uppercase tracking-wide text-muted">{f.label}</dt>
            <dd>
              <Cell
                value={vendor[f.key] == null ? "" : String(vendor[f.key])}
                placeholder={f.placeholder}
                readOnly={!canEdit}
                save={(v) => updateVendorCell(vendor.id, f.column, v)}
              />
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-2 rounded-2xl bg-surface p-3 text-sm">
        <span className="text-[10px] uppercase tracking-wide text-muted">Notes</span>
        <Cell
          value={vendor.notes ?? ""}
          placeholder="Delivery days, minimum order, who to call when they're late…"
          readOnly={!canEdit}
          save={(v) => updateVendorCell(vendor.id, "notes", v)}
        />
      </div>
    </div>
  );
}

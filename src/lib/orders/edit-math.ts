/**
 * The arithmetic of editing an order, kept apart from the database so it can
 * be tested: new totals, what changed (for the log and the kitchen), and what
 * is owed either way once money has already been taken.
 */

export type EditLine = {
  /** order_items.id for a line already on the order; absent for a new one. */
  orderItemId?: string | null;
  itemId: string;
  name: string;
  qty: number;
  /** Price of one, options and add-ons included, in paise. */
  unitPaise: number;
  optionNames: string[];
  addonNames: string[];
  note?: string | null;
};

export type Totals = { subtotalPaise: number; discountPaise: number; gstPaise: number; totalPaise: number };

/**
 * The discount stays what it was (a coupon was checked when the order was
 * placed) but never exceeds the new subtotal. A complimentary order stays
 * free: its discount is the whole subtotal.
 */
export function editTotals(
  lines: Pick<EditLine, "qty" | "unitPaise">[],
  o: { discountPaise: number; complimentary: boolean; deliveryFeePaise: number },
  gstOn: (netPaise: number) => number,
): Totals {
  const subtotalPaise = lines.reduce((n, l) => n + l.unitPaise * l.qty, 0);
  const discountPaise = o.complimentary ? subtotalPaise : Math.min(Math.max(0, o.discountPaise), subtotalPaise);
  const gstPaise = gstOn(subtotalPaise - discountPaise);
  const deliveryFeePaise = o.complimentary ? 0 : o.deliveryFeePaise;
  return { subtotalPaise, discountPaise, gstPaise, totalPaise: subtotalPaise - discountPaise + gstPaise + deliveryFeePaise };
}

const describe = (l: EditLine) => [l.name, ...l.optionNames, ...l.addonNames.map((a) => "+" + a)].join(" ");

/**
 * "Butter Chicken qty 1 to 2; ADD 1 Tawa Roti; REMOVE 1 Jeera Rice" — for the
 * log and the KOT. Plain words, because the thermal printer drops arrows and
 * minus signs.
 */
export function editSummary(before: EditLine[], after: EditLine[]): string {
  const parts: string[] = [];
  const kept = new Set<string>();
  for (const a of after) {
    const b = a.orderItemId ? before.find((x) => x.orderItemId === a.orderItemId) : undefined;
    if (!b) {
      parts.push(`ADD ${a.qty} ${describe(a)}`);
      continue;
    }
    kept.add(b.orderItemId!);
    if (describe(a) !== describe(b)) parts.push(`${b.name} NOW ${describe(a)}`);
    if (a.qty !== b.qty) parts.push(`${a.name} qty ${b.qty} to ${a.qty}`);
  }
  for (const b of before) if (b.orderItemId && !kept.has(b.orderItemId)) parts.push(`REMOVE ${b.qty} ${describe(b)}`);
  return parts.join("; ") || "No change";
}

/**
 * Once money has been taken (paid online, or cash collected), the order's new
 * total is compared with what we actually hold: positive means collect the
 * difference at the door, negative means the guest is owed a refund. Before
 * any money is taken there is nothing to balance — the total simply changes.
 */
export function balanceAfterEdit(newTotalPaise: number, heldPaise: number, moneyTaken: boolean): number {
  return moneyTaken ? newTotalPaise - heldPaise : 0;
}

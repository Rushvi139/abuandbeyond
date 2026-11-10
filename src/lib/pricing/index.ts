import { LEGAL } from "@/lib/legal";

// Money is integer paise everywhere. Menu prices are what the customer pays.
export const GST_PCT = 5;

/**
 * GST is collected only by a registered business, so the switch is the GSTIN
 * itself rather than a separate flag somebody could set by mistake. No GSTIN,
 * no tax line — which is the law, not a preference: collecting "GST" without
 * being registered is not allowed.
 *
 * Fill in LEGAL.gstin and every price picks the tax back up, on new orders
 * only. Orders already placed keep whatever gst_paise they were charged, so
 * past invoices stay true to what the customer actually paid.
 */
export const gstRegistered = () => Boolean(LEGAL.gstin);

/** The 5% itself, whether or not we may charge it. For projections. */
export function gstAt(netPaise: number): number {
  return Math.round((netPaise * GST_PCT) / 100);
}

/** What goes on this order's tax line — zero until we are registered. */
export function gstOn(netPaise: number): number {
  return gstRegistered() ? gstAt(netPaise) : 0;
}

export function formatINR(paise: number, opts: { decimals?: boolean } = {}): string {
  const rupees = paise / 100;
  const whole = Number.isInteger(rupees) && !opts.decimals;
  return "₹" + rupees.toLocaleString("en-IN", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 });
}

/** One sentence for the menu and the policy pages, true either way. */
export const taxLine = () =>
  gstRegistered() ? `Prices before ${GST_PCT}% GST` : "All taxes included";

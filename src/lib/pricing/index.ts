// Money is integer paise everywhere. Prices are stored before GST.
export const GST_PCT = 5;

export function formatINR(paise: number, opts: { decimals?: boolean } = {}): string {
  const rupees = paise / 100;
  const whole = Number.isInteger(rupees) && !opts.decimals;
  return "₹" + rupees.toLocaleString("en-IN", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 });
}

export function gstOn(netPaise: number): number {
  return Math.round((netPaise * GST_PCT) / 100);
}

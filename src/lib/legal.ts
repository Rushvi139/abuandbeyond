/**
 * Who, legally, is behind Abu & Beyond.
 *
 * Deliberately code and not a `settings` row: the payment gateway, the GST
 * authority and the FSSAI all expect these to match the registration exactly,
 * and that is not something to leave editable from a back-office form at
 * 11pm. Changing it should be a commit somebody reviews.
 *
 * Two different contacts live here and must not be merged:
 *   - `support` is what a hungry guest taps. Answered during serving hours.
 *   - `operator` is the registered identity: who the gateway settles to, who
 *     a legal notice goes to, what a chargeback is raised against.
 */
export const LEGAL = {
  /** The brand customers know. */
  tradeName: "Abu & Beyond",

  /** A sole proprietorship: the firm and the proprietor are the same legal
   *  person, which is why the registered name below is a person's name and
   *  not a company's. */
  entityType: "sole proprietorship",

  operator: {
    /** Exactly as registered — this must match the Cashfree account,
     *  character for character, or activation is rejected. */
    name: "Rushvi Pravinsinh Khambhu",
    /** What to call them on the page. */
    title: "Proprietor",
    email: "rushvikhambhu@gmail.com",
    phone: "+919099720300",
    phoneDisplay: "+91 90997 20300",
  },

  /** The number on the Support page's call and WhatsApp buttons. */
  support: {
    phone: "+918628910887",
    phoneDisplay: "+91 86289 10887",
  },

  city: "Mount Abu",
  state: "Rajasthan",
  country: "India",
  jurisdiction: "the courts of Sirohi district, Rajasthan",

  /**
   * Still missing, and each is a legal requirement rather than a nicety:
   *   - `address`: a full postal address, which the gateway's policy review
   *     and the Contact Us page both expect.
   *   - `fssai`: a food business must display its FSSAI licence number on the
   *     website as well as on packaging.
   *   - `gstin`: we charge 5% GST on every order, so the number we collect it
   *     under belongs on the site and on the invoice.
   * Fill these in and they appear everywhere automatically. Until then the
   * pages simply leave them out rather than printing a placeholder.
   */
  address: null as string | null,
  fssai: null as string | null,
  gstin: null as string | null,
} as const;

/**
 * "Abu & Beyond is a sole proprietorship owned and operated by Rushvi
 *  Pravinsinh Khambhu, Mount Abu, Rajasthan, India."
 */
export function operatedByLine() {
  const where = [LEGAL.address, LEGAL.city, LEGAL.state, LEGAL.country].filter(Boolean).join(", ");
  return `${LEGAL.tradeName} is a ${LEGAL.entityType} owned and operated by ${LEGAL.operator.name}, ${where}.`;
}

/** The registration numbers we actually hold, as "LABEL NUMBER" strings. */
export function registrations() {
  return [
    LEGAL.fssai && `FSSAI licence ${LEGAL.fssai}`,
    LEGAL.gstin && `GSTIN ${LEGAL.gstin}`,
  ].filter((s): s is string => Boolean(s));
}

import "server-only";
import { db } from "@/lib/db";

/**
 * The three places a guest can reach us or vouch for us.
 *
 * A `settings` row rather than code, because unlike the legal identity these
 * are changed by whoever runs the account, not by a commit. Everything comes
 * back as a ready-to-use URL: an Instagram handle is stored bare, and three
 * separate pages were each rebuilding the link from it.
 */
export type Social = {
  instagram: string | null;
  instagramHandle: string | null;
  googleReview: string | null;
  whatsapp: string | null;
  whatsappDisplay: string | null;
  email: string | null;
};

type Row = { instagram?: string | null; google_review?: string | null; whatsapp?: string | null; email?: string | null };

export async function socialLinks(): Promise<Social> {
  let v: Row = {};
  try {
    const [row] = await db()<{ value: Row }[]>`select value from settings where key = 'social_links'`;
    v = row?.value ?? {};
  } catch {
    /* the page still renders without its socials */
  }

  // Stored as a bare handle, pasted as a full URL, or with a stray @ — all
  // three happen, and the guest should not meet a broken link because of it.
  const handle = v.instagram?.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/$/, "") || null;
  const digits = v.whatsapp?.replace(/\D/g, "") || null;

  return {
    instagram: handle ? `https://instagram.com/${handle}` : null,
    instagramHandle: handle ? `@${handle}` : null,
    googleReview: v.google_review?.trim() || null,
    whatsapp: digits ? `https://wa.me/${digits}` : null,
    whatsappDisplay: v.whatsapp?.trim() || null,
    email: v.email?.trim() || null,
  };
}

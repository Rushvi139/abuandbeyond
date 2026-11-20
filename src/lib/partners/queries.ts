import { db } from "@/lib/db";

/** A live partner whose orders go on account, by its QR slug; null for anyone else. */
export async function creditPartnerBySlug(slug: string | undefined | null): Promise<{ id: string; name: string } | null> {
  if (!slug) return null;
  try {
    const [p] = await db()<{ id: string; name: string }[]>`select id, name from properties where slug = ${slug} and active and billing = 'credit'`;
    return p ?? null;
  } catch {
    return null;
  }
}

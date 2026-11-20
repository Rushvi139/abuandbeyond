import Link from "next/link";
import { notFound } from "next/navigation";
import { StatementView } from "@/components/partners/statement-view";
import { partnerByToken, statementWithOrders } from "@/lib/partners/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Statement — Abu & Beyond", robots: { index: false, follow: false } };

export default async function PartnerStatement({ params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  const p = await partnerByToken(token);
  if (!p || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const data = await statementWithOrders(id);
  // Only this partner's own statements, whatever id is typed into the link.
  if (!data || data.statement.propertyId !== p.id) notFound();
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <Link href={`/p/${token}`} className="text-sm text-muted">← Your account</Link>
      <StatementView partner={p} statement={data.statement} orders={data.orders} />
    </main>
  );
}

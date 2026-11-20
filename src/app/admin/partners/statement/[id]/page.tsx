import Link from "next/link";
import { notFound } from "next/navigation";
import { MarkPaid } from "@/components/admin/partner-controls";
import { StatementView } from "@/components/partners/statement-view";
import { requireRole } from "@/lib/auth";
import { partnerById, statementWithOrders } from "@/lib/partners/data";

export const dynamic = "force-dynamic";

export default async function StatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireRole(["owner", "manager"], `/admin/partners/statement/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const data = await statementWithOrders(id);
  if (!data) notFound();
  const p = await partnerById(data.statement.propertyId);
  if (!p) notFound();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={`/admin/partners/${p.id}`} className="text-sm text-muted">← {p.name}</Link>
        <MarkPaid id={id} paid={!!data.statement.paidOn} isOwner={staff.role === "owner"} />
      </div>
      <StatementView partner={p} statement={data.statement} orders={data.orders} />
      <p className="text-sm text-muted">
        The partner sees this on their page: <code className="break-all text-xs">{`${site}/p/${p.viewToken}/s/${id}`}</code>
      </p>
    </div>
  );
}

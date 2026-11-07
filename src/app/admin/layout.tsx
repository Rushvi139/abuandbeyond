import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { logout, requireRole } from "@/lib/auth";
import { AdminNav } from "@/components/admin/nav";

export const dynamic = "force-dynamic";

async function signOut() {
  "use server";
  await logout();
  redirect("/login");
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireRole(["owner", "manager"], "/admin");
  return (
    <div className="flex min-h-dvh flex-col bg-paper md:flex-row">
      <aside className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 md:w-56 md:flex-none md:flex-col md:items-stretch md:justify-start md:border-b-0 md:border-r md:px-4 md:py-5">
        <Link href="/admin" className="flex items-center gap-2">
          <Image src="/brand/patch-primary.png" alt="Abu & Beyond" width={64} height={44} />
          <span className="hidden text-[11px] font-bold uppercase tracking-[0.12em] text-muted md:inline">Back office</span>
        </Link>
        <AdminNav role={staff.role} />
        <form action={signOut} className="md:mt-auto">
          <button type="submit" className="text-xs font-semibold text-muted">{staff.fullName.split(" ")[0]} · Sign out</button>
        </form>
      </aside>
      <main className="flex-1 px-4 py-5 md:px-8">{children}</main>
    </div>
  );
}

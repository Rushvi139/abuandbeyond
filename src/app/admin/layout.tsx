import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { logout, requireRole } from "@/lib/auth";
import { AdminNav } from "@/components/admin/nav";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

async function signOut() {
  "use server";
  await logout();
  redirect("/login");
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireRole(["owner", "manager"], "/admin");
  return (
    <div className="flex min-h-dvh flex-col bg-paper md:flex-row">
      {/* Mobile top bar */}
      <header className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2 md:hidden">
        <Link href="/admin" className="flex items-center gap-2">
          <Image src="/brand/patch-primary.png" alt="Abu & Beyond" width={48} height={34} />
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Back office</span>
        </Link>
        <form action={signOut}>
          <button type="submit" className="text-xs font-semibold text-muted">{staff.fullName.split(" ")[0]} · Out</button>
        </form>
      </header>

      {/* Mobile nav scroll strip */}
      <div className="border-b border-line bg-surface px-4 py-2 md:hidden overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <AdminNav role={staff.role} />
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-60 md:flex-none md:flex-col md:border-r md:border-line md:bg-surface md:px-4 md:py-5">
        {/* Logo + brand */}
        <Link href="/admin" className="flex items-center gap-3 px-1 pb-5 border-b border-line">
          <Image src="/brand/patch-primary.png" alt="Abu & Beyond" width={56} height={40} />
          <div>
            <p className="text-sm font-bold leading-tight text-ink">Abu &amp; Beyond</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Back office</p>
          </div>
        </Link>

        {/* Nav groups */}
        <div className="flex-1 overflow-y-auto py-4">
          <AdminNav role={staff.role} />
        </div>

        {/* Staff footer */}
        <div className="border-t border-line pt-4">
          <div className="flex items-center justify-between px-1">
            <div>
              <p className="text-xs font-semibold text-ink">{staff.fullName}</p>
              <p className="text-[10px] text-muted capitalize">{staff.role}</p>
            </div>
            <form action={signOut}>
              <button type="submit" className="rounded-lg bg-paper px-2.5 py-1.5 text-xs font-semibold text-muted hover:bg-line transition-colors">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto px-4 py-5 md:px-8">{children}</main>
    </div>
  );
}

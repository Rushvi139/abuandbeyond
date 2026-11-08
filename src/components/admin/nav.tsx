"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS: { href: string; label: string; owner?: boolean }[] = [
  { href: "/admin", label: "Orders" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/properties", label: "Properties" },
  { href: "/admin/catering", label: "Catering" },
  { href: "/admin/menu", label: "Menu" },
  { href: "/admin/recipes", label: "Recipes" },
  { href: "/admin/stock", label: "Inventory" },
  { href: "/admin/accounts", label: "Accounts", owner: true },
  { href: "/kitchen", label: "Kitchen" },
  { href: "/rider", label: "Rider" },
];

export function AdminNav({ role }: { role: string }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto md:mt-6 md:flex-col [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {ITEMS.filter((i) => !i.owner || role === "owner").map((i) => {
        const on = i.href === "/admin" ? path === "/admin" || path.startsWith("/admin/orders") : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} className={`h-10 flex-none rounded-xl px-3 text-sm leading-10 ${on ? "bg-ink font-semibold text-reversed" : "font-medium text-ink hover:bg-paper"}`}>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string; icon: string };
type NavGroup = { label: string; items: NavItem[]; ownerOnly?: boolean };

const GROUPS: NavGroup[] = [
  {
    label: "Operations",
    items: [
      { href: "/admin", label: "Dashboard", icon: "◼" },
      { href: "/admin/orders", label: "Orders", icon: "🧾" },
      { href: "/admin/catering", label: "Catering", icon: "🍽" },
    ],
  },
  {
    label: "Kitchen",
    items: [
      { href: "/kitchen", label: "Live Display", icon: "📺" },
      { href: "/admin/recipes", label: "Recipes", icon: "📖" },
      { href: "/admin/stock", label: "Inventory", icon: "📦" },
    ],
  },
  {
    label: "Guests & Places",
    items: [
      { href: "/admin/customers", label: "Customers", icon: "👤" },
      { href: "/admin/properties", label: "Properties", icon: "🏨" },
      { href: "/admin/stays", label: "Stay Directory", icon: "📍" },
    ],
  },
  {
    label: "Catalogue",
    items: [
      { href: "/admin/menu", label: "Menu", icon: "🍕" },
      { href: "/admin/coupons", label: "Coupons", icon: "🎟" },
    ],
  },
  {
    label: "Finance",
    ownerOnly: true,
    items: [
      { href: "/admin/accounts", label: "Ledger", icon: "📊" },
      { href: "/admin/accounts/vendors", label: "Vendors", icon: "🏪" },
      { href: "/admin/accounts/expenses", label: "Expenses", icon: "💸" },
    ],
  },
  {
    label: "Staff",
    items: [
      { href: "/rider", label: "Rider View", icon: "🏍" },
    ],
  },
];

export function AdminNav({ role }: { role: string }) {
  const path = usePathname();

  function isActive(href: string) {
    if (href === "/admin") return path === "/admin";
    return path.startsWith(href);
  }

  return (
    <nav className="flex gap-1 overflow-x-auto md:mt-4 md:flex-col md:gap-0 md:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {/* Mobile: flat scrollable row */}
      <div className="flex gap-1 md:hidden">
        {GROUPS.flatMap((g) =>
          (g.ownerOnly && role !== "owner" ? [] : g.items).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex h-9 flex-none items-center gap-1.5 rounded-xl px-3 text-sm font-medium whitespace-nowrap transition-colors ${
                isActive(item.href)
                  ? "bg-ink text-reversed font-semibold"
                  : "text-ink hover:bg-surface"
              }`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </Link>
          ))
        )}
      </div>

      {/* Desktop: grouped sidebar */}
      <div className="hidden md:flex md:flex-col md:gap-5">
        {GROUPS.filter((g) => !g.ownerOnly || role === "owner").map((group) => (
          <div key={group.label}>
            <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.1em] text-muted">
              {group.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const on = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex h-9 items-center gap-2.5 rounded-xl px-3 text-sm transition-colors ${
                      on
                        ? "bg-ink font-semibold text-reversed"
                        : "font-medium text-ink hover:bg-surface"
                    }`}
                  >
                    <span className={`text-base leading-none ${on ? "" : "opacity-70"}`}>
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}

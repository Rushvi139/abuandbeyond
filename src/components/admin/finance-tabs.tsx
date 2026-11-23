"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * One row of tabs across every Finance screen, so the books read as one
 * module rather than a page that keeps growing. The date range you picked
 * follows you from tab to tab.
 */
const TABS: { href: string; label: string; exact?: boolean }[] = [
  { href: "/admin/accounts", label: "Overview", exact: true },
  { href: "/admin/accounts/sales", label: "Sales" },
  { href: "/admin/accounts/cash", label: "Cash book" },
  { href: "/admin/accounts/money", label: "Bank & cash" },
  { href: "/admin/accounts/expenses", label: "Expenses" },
  { href: "/admin/accounts/daybook", label: "Daily book" },
  { href: "/admin/accounts/vendors", label: "Vendor bills", exact: true },
  { href: "/admin/accounts/vendor-list", label: "Vendors" },
];

export function FinanceTabs() {
  const path = usePathname();
  const sp = useSearchParams();
  const carry = new URLSearchParams();
  for (const k of ["range", "from", "to"]) {
    const v = sp.get(k);
    if (v) carry.set(k, v);
  }
  const q = carry.toString();
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto border-b border-line px-1 pb-px [scrollbar-width:none]" aria-label="Finance">
      {TABS.map((t) => {
        const on = t.exact ? path === t.href : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={q ? `${t.href}?${q}` : t.href}
            className={`flex-none border-b-2 px-3 py-2 text-sm font-semibold ${on ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

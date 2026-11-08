"use client";

import Link from "next/link";
import { useCart } from "@/hooks/use-cart";

type Tab = "menu" | "cart" | "account" | "support";

const ICON: Record<Tab, string> = {
  menu: "M4 6h16M4 12h16M4 18h10",
  cart: "M5 7h14l-1.2 10.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 7Zm3.5 0V5.8a3.5 3.5 0 0 1 7 0V7",
  account: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0",
  support: "M21 12a9 9 0 1 1-3.1-6.8L21 3m0 0v6h-6",
};

/** Bottom tabs on every guest screen: the menu, the cart, your orders and help. */
export function StoreNav({ active }: { active: Tab }) {
  const cart = useCart();
  const tabs: { id: Tab; label: string; href: string; badge?: number }[] = [
    { id: "menu", label: "Menu", href: "/" },
    { id: "cart", label: "Cart", href: "/checkout", badge: cart.ready ? cart.count : 0 },
    { id: "account", label: "Account", href: "/account" },
    { id: "support", label: "Help", href: "/support" },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-line bg-paper/95 backdrop-blur" aria-label="Sections">
      <ul className="flex">
        {tabs.map((t) => (
          <li key={t.id} className="flex-1">
            <Link href={t.href} aria-current={active === t.id ? "page" : undefined} className={`flex h-16 flex-col items-center justify-center gap-1 ${active === t.id ? "text-clay" : "text-muted"}`}>
              <span className="relative">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={ICON[t.id]} />
                </svg>
                {t.badge ? (
                  <span className="absolute -right-2.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-clay px-1 text-[10px] font-bold text-ink">{t.badge}</span>
                ) : null}
              </span>
              <span className="text-[11px] font-semibold">{t.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

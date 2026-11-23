import { MenuItemForm, type EditableItem } from "@/components/admin/menu-item-form";
import { CategoryOrder } from "@/components/admin/category-order";
import { MenuRow, RetiredRow } from "@/components/admin/menu-row";
import { AddonForm, AddonRow, type Addon } from "@/components/admin/addon-form";
import { BannerForm, BannerRowView, type BannerRow } from "@/components/admin/banner-form";
import { requireRole } from "@/lib/auth";
import { taxLine } from "@/lib/pricing";
import { saveSocialLinks } from "@/lib/crm/actions";
import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type Item = EditableItem & { available: boolean; priceStatus: string; foodCostPaise: number | null };

const TABS = [
  { key: "live", label: "Live menu" },
  { key: "off", label: "Off the menu" },
  { key: "addons", label: "Add-ons" },
  { key: "banners", label: "Banners" },
  { key: "settings", label: "Settings" },
] as const;
type Tab = (typeof TABS)[number]["key"];

/**
 * One job per tab instead of one long page: what guests see now, what is
 * off it, the add-ons, the banners, and the rarely-touched settings. The
 * three "+" buttons up top open the right form on the right tab.
 */
export default async function MenuAdmin({ searchParams }: { searchParams: Promise<{ tab?: string; new?: string }> }) {
  const sp = await searchParams;
  const tab: Tab = (TABS.find((t) => t.key === sp.tab)?.key ?? "live") as Tab;
  const adding = sp.new === "1";
  const staff = await requireRole(["owner", "manager"], "/admin/menu");
  const sql = db();
  const items = await sql<Item[]>`
    select m.id, m.name, m.description, c.name as category, m.station_id as station, m.cuisine, m.is_veg as "isVeg",
      m.price_paise as "pricePaise", m.packaging_cost_paise as "packagingPaise", m.available, m.price_status as "priceStatus", m.image_path as "imagePath",
      coalesce((select g.name || ': ' || string_agg(o.name, ' | ' order by o.sort_order) from option_groups g join options o on o.option_group_id = g.id where g.menu_item_id = m.id group by g.name limit 1), '') as options,
      coalesce((select array_agg(ma.addon_id::text) from menu_item_addons ma join addons a on a.id = ma.addon_id where ma.menu_item_id = m.id and a.active), '{}') as "addonIds",
      (select round(sum(r.quantity * i.rate_paise_per_unit) * 1.15) from recipe_lines r join ingredients i on i.id = r.ingredient_id where r.menu_item_id = m.id) + m.packaging_cost_paise as "foodCostPaise"
    from menu_items m join categories c on c.id = m.category_id where m.active order by c.sort_order, c.name, m.price_paise, m.name`;
  const retired = await sql<Item[]>`
    select m.id, m.name, m.is_veg as "isVeg", m.price_paise as "pricePaise", m.available, m.price_status as "priceStatus",
      null::int as "foodCostPaise"
    from menu_items m where not m.active and m.archived_at is null order by (m.price_paise < 100) desc, m.name`;
  const addons = await sql<Addon[]>`
    select a.id, a.name, a.price_paise as "pricePaise", a.is_veg as "isVeg",
      (select count(*)::int from menu_item_addons ma where ma.addon_id = a.id) as "usedBy"
    from addons a where a.active order by a.name`;
  const banners = await sql<BannerRow[]>`
    select id, title, subtitle, link_url as "linkUrl", image_path as "imagePath", tone, placement, motif,
      cta_label as "ctaLabel", sort_order as "sortOrder", starts_on::text as "startsOn", ends_on::text as "endsOn"
    from banners where active order by sort_order, created_at desc`;
  const [social] = await sql<{ value: { instagram: string | null; google_review: string | null; whatsapp: string | null; email: string | null } }[]>`select value from settings where key = 'social_links'`;
  const groups = [...new Set(items.map((i) => i.category))];
  const order = await sql<{ id: string; name: string; count: number }[]>`
    select c.id, c.name, (select count(*)::int from menu_items m where m.category_id = c.id and m.active) as count
    from categories c where c.active order by c.sort_order, c.name`;

  const counts: Record<Tab, number | null> = { live: items.length, off: retired.length, addons: addons.length, banners: banners.length, settings: null };
  const tabs = TABS.filter((t) => t.key !== "settings" || staff.role === "owner");
  const card = "overflow-hidden rounded-2xl bg-surface";
  const close = (t: Tab) => (
    <Link href={`/admin/menu?tab=${t}`} className="text-sm font-semibold text-muted hover:text-ink">Close</Link>
  );

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[32px] uppercase leading-none">Menu</h1>
          <p className="mt-1 text-sm text-muted">{taxLine()}. Changes show on the site straight away.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/menu?tab=live&new=1" className="flex h-10 items-center rounded-xl bg-ink px-4 text-sm font-semibold text-reversed">+ Add dish</Link>
          <Link href="/admin/menu?tab=addons&new=1" className="flex h-10 items-center rounded-xl border border-ink px-4 text-sm font-semibold">+ Add-on</Link>
          <Link href="/admin/menu?tab=banners&new=1" className="flex h-10 items-center rounded-xl border border-ink px-4 text-sm font-semibold">+ Banner</Link>
        </div>
      </header>

      <nav className="-mx-1 flex gap-1 overflow-x-auto border-b border-line px-1 pb-px [scrollbar-width:none]" aria-label="Menu sections">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/admin/menu?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={`flex flex-none items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold ${tab === t.key ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {t.label}
            {counts[t.key] != null && (
              <span className={`rounded-full px-1.5 text-[11px] ${tab === t.key ? "bg-ink text-reversed" : "bg-paper text-muted"}`}>{counts[t.key]}</span>
            )}
          </Link>
        ))}
      </nav>

      {tab === "live" && (
        <>
          {adding && (
            <section className="rounded-2xl border border-ink p-1">
              <div className="flex items-center justify-between px-3 pt-2">
                <h2 className="font-display text-[18px] uppercase">New dish</h2>
                {close("live")}
              </div>
              <MenuItemForm categories={groups} addons={addons} />
            </section>
          )}
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
            {groups.map((g) => (
              <a key={g} href={`#cat-${encodeURIComponent(g)}`} className="flex-none rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold">
                {g} <span className="text-muted">{items.filter((i) => i.category === g).length}</span>
              </a>
            ))}
          </div>
          {groups.map((g) => (
            <section key={g} id={`cat-${encodeURIComponent(g)}`} className="scroll-mt-4">
              <h2 className="mb-2 font-display text-[18px] uppercase">{g}</h2>
              <div className={card}>
                {items.filter((i) => i.category === g).map((i) => (
                  <div key={i.id} className="border-b border-line last:border-0">
                    <MenuRow item={i} canPrice={["owner", "manager"].includes(staff.role)} edit={<MenuItemForm item={i} categories={groups} addons={addons} />} />
                  </div>
                ))}
              </div>
            </section>
          ))}
          {items.length === 0 && <p className="rounded-2xl bg-surface p-6 text-center text-sm text-muted">Nothing on the menu yet. Tap + Add dish.</p>}
        </>
      )}

      {tab === "off" && (
        <section>
          <p className="mb-2 text-sm text-muted">
            Dishes taken off the live menu. <b>Put back</b> returns one as it was. A new dish with no price waits here until you type one.
            <b> Remove forever</b> deletes a dish that was never ordered; one with past orders is hidden for good and stays in your order history.
          </p>
          <div className={card}>
            {retired.map((i) => <RetiredRow key={i.id} item={i} />)}
            {retired.length === 0 && <p className="p-6 text-center text-sm text-muted">Nothing is off the menu.</p>}
          </div>
        </section>
      )}

      {tab === "addons" && (
        <section className="flex flex-col gap-3">
          <p className="text-sm text-muted">Make an add-on once, then tick it on any dish (Live menu → Edit). Guests see the ticked ones as a checklist when they tap ADD.</p>
          {adding && (
            <div className="rounded-2xl border border-ink p-1">
              <div className="flex items-center justify-between px-3 pt-2">
                <h2 className="font-display text-[18px] uppercase">New add-on</h2>
                {close("addons")}
              </div>
              <AddonForm />
            </div>
          )}
          <div className={card}>
            {addons.map((a) => (
              <div key={a.id} className="border-b border-line last:border-0">
                <AddonRow addon={a} />
              </div>
            ))}
            {addons.length === 0 && <p className="p-6 text-center text-sm text-muted">No add-ons yet. Tap + Add-on.</p>}
          </div>
        </section>
      )}

      {tab === "banners" && (
        <section className="flex flex-col gap-3">
          <p className="text-sm text-muted">A <b>card</b> is the big block that slides under the menu header; a <b>strip</b> runs thin across the top of every guest page. Leave the dates empty to run one until you take it down.</p>
          {adding && (
            <div className="rounded-2xl border border-ink p-1">
              <div className="flex items-center justify-between px-3 pt-2">
                <h2 className="font-display text-[18px] uppercase">New banner</h2>
                {close("banners")}
              </div>
              <BannerForm />
            </div>
          )}
          <div className={card}>
            {banners.map((b) => (
              <div key={b.id} className="border-b border-line last:border-0">
                <BannerRowView banner={b} />
              </div>
            ))}
            {banners.length === 0 && <p className="p-6 text-center text-sm text-muted">No banners running. Tap + Banner.</p>}
          </div>
        </section>
      )}

      {tab === "settings" && staff.role === "owner" && (
        <div className="flex flex-col gap-5">
          <section>
            <h2 className="mb-1 font-display text-[18px] uppercase">Order of sections</h2>
            <p className="mb-2 text-sm text-muted">Top of this list is the top of the guest menu. Inside each section, dishes run cheapest first.</p>
            <CategoryOrder categories={order.filter((c) => c.count > 0)} />
          </section>
          <section>
            <h2 className="mb-1 font-display text-[18px] uppercase">Contact &amp; social</h2>
            <p className="mb-2 text-sm text-muted">The WhatsApp number and email show on the Help page; the Google review and Instagram links show on the menu and after delivery.</p>
            <form action={saveSocialLinks} className="grid max-w-xl gap-2 rounded-2xl bg-surface p-4 sm:grid-cols-3">
              <input name="instagram" defaultValue={social?.value?.instagram ?? ""} placeholder="Instagram handle" className="h-10 rounded-xl border border-line bg-paper px-3 text-sm" />
              <input name="google_review" defaultValue={social?.value?.google_review ?? ""} placeholder="Google review link" className="h-10 rounded-xl border border-line bg-paper px-3 text-sm" />
              <input name="whatsapp" defaultValue={social?.value?.whatsapp ?? ""} placeholder="WhatsApp / phone (+91…)" className="h-10 rounded-xl border border-line bg-paper px-3 text-sm" />
              <input name="email" type="email" defaultValue={social?.value?.email ?? ""} placeholder="Contact email" className="h-10 rounded-xl border border-line bg-paper px-3 text-sm sm:col-span-3" />
              <button className="h-10 rounded-xl bg-ink text-sm font-semibold text-reversed sm:col-span-3">Save</button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

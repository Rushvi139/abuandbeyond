import { MenuItemForm, type EditableItem } from "@/components/admin/menu-item-form";
import { MenuRow } from "@/components/admin/menu-row";
import { AddonForm, AddonRow, type Addon } from "@/components/admin/addon-form";
import { BannerForm, BannerRowView, type BannerRow } from "@/components/admin/banner-form";
import { requireRole } from "@/lib/auth";
import { saveSocialLinks } from "@/lib/crm/actions";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type Item = EditableItem & { available: boolean; priceStatus: string; foodCostPaise: number | null };

export default async function MenuAdmin() {
  const staff = await requireRole(["owner", "manager"], "/admin/menu");
  const sql = db();
  const items = await sql<Item[]>`
    select m.id, m.name, m.description, c.name as category, m.station_id as station, m.cuisine, m.is_veg as "isVeg",
      m.price_paise as "pricePaise", m.packaging_cost_paise as "packagingPaise", m.available, m.price_status as "priceStatus", m.image_path as "imagePath",
      coalesce((select g.name || ': ' || string_agg(o.name, ' | ' order by o.sort_order) from option_groups g join options o on o.option_group_id = g.id where g.menu_item_id = m.id group by g.name limit 1), '') as options,
      coalesce((select string_agg(a.name, ', ') from menu_item_addons ma join addons a on a.id = ma.addon_id where ma.menu_item_id = m.id), '') as addons,
      (select round(sum(r.quantity * i.rate_paise_per_unit) * 1.15) from recipe_lines r join ingredients i on i.id = r.ingredient_id where r.menu_item_id = m.id) + m.packaging_cost_paise as "foodCostPaise"
    from menu_items m join categories c on c.id = m.category_id where m.active order by c.sort_order, m.sort_order`;
  const addons = await sql<Addon[]>`
    select a.id, a.name, a.price_paise as "pricePaise", a.is_veg as "isVeg",
      (select count(*)::int from menu_item_addons ma where ma.addon_id = a.id) as "usedBy"
    from addons a where a.active order by a.name`;
  const banners = await sql<BannerRow[]>`
    select id, title, subtitle, link_url as "linkUrl", image_path as "imagePath", tone, placement, motif,
      cta_label as "ctaLabel", sort_order as "sortOrder", starts_on as "startsOn", ends_on as "endsOn"
    from banners where active order by sort_order, created_at desc`;
  const [social] = await sql<{ value: { instagram: string | null; google_review: string | null; whatsapp: string | null } }[]>`select value from settings where key = 'social_links'`;
  const groups = [...new Set(items.map((i) => i.category))];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-[32px] uppercase">Menu</h1>
        <p className="text-sm text-muted">Switch a dish off when it sells out. Prices are before 5% GST. New dishes show on the site immediately.</p>
      </div>
      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Add a dish</h2>
        <MenuItemForm categories={groups} />
      </section>
      {groups.map((g) => (
        <section key={g}>
          <h2 className="mb-2 font-display text-[18px] uppercase">{g}</h2>
          <div className="overflow-hidden rounded-2xl bg-surface">
            {items.filter((i) => i.category === g).map((i) => (
              <div key={i.id} className="border-b border-line last:border-0">
                <MenuRow item={i} canPrice={["owner", "manager"].includes(staff.role)} edit={<MenuItemForm item={i} categories={groups} />} />
              </div>
            ))}
          </div>
        </section>
      ))}
      <section>
        <h2 className="mb-1 font-display text-[18px] uppercase">Banners</h2>
        <p className="mb-2 text-sm text-muted">A <b>strip</b> runs thin across the very top of every guest page; a <b>card</b> is the big swipeable block under the menu header. Leave the dates empty to run one until you take it down.</p>
        <BannerForm />
        <div className="mt-3 overflow-hidden rounded-2xl bg-surface">
          {banners.map((b) => (
            <div key={b.id} className="border-b border-line last:border-0">
              <BannerRowView banner={b} />
            </div>
          ))}
          {banners.length === 0 && <p className="p-4 text-center text-sm text-muted">No banners running.</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-1 font-display text-[18px] uppercase">Add-ons</h2>
        <p className="mb-2 text-sm text-muted">Make an add-on here once, then type its name into a dish&apos;s add-on box to offer it on that dish.</p>
        <AddonForm />
        <div className="mt-3 overflow-hidden rounded-2xl bg-surface">
          {addons.map((a) => (
            <div key={a.id} className="border-b border-line last:border-0">
              <AddonRow addon={a} />
            </div>
          ))}
          {addons.length === 0 && <p className="p-4 text-center text-sm text-muted">No add-ons yet.</p>}
        </div>
      </section>

      {staff.role === "owner" && (
        <section>
          <h2 className="mb-2 font-display text-[18px] uppercase">Social links (the wall)</h2>
          <form action={saveSocialLinks} className="grid max-w-xl gap-2 rounded-2xl bg-surface p-4 sm:grid-cols-3">
            <input name="instagram" defaultValue={social?.value?.instagram ?? ""} placeholder="Instagram handle" className="h-10 rounded-xl border border-line bg-paper px-3 text-sm" />
            <input name="google_review" defaultValue={social?.value?.google_review ?? ""} placeholder="Google review link" className="h-10 rounded-xl border border-line bg-paper px-3 text-sm" />
            <input name="whatsapp" defaultValue={social?.value?.whatsapp ?? ""} placeholder="WhatsApp number (+91…)" className="h-10 rounded-xl border border-line bg-paper px-3 text-sm" />
            <button className="h-10 rounded-xl bg-ink text-sm font-semibold text-reversed sm:col-span-3">Save</button>
          </form>
        </section>
      )}
    </div>
  );
}

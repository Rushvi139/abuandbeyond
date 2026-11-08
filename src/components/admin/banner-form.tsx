"use client";

import { useState } from "react";
import { retireBanner, saveBanner } from "@/lib/admin/banner-actions";

export type BannerRow = {
  id: string;
  title: string;
  subtitle: string | null;
  linkUrl: string | null;
  imagePath: string | null;
  tone: string;
  placement: string;
  motif: string;
  ctaLabel: string | null;
  sortOrder: number;
  startsOn: string | null;
  endsOn: string | null;
};

const inp = "h-10 rounded-xl border border-line bg-paper px-3 text-sm";
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }) : null);

export function BannerForm({ banner }: { banner?: BannerRow }) {
  const [open, setOpen] = useState(!banner);
  if (banner && !open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="h-9 rounded-xl border border-ink px-3 text-xs font-semibold">
        Edit
      </button>
    );
  }
  return (
    <form action={saveBanner} className="grid gap-2 rounded-2xl bg-surface p-3 sm:grid-cols-2">
      {banner && <input type="hidden" name="id" value={banner.id} />}
      <input name="title" defaultValue={banner?.title} required maxLength={60} placeholder="Headline, e.g. Free delivery tonight" className={inp} />
      <input name="subtitle" defaultValue={banner?.subtitle ?? ""} maxLength={120} placeholder="One line under it (optional)" className={inp} />
      <input name="linkUrl" defaultValue={banner?.linkUrl ?? ""} placeholder="Opens… /merch or a full link (optional)" className={inp} />
      <select name="placement" defaultValue={banner?.placement ?? "card"} className={inp}>
        <option value="card">Big card on the menu</option>
        <option value="ribbon">Thin strip across the top</option>
      </select>
      <select name="motif" defaultValue={banner?.motif ?? "none"} className={inp}>
        <option value="none">Plain strip</option>
        <option value="lights">Festive lights</option>
        <option value="paws">Paw prints</option>
      </select>
      <input name="ctaLabel" defaultValue={banner?.ctaLabel ?? ""} maxLength={20} placeholder="Button words on the strip, e.g. Order now" className={inp} />
      <select name="tone" defaultValue={banner?.tone ?? "clay"} className={inp}>
        <option value="clay">Orange</option>
        <option value="acid">Yellow</option>
        <option value="hill">Green</option>
        <option value="ink">Black</option>
        <option value="kraft">Kraft</option>
      </select>
      <label className="flex items-center gap-2 text-xs text-muted">
        Show from
        <input name="startsOn" type="date" defaultValue={banner?.startsOn?.slice(0, 10) ?? ""} className={inp} />
      </label>
      <label className="flex items-center gap-2 text-xs text-muted">
        until
        <input name="endsOn" type="date" defaultValue={banner?.endsOn?.slice(0, 10) ?? ""} className={inp} />
      </label>
      <label className="flex items-center gap-2 text-xs text-muted">
        Background photo
        <input name="image" type="file" accept="image/jpeg,image/png,image/webp" className="text-xs" />
        {banner?.imagePath && <span className="text-success">has photo</span>}
      </label>
      <input name="sortOrder" type="number" min="0" max="999" defaultValue={banner?.sortOrder ?? 100} className={inp} aria-label="Order" />
      <div className="flex gap-2 sm:col-span-2">
        <button className="h-10 rounded-xl bg-ink px-4 text-sm font-semibold text-reversed">Save banner</button>
        {banner && (
          <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-xl px-3 text-sm text-muted">Cancel</button>
        )}
      </div>
    </form>
  );
}

export function BannerRowView({ banner }: { banner: BannerRow }) {
  const window = [day(banner.startsOn), day(banner.endsOn)].filter(Boolean).join(" → ");
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${banner.placement === "ribbon" ? "bg-ink text-reversed" : "bg-paper"}`}>
        {banner.placement === "ribbon" ? "Strip" : "Card"}
      </span>
      <span className="font-semibold">{banner.title}</span>
      {banner.subtitle && <span className="text-muted">{banner.subtitle}</span>}
      {window && <span className="text-xs text-muted">{window}</span>}
      {banner.imagePath && <span className="text-xs text-success">photo</span>}
      <span className="ml-auto flex items-center gap-2">
        <BannerForm banner={banner} />
        <form action={retireBanner.bind(null, banner.id)}>
          <button className="h-9 rounded-xl px-3 text-xs font-semibold text-error">Take down</button>
        </form>
      </span>
    </div>
  );
}

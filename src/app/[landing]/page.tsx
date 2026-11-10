import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getMenu } from "@/lib/menu/queries";
import type { Category } from "@/lib/menu/types";
import { formatINR } from "@/lib/pricing";
import { LEGAL } from "@/lib/legal";
import { OG_IMAGE, SITE_URL, jsonLd } from "@/lib/seo";
import { LANDINGS, landingBySlug } from "@/lib/seo-pages";
import { VegMark } from "@/components/store/veg-mark";
import { StoreNav } from "@/components/store/store-nav";

/**
 * Keyword landing pages (/food-delivery-mount-abu, /pizza-delivery-mount-abu …).
 * Server-rendered text Google can read, with the live dishes and prices, and
 * every link leading back to the menu to order. Only slugs in LANDINGS exist;
 * anything else is a 404. Real routes (/support, /wall …) always win over this segment.
 */
// Rendered per request like the home page, so prices are always today's and a
// build without a database never bakes in an empty menu.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ landing: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const l = landingBySlug((await params).landing);
  if (!l) return {};
  return {
    title: { absolute: l.title },
    description: l.description,
    alternates: { canonical: `/${l.slug}` },
    // A page-level openGraph replaces the layout's whole object, so the image goes again here.
    openGraph: { type: "website", siteName: "Abu & Beyond", locale: "en_IN", title: l.title, description: l.description, url: `/${l.slug}`, images: [{ url: OG_IMAGE, width: 1200, height: 630 }] },
  };
}

export default async function LandingPage({ params }: Props) {
  const l = landingBySlug((await params).landing);
  if (!l) notFound();

  let categories: Category[] = [];
  try {
    categories = await getMenu();
  } catch (e) {
    console.error("menu unavailable:", e);
  }
  const shown = categories
    .filter((c) => l.categories.length === 0 || l.categories.includes(c.slug))
    .map((c) => ({ ...c, items: c.items.filter((i) => !l.cuisine || i.cuisine === l.cuisine) }))
    .filter((c) => c.items.length > 0);

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Abu & Beyond", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: l.h1, item: `${SITE_URL}/${l.slug}` },
    ],
  };

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-paper pb-28">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(breadcrumbs)} />
      <header className="px-5 pt-5">
        <Link href="/" aria-label="Abu & Beyond — menu">
          <Image src="/brand/patch-primary-tilted.png" alt="Abu & Beyond" width={104} height={78} className="-ml-2" />
        </Link>
        <h1 className="mt-4 font-display text-[36px] uppercase leading-none tracking-tight">{l.h1}</h1>
        {l.intro.map((p, i) => (
          <p key={i} className="mt-3 text-[15px] leading-relaxed">{p}</p>
        ))}
        <Link href="/" className="mt-5 inline-block h-12 rounded-2xl bg-ink px-6 text-[15px] font-bold leading-[3rem] text-reversed">
          Order now →
        </Link>
      </header>

      {shown.map((c) => (
        <section key={c.id} className="mt-8 px-5">
          <h2 className="mb-2 font-display text-[22px] uppercase tracking-wide">
            <Link href={`/#${c.slug}`} className="underline-offset-4 hover:underline">{c.name}</Link>
          </h2>
          <ul className="divide-y divide-line rounded-2xl bg-surface">
            {c.items.map((i) => (
              <li key={i.id} className="flex items-start gap-3 px-4 py-3">
                <VegMark veg={i.isVeg} className="mt-1.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold">{i.name}</p>
                  {i.description && <p className="mt-0.5 text-[13px] text-muted">{i.description}</p>}
                </div>
                <span className="text-[15px] font-semibold">{formatINR(i.pricePaise)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="mt-8 px-5">
        <h2 className="mb-2 font-display text-[22px] uppercase tracking-wide">Good to know</h2>
        {l.faq.map((f) => (
          <div key={f.q} className="mb-3">
            <h3 className="text-[15px] font-semibold">{f.q}</h3>
            <p className="mt-0.5 text-[15px] leading-relaxed text-muted">{f.a}</p>
          </div>
        ))}
        <p className="text-[15px] text-muted">
          Call or WhatsApp{" "}
          <a href={`tel:${LEGAL.support.phone}`} className="font-semibold text-ink underline underline-offset-2">{LEGAL.support.phoneDisplay}</a>
          . Kitchen: {LEGAL.address}.
        </p>
      </section>

      <nav aria-label="More from Abu & Beyond" className="mt-8 px-5">
        <h2 className="mb-2 font-display text-[18px] uppercase tracking-wide">More in Mount Abu</h2>
        <ul className="flex flex-wrap gap-2">
          {LANDINGS.filter((o) => o.slug !== l.slug).map((o) => (
            <li key={o.slug}>
              <Link href={`/${o.slug}`} className="inline-block rounded-full border-[1.5px] border-line px-3 py-1.5 text-[13px] font-semibold">
                {o.h1}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <StoreNav active="menu" />
    </div>
  );
}

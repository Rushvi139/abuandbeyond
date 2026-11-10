import { LEGAL } from "@/lib/legal";
import { SERVICE } from "@/lib/hours";
import type { Category } from "@/lib/menu/types";

/**
 * Everything Google reads about us, in one place.
 *
 * The canonical host is fixed here rather than taken from NEXT_PUBLIC_SITE_URL:
 * that variable is "http://localhost:3000" in dev builds, and a sitemap or
 * canonical pointing at localhost would quietly de-index the real site.
 */
export const SITE_URL = "https://abuandbeyond.in";

/** "Abu & Beyond" alone loses to "Above & Beyond" and &Beyond — Google drops
 *  the ampersand. Every title carries "Mount Abu" so the place does the work. */
export const SITE_NAME = "Abu & Beyond";
export const DEFAULT_TITLE = "Abu & Beyond — Food Delivery in Mount Abu | Pizza, Pasta, Burgers, Laffa";
export const DEFAULT_DESCRIPTION =
  "Order online from Abu & Beyond, a global kitchen in Mount Abu. Pizza, pasta, burgers, Lebanese laffa rolls and shakes on homemade breads, delivered to hotels, villas and homestays. Open till 2 AM.";

export const OG_IMAGE = "/brand/og-image.png";

/** Paths Google should never see. Mirrors the private route groups. */
export const PRIVATE_PATHS = ["/admin", "/kitchen", "/rider", "/login", "/api", "/checkout", "/account", "/o/", "/files/bills", "/files/wall"];

/** Restaurant schema for the home page: who we are, where, when, what. */
export function restaurantJsonLd(categories: Category[] | null) {
  const rupees = (p: number) => (p / 100).toFixed(2);
  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "@id": `${SITE_URL}/#restaurant`,
    name: SITE_NAME,
    alternateName: [LEGAL.registeredName, "Abu and Beyond", "Abu & Beyond Mount Abu"],
    slogan: "Beyond the usual",
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    logo: `${SITE_URL}/brand/favicon-512.png`,
    image: `${SITE_URL}${OG_IMAGE}`,
    telephone: LEGAL.support.phone,
    priceRange: "₹₹",
    servesCuisine: ["Italian", "Pizza", "Pasta", "Lebanese", "Mexican", "Chinese", "Burgers", "Fast Food"],
    address: {
      "@type": "PostalAddress",
      streetAddress: "Adarsh Colony, behind Hotel Hillock",
      addressLocality: LEGAL.city,
      addressRegion: LEGAL.state,
      postalCode: "307501",
      addressCountry: "IN",
    },
    areaServed: { "@type": "City", name: "Mount Abu" },
    hasDeliveryMethod: "http://purl.org/goodrelations/v1#DeliveryModeOwnFleet",
    acceptsReservations: false,
    // An evening window past midnight is written as running to 23:59 plus a
    // 00:00 window the next day would be pedantic; schema.org accepts closes
    // earlier than opens to mean "next day", and Google reads it that way.
    openingHoursSpecification: SERVICE.map((s) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      opens: s.from,
      closes: s.to,
    })),
    potentialAction: {
      "@type": "OrderAction",
      target: { "@type": "EntryPoint", urlTemplate: SITE_URL, actionPlatform: ["http://schema.org/DesktopWebPlatform", "http://schema.org/MobileWebPlatform"] },
      deliveryMethod: "http://purl.org/goodrelations/v1#DeliveryModeOwnFleet",
    },
    ...(categories && categories.length > 0
      ? {
          hasMenu: {
            "@type": "Menu",
            name: "Abu & Beyond menu",
            hasMenuSection: categories.map((c) => ({
              "@type": "MenuSection",
              name: c.name,
              hasMenuItem: c.items.map((i) => ({
                "@type": "MenuItem",
                name: i.name,
                ...(i.description ? { description: i.description } : {}),
                ...(i.isVeg ? { suitableForDiet: "https://schema.org/VegetarianDiet" } : {}),
                offers: { "@type": "Offer", price: rupees(i.pricePaise), priceCurrency: "INR" },
              })),
            })),
          },
        }
      : {}),
  };
}

/** Safe to drop into <script type="application/ld+json">: no "</script>" break-out. */
export function jsonLd(data: unknown) {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}

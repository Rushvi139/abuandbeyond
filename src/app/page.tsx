import Image from "next/image";
import { MenuScreen } from "@/components/store/menu-screen";
import { Welcome } from "@/components/store/welcome";
import { getBanners, getMenu, splitBanners } from "@/lib/menu/queries";
import { TopRibbon } from "@/components/store/top-ribbon";
import { jsonLd, restaurantJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";
// Set here, not in the layout: a canonical in the layout would be inherited
// by every page and tell Google they are all copies of the home page.
export const metadata = { alternates: { canonical: "/" } };

export default async function Home() {
  let categories = null;
  let banners: Awaited<ReturnType<typeof getBanners>> = [];
  try {
    [categories, banners] = await Promise.all([getMenu(), getBanners().catch(() => [])]);
  } catch (e) {
    console.error("menu unavailable:", e);
  }

  const schema = <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(restaurantJsonLd(categories))} />;
  if (!categories || categories.length === 0) return <>{schema}<ComingSoon /></>;
  const { ribbons, cards } = splitBanners(banners);

  return (
    <>
      {schema}
      <Welcome />
      <TopRibbon ribbons={ribbons} />
      <MenuScreen categories={categories} closingLabel={null} banners={cards} />
    </>
  );
}

function ComingSoon() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-8 px-6 text-center">
      <Image src="/brand/patch-primary-tilted.png" alt="Abu & Beyond" width={260} height={196} priority />
      <h1 className="font-display text-5xl uppercase leading-none tracking-tight">
        Beyond
        <br />
        <span className="text-clay">the usual.</span>
      </h1>
      <p className="text-muted">Ordering opens soon. Leopards sleep. We don&apos;t.</p>
    </main>
  );
}

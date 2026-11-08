import Link from "next/link";

export type Banner = {
  id: string;
  title: string;
  subtitle: string | null;
  linkUrl: string | null;
  imagePath: string | null;
  tone: "clay" | "acid" | "hill" | "ink" | "kraft";
};

const TONE: Record<Banner["tone"], string> = {
  clay: "bg-clay text-ink",
  acid: "bg-acid text-ink",
  hill: "bg-hill text-reversed",
  ink: "bg-ink text-reversed",
  kraft: "bg-kraft text-ink",
};

/** Offers and announcements across the top of the menu. Swipes sideways on a phone. */
export function BannerStrip({ banners }: { banners: Banner[] }) {
  if (!banners.length) return null;
  return (
    <div className="mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {banners.map((b) => {
        const card = (
          <div className={`relative flex h-[104px] w-[84vw] max-w-[330px] flex-none snap-start overflow-hidden rounded-2xl ${TONE[b.tone]}`}>
            {b.imagePath && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.imagePath} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />
            )}
            <div className={`relative flex flex-col justify-center gap-1 px-4 ${b.imagePath ? "bg-gradient-to-r from-ink/75 to-transparent text-reversed" : ""}`}>
              <span className="font-display text-[22px] uppercase leading-[0.95]">{b.title}</span>
              {b.subtitle && <span className="max-w-[18rem] text-[13px] leading-snug opacity-90">{b.subtitle}</span>}
            </div>
          </div>
        );
        if (!b.linkUrl) return <div key={b.id}>{card}</div>;
        return b.linkUrl.startsWith("/") ? (
          <Link key={b.id} href={b.linkUrl}>{card}</Link>
        ) : (
          <a key={b.id} href={b.linkUrl} target="_blank" rel="noreferrer">{card}</a>
        );
      })}
    </div>
  );
}

import Image from "next/image";
import Link from "next/link";
import { socialLinks } from "@/lib/social";

export const metadata = { title: "The wall — Abu & Beyond" };
export const dynamic = "force-dynamic";

// Phase 2b fills this with reviews and approved photos. Until then: the socials.
export default async function WallPage() {
  const s = await socialLinks();
  const links = [
    s.instagram && { href: s.instagram, label: "Instagram", sub: s.instagramHandle, tone: "bg-clay text-ink" },
    s.googleReview && { href: s.googleReview, label: "Leave a review", sub: "on Google", tone: "bg-paper text-ink" },
    s.whatsapp && { href: s.whatsapp, label: "WhatsApp", sub: s.whatsappDisplay, tone: "border-[1.5px] border-paper" },
  ].filter((l): l is { href: string; label: string; sub: string | null; tone: string } => Boolean(l));

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-night px-5 pb-10 pt-5 text-reversed">
      <div className="flex items-center justify-between">
        <Link href="/" className="flex h-11 items-center gap-1.5 text-[13px] font-semibold">← Menu</Link>
        <Image src="/brand/ampersand-seal-acid.png" alt="Abu & Beyond" width={44} height={44} />
      </div>
      <h1 className="mt-2 font-display text-[52px] uppercase leading-[0.95]">
        The wall
        <br />
        <span className="text-acid">from the hills.</span>
      </h1>
      <p className="mt-2 text-sm text-kraft">Photos, reels and reviews from people who actually ordered. Coming up as soon as the first orders land.</p>

      {/* One per row, not three in a cramped grid: each is a real thing we
          want tapped, and "Instagram" at 13px between two others got none of
          them tapped. */}
      <div className="mt-6 flex flex-col gap-2.5">
        {links.map((l) => (
          <a
            key={l.label}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex h-14 items-center gap-3 rounded-[16px] px-4 text-[15px] font-bold ${l.tone}`}
          >
            {l.label}
            {l.sub && <span className="ml-auto text-[13px] font-semibold opacity-70">{l.sub}</span>}
          </a>
        ))}
      </div>

      {links.length === 0 && (
        <p className="mt-3 text-xs text-kraft">Links switch on once the handles are set in admin.</p>
      )}
    </div>
  );
}

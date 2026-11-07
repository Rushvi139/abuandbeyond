import Image from "next/image";
import Link from "next/link";

export const metadata = { title: "The wall — Abu & Beyond" };

// Phase 2b fills this with reviews and approved photos. Until then: the socials.
export default function WallPage() {
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
      <div className="mt-6 grid grid-cols-3 gap-2">
        <span className="flex h-12 items-center justify-center rounded-[14px] bg-clay text-[13px] font-bold text-ink">Instagram</span>
        <span className="flex h-12 items-center justify-center rounded-[14px] bg-paper text-[13px] font-bold text-ink">Google review</span>
        <span className="flex h-12 items-center justify-center rounded-[14px] border-[1.5px] border-paper text-[13px] font-bold">WhatsApp</span>
      </div>
      <p className="mt-3 text-xs text-kraft">Links switch on once the handles are set in admin.</p>
    </div>
  );
}

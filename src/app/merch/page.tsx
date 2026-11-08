import Image from "next/image";
import { StoreNav } from "@/components/store/store-nav";
import { NotifyMe } from "@/components/store/notify-me";

export const metadata = { title: "Shop · Abu & Beyond" };

const GOODS = [
  { name: "Keychains", note: "The leopard and the patch, in enamel.", art: "/brand/stickers/leo-sit.png", tone: "bg-clay" },
  { name: "Fridge magnets", note: "Guru Shikhar, Nakki Lake, the bear.", art: "/brand/stickers/bear-explorer.png", tone: "bg-acid" },
  { name: "T-shirts", note: "Bone and ink, the wordmark across the chest.", art: "/brand/stickers/leo-prowl.png", tone: "bg-hill" },
  { name: "Caps", note: "Clay orange, ampersand seal on the front.", art: "/brand/stickers/paw.png", tone: "bg-kraft" },
];

export default function MerchPage() {
  return (
    <div className="mx-auto min-h-dvh max-w-md bg-paper pb-28">
      <header className="px-5 pt-5">
        <span className="inline-block rounded-full bg-acid px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em]">Coming soon</span>
        <h1 className="mt-3 font-display text-[34px] uppercase leading-none tracking-tight">
          Take a bit of
          <br />
          <span className="text-clay">Abu home.</span>
        </h1>
        <p className="mt-2 text-[15px] text-muted">We&apos;re making a small run of things worth keeping. Tell us what you&apos;d want and we&apos;ll message you the day they land.</p>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-3 px-5">
        {GOODS.map((g) => (
          <article key={g.name} className="overflow-hidden rounded-2xl bg-surface">
            <div className={`flex h-32 items-center justify-center ${g.tone}`}>
              <Image src={g.art} alt="" width={96} height={96} className="h-24 w-24 object-contain" />
            </div>
            <div className="p-3">
              <p className="text-[15px] font-bold">{g.name}</p>
              <p className="mt-0.5 text-xs leading-snug text-muted">{g.note}</p>
            </div>
          </article>
        ))}
      </div>

      <section className="mt-7 px-5">
        <NotifyMe />
      </section>

      <StoreNav active="menu" />
    </div>
  );
}

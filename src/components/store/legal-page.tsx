import Link from "next/link";
import { StoreNav } from "./store-nav";
import { RibbonSlot } from "./ribbon-slot";

export type Section = { heading: string; body: string[] };

/** Shared shell for Terms, Privacy and Refunds so they read as one document set. */
export function LegalPage({ title, updated, intro, sections }: { title: string; updated: string; intro: string; sections: Section[] }) {
  return (
    <div className="mx-auto min-h-dvh max-w-md bg-paper pb-28">
      <RibbonSlot />
      <header className="px-5 pt-5">
        <Link href="/" className="text-sm font-semibold text-muted underline-offset-2 hover:underline">← Menu</Link>
        <h1 className="mt-3 font-display text-[32px] uppercase leading-none tracking-tight">{title}</h1>
        <p className="mt-2 text-[13px] text-muted">Last updated {updated}</p>
        <p className="mt-3 text-[15px] leading-relaxed">{intro}</p>
      </header>

      <div className="mt-6 flex flex-col gap-5 px-5">
        {sections.map((s) => (
          <section key={s.heading}>
            <h2 className="mb-1.5 font-display text-[18px] uppercase tracking-wide">{s.heading}</h2>
            {s.body.map((p, i) => (
              <p key={i} className="mb-2 text-[15px] leading-relaxed text-muted last:mb-0">{p}</p>
            ))}
          </section>
        ))}
      </div>

      <div className="mt-7 flex flex-wrap gap-x-3 gap-y-1 px-5 text-[13px] text-muted">
        <Link href="/terms" className="underline-offset-2 hover:underline">Terms</Link>
        <span aria-hidden="true">·</span>
        <Link href="/privacy" className="underline-offset-2 hover:underline">Privacy</Link>
        <span aria-hidden="true">·</span>
        <Link href="/refunds" className="underline-offset-2 hover:underline">Refunds &amp; cancellations</Link>
        <span aria-hidden="true">·</span>
        <Link href="/support" className="underline-offset-2 hover:underline">Contact us</Link>
      </div>

      <StoreNav active="support" />
    </div>
  );
}

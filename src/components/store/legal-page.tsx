import Link from "next/link";
import { StoreNav } from "./store-nav";
import { RibbonSlot } from "./ribbon-slot";
import { LEGAL, operatedByLine, registrations } from "@/lib/legal";

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

      {/* Every policy page has to say who "we" is, or it is a promise from
          nobody. One block, one source, so the three cannot drift apart. */}
      <section className="mx-5 mt-7 rounded-2xl bg-surface p-4 text-[13px] leading-relaxed text-muted">
        <h2 className="mb-1 font-display text-[15px] uppercase tracking-wide text-ink">Who you are dealing with</h2>
        <p>{operatedByLine()}</p>
        {registrations().length > 0 && <p className="mt-1">{registrations().join(" · ")}</p>}
        <p className="mt-1">
          <a href={`mailto:${LEGAL.operator.email}`} className="underline underline-offset-2">{LEGAL.operator.email}</a>
          {" · "}
          <a href={`tel:${LEGAL.operator.phone}`} className="underline underline-offset-2">{LEGAL.operator.phoneDisplay}</a>
        </p>
      </section>

      <div className="mt-5 flex flex-wrap gap-x-3 gap-y-1 px-5 text-[13px] text-muted">
        <Link href="/terms" className="underline-offset-2 hover:underline">Terms</Link>
        <span aria-hidden="true">·</span>
        <Link href="/privacy" className="underline-offset-2 hover:underline">Privacy</Link>
        <span aria-hidden="true">·</span>
        <Link href="/refunds" className="underline-offset-2 hover:underline">Refunds &amp; cancellations</Link>
        <span aria-hidden="true">·</span>
        <Link href="/contact" className="underline-offset-2 hover:underline">Contact us</Link>
      </div>

      <StoreNav active="support" />
    </div>
  );
}

import Link from "next/link";
import { StoreNav } from "@/components/store/store-nav";
import { CateringForm } from "@/components/store/catering-form";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Help · Abu & Beyond" };

const FAQ = [
  { q: "How long will my food take?", a: "Most orders leave the kitchen in 25–35 minutes. Once it's on the way you'll see it on your order page, and your rider will call when they reach." },
  { q: "Where do you deliver?", a: "Everywhere in Mount Abu town, plus the hotels and homestays around Nakki Lake. If you're further out, message us before ordering and we'll tell you honestly whether it will travel well." },
  { q: "Can I change or cancel my order?", a: "Call or WhatsApp us straight away. If the kitchen hasn't started cooking it, we'll change it. Once it's on the pass we can't take it back." },
  { q: "Something was wrong with my food.", a: "Tell us the same evening, with a photo if you can. We'd rather remake it or refund it than have you eat something we're not proud of." },
  { q: "Do you cook Jain / no onion-garlic?", a: "For a lot of dishes, yes. Leave it in the note on the dish or the delivery note, and we'll tell you if a dish can't be done that way." },
  { q: "Is the price inclusive of taxes?", a: "Menu prices are before GST. The 5% is added once at checkout, and there's no delivery fee at the moment." },
];

export default async function SupportPage() {
  const [social] = await db()<{ value: { whatsapp: string | null; instagram: string | null } }[]>`select value from settings where key = 'social_links'`;
  const waDigits = social?.value?.whatsapp?.replace(/\D/g, "") ?? "";
  const wa = waDigits ? `https://wa.me/${waDigits}` : null;
  const tel = waDigits ? `tel:+${waDigits}` : null;

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-paper pb-28">
      <header className="px-5 pt-5">
        <h1 className="font-display text-[34px] uppercase leading-none tracking-tight">Help</h1>
        <p className="mt-2 text-[15px] text-muted">A real person from the kitchen answers. We&apos;re on from 11am to 11pm.</p>
      </header>

      <div className="mt-5 flex gap-3 px-5">
        {wa ? (
          <a href={wa} target="_blank" rel="noreferrer" className="flex h-14 flex-1 items-center justify-center rounded-2xl bg-hill text-[15px] font-bold text-reversed">
            WhatsApp us
          </a>
        ) : (
          <span className="flex h-14 flex-1 items-center justify-center rounded-2xl bg-surface text-[15px] font-semibold text-muted">WhatsApp coming soon</span>
        )}
        {tel && (
          <a href={tel} className="flex h-14 flex-1 items-center justify-center rounded-2xl border-[1.5px] border-ink text-[15px] font-bold">
            Call us
          </a>
        )}
      </div>

      <section className="mt-7 px-5">
        <CateringForm />
      </section>

      <section className="mt-7 px-5">
        <h2 className="mb-2 font-display text-[20px] uppercase tracking-wide">Questions we get</h2>
        <div className="overflow-hidden rounded-2xl bg-surface">
          {FAQ.map((f) => (
            <details key={f.q} className="group border-b border-line last:border-0">
              <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3.5 text-[15px] font-semibold marker:content-['']">
                {f.q}
                <span className="text-muted transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="px-4 pb-4 text-[15px] leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-7 px-5">
        <h2 className="mb-2 font-display text-[20px] uppercase tracking-wide">Track an order</h2>
        <p className="text-[15px] text-muted">
          Your live order page is in <Link href="/account" className="font-semibold text-ink underline-offset-2 hover:underline">My account</Link>, and the link we send you keeps working after delivery.
        </p>
      </section>

      <StoreNav active="support" />
    </div>
  );
}

import Link from "next/link";
import { LEGAL, operatedByLine, registrations } from "@/lib/legal";

export const metadata = {
  title: "Contact us · Abu & Beyond",
  description: "How to reach Abu & Beyond, and who operates it.",
};

/**
 * The page a payment gateway, a guest with a complaint, and a notice all end
 * up on. It carries both contacts on purpose: the one that gets answered
 * during service, and the registered one behind the business.
 */
export default function ContactPage() {
  const regs = registrations();

  return (
    <main className="mx-auto min-h-dvh max-w-2xl bg-paper px-5 py-10">
      <Link href="/" className="text-sm font-semibold text-muted underline-offset-2 hover:underline">
        ← Abu &amp; Beyond
      </Link>
      <h1 className="mt-3 font-display text-[40px] uppercase leading-none">Contact us</h1>

      <section className="mt-8">
        <h2 className="font-display text-[20px] uppercase">About your order</h2>
        <p className="mt-1 text-[15px] text-muted">
          Fastest during serving hours. Have your order number ready if you have one.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={`tel:${LEGAL.support.phone}`} className="h-12 rounded-2xl bg-ink px-5 text-[15px] font-bold leading-[3rem] text-reversed">
            Call {LEGAL.support.phoneDisplay}
          </a>
          <a
            href={`https://wa.me/${LEGAL.support.phone.replace("+", "")}`}
            target="_blank"
            rel="noreferrer"
            className="h-12 rounded-2xl border-[1.5px] border-ink px-5 text-[15px] font-bold leading-[3rem]"
          >
            WhatsApp
          </a>
          <Link href="/support" className="h-12 rounded-2xl border-[1.5px] border-ink px-5 text-[15px] font-bold leading-[3rem]">
            Help &amp; FAQs
          </Link>
        </div>
      </section>

      <section className="mt-9 rounded-2xl bg-surface p-5">
        <h2 className="font-display text-[20px] uppercase">Business details</h2>
        <p className="mt-1 text-[15px]">{operatedByLine()}</p>

        <dl className="mt-4 flex flex-col gap-3 text-[15px]">
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-muted">{LEGAL.operator.title}</dt>
            <dd className="font-semibold">{LEGAL.operator.name}</dd>
            <dd className="text-[13px] text-muted">
              Registered name of the {LEGAL.entityType}, trading as {LEGAL.tradeName}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-muted">Email</dt>
            <dd>
              <a href={`mailto:${LEGAL.operator.email}`} className="font-semibold underline-offset-2 hover:underline">
                {LEGAL.operator.email}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-muted">Phone</dt>
            <dd>
              <a href={`tel:${LEGAL.operator.phone}`} className="font-semibold underline-offset-2 hover:underline">
                {LEGAL.operator.phoneDisplay}
              </a>
            </dd>
          </div>
          {LEGAL.address && (
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-muted">Address</dt>
              <dd className="font-semibold">{LEGAL.address}</dd>
            </div>
          )}
          {regs.length > 0 && (
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-muted">Registrations</dt>
              <dd className="font-semibold">{regs.join(" · ")}</dd>
            </div>
          )}
        </dl>

        <p className="mt-4 text-[13px] text-muted">
          For anything about a payment, a refund or a complaint, write to {LEGAL.operator.email} and we will reply within two
          working days. Refund timelines are on the{" "}
          <Link href="/refunds" className="underline underline-offset-2">
            Refunds &amp; Cancellations
          </Link>{" "}
          page.
        </p>
      </section>

      <nav className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-[15px] font-semibold">
        <Link href="/terms" className="underline underline-offset-2">Terms &amp; Conditions</Link>
        <Link href="/privacy" className="underline underline-offset-2">Privacy</Link>
        <Link href="/refunds" className="underline underline-offset-2">Refunds &amp; Cancellations</Link>
      </nav>
    </main>
  );
}

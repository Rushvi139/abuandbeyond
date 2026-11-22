import Link from "next/link";
import type { Social } from "@/lib/social";

/**
 * "Loved it? Tell people." Google review, Instagram and the wall, where a
 * guest who has eaten with us can actually find them: the bottom of the menu,
 * Help, and the order page once it is delivered. Before this the only way in
 * was "The wall" on the order page.
 */
export function ReviewLinks({ social, title = "Loved it? Tell the hills.", className = "" }: { social: Social; title?: string; className?: string }) {
  if (!social.googleReview && !social.instagram) return null;
  return (
    <section className={`rounded-[20px] bg-night p-5 text-reversed ${className}`}>
      <h2 className="font-display text-[26px] uppercase leading-none">{title}</h2>
      <p className="mt-1.5 text-[13px] text-kraft">A review takes 20 seconds and helps a small kitchen in Mount Abu more than anything.</p>
      <div className="mt-4 flex flex-col gap-2">
        {social.googleReview && (
          <a href={social.googleReview} target="_blank" rel="noopener noreferrer" className="flex h-12 items-center justify-between rounded-[14px] bg-acid px-4 text-[15px] font-bold text-ink">
            ★ Review us on Google <span aria-hidden="true">→</span>
          </a>
        )}
        {social.instagram && (
          <a href={social.instagram} target="_blank" rel="noopener noreferrer" className="flex h-12 items-center justify-between rounded-[14px] bg-clay px-4 text-[15px] font-bold text-ink">
            Follow on Instagram <span className="text-[13px] font-semibold opacity-80">{social.instagramHandle}</span>
          </a>
        )}
        <Link href="/wall" className="flex h-12 items-center justify-between rounded-[14px] border-[1.5px] border-reversed/40 px-4 text-[15px] font-semibold">
          The wall <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}

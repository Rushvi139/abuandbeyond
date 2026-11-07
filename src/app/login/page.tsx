import Image from "next/image";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { currentStaff, login } from "@/lib/auth";

export const metadata = { title: "Staff login — Abu & Beyond" };
export const dynamic = "force-dynamic";

const HOME: Record<string, string> = { owner: "/admin", manager: "/admin", kitchen: "/kitchen", rider: "/rider" };

async function signIn(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const pw = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");
  const ua = (await headers()).get("user-agent") ?? undefined;
  const staff = await login(id, pw, ua);
  if (!staff) redirect(`/login?error=1${next ? `&next=${encodeURIComponent(next)}` : ""}`);
  redirect(next && next.startsWith("/") ? next : HOME[staff.role] ?? "/admin");
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string; denied?: string }> }) {
  const sp = await searchParams;
  const staff = await currentStaff();
  if (staff && !sp.denied) redirect(HOME[staff.role] ?? "/admin");

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <Image src="/brand/patch-primary.png" alt="Abu & Beyond" width={150} height={102} priority />
      <h1 className="mt-6 font-display text-[34px] uppercase leading-none">Staff login</h1>
      {sp.error && <p role="alert" className="mt-3 rounded-xl bg-error/10 px-4 py-3 text-sm font-semibold text-error">Wrong number or password.</p>}
      {sp.denied && <p role="alert" className="mt-3 rounded-xl bg-error/10 px-4 py-3 text-sm font-semibold text-error">Your login doesn&apos;t have access to that screen.</p>}
      <form action={signIn} className="mt-5 flex flex-col gap-3.5">
        <input type="hidden" name="next" value={sp.next ?? ""} />
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
          Phone or email
          <input name="id" required autoComplete="username" className="h-[50px] rounded-xl border-[1.5px] border-line bg-surface px-3.5 text-base font-normal" />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
          Password
          <input name="password" type="password" required autoComplete="current-password" className="h-[50px] rounded-xl border-[1.5px] border-line bg-surface px-3.5 text-base font-normal" />
        </label>
        <button type="submit" className="mt-2 h-14 rounded-2xl bg-clay text-base font-bold text-ink">Sign in</button>
      </form>
    </main>
  );
}

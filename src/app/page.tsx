import Image from "next/image";
import { MenuScreen } from "@/components/store/menu-screen";
import { Welcome } from "@/components/store/welcome";
import { getMenu } from "@/lib/menu/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  let categories = null;
  try {
    categories = await getMenu();
  } catch (e) {
    console.error("menu unavailable:", e);
  }

  if (!categories || categories.length === 0) return <ComingSoon />;

  return (
    <>
      <Welcome />
      <MenuScreen categories={categories} closingLabel={null} />
    </>
  );
}

function ComingSoon() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-8 px-6 text-center">
      <Image src="/brand/patch-primary-tilted.png" alt="Abu & Beyond" width={260} height={190} priority />
      <h1 className="font-display text-5xl uppercase leading-none tracking-tight">
        Beyond
        <br />
        <span className="text-clay">the usual.</span>
      </h1>
      <p className="text-muted">Ordering opens soon. Leopards sleep. We don&apos;t.</p>
    </main>
  );
}

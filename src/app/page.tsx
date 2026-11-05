import Image from "next/image";

// Placeholder home. Phase 1 replaces this with the storefront menu (see context/progress-tracker.md).
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-8 px-6 text-center">
      <Image src="/brand/patch-primary-tilted.svg" alt="Abu & Beyond" width={260} height={190} priority />
      <h1 className="font-display text-5xl uppercase leading-none tracking-tight">
        Beyond
        <br />
        <span className="text-clay">the usual.</span>
      </h1>
      <p className="text-muted">Ordering opens soon. Leopards sleep. We don&apos;t.</p>
    </main>
  );
}

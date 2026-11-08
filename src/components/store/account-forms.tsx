"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignInByPhone() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [order, setOrder] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/account/find", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone, order }),
    }).then((r) => r.json()).catch(() => ({ ok: false, error: "Network trouble. Try again." }));
    setBusy(false);
    if (res.ok) router.refresh();
    else setError(res.error ?? "Check the details");
  }

  const field = "h-12 w-full rounded-xl border-[1.5px] border-line bg-paper px-3.5 text-[15px]";
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-[15px] font-bold">Find my orders</p>
      <label className="flex h-12 items-center gap-2 rounded-xl border-[1.5px] border-line bg-paper px-3.5">
        <span className="text-[15px] text-muted">+91</span>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
          inputMode="numeric"
          placeholder="Mobile number"
          className="h-full flex-1 bg-transparent text-[15px] outline-none"
        />
      </label>
      <input value={order} onChange={(e) => setOrder(e.target.value)} placeholder="Any past order number" className={field} />
      {error && <p className="text-sm text-error">{error}</p>}
      <button disabled={busy || phone.length !== 10 || !order} className="h-12 rounded-xl bg-ink text-sm font-bold text-reversed disabled:opacity-50">
        {busy ? "Looking…" : "Find my orders"}
      </button>
    </form>
  );
}

export function SignOut() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/account/find", { method: "DELETE" });
        router.refresh();
      }}
      className="mt-3 text-sm font-semibold text-muted underline-offset-2 hover:underline"
    >
      Not you? Forget this phone
    </button>
  );
}

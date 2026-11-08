"use client";

import { useState } from "react";

const WANTS = ["Keychains", "Fridge magnets", "T-shirts", "Caps"];

export function NotifyMe() {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [wants, setWants] = useState<string[]>([]);
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    setError(null);
    const res = await fetch("/api/merch/interest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone, name, wants }),
    }).then((r) => r.json()).catch(() => ({ ok: false, error: "Network trouble. Try again." }));
    if (res.ok) setState("done");
    else {
      setState("idle");
      setError(res.error ?? "Check the details");
    }
  }

  if (state === "done") {
    return (
      <p className="rounded-2xl bg-surface p-5 text-center text-[15px]">
        You&apos;re on the list. We&apos;ll message you the day they land.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl bg-surface p-4">
      <p className="text-[15px] font-bold">Tell me when it&apos;s out</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {WANTS.map((w) => {
          const on = wants.includes(w);
          return (
            <button
              key={w}
              type="button"
              onClick={() => setWants((p) => (on ? p.filter((x) => x !== w) : [...p, w]))}
              aria-pressed={on}
              className={`h-9 rounded-full border-[1.5px] px-3.5 text-[13px] font-semibold ${on ? "border-clay bg-clay text-ink" : "border-line text-ink"}`}
            >
              {w}
            </button>
          );
        })}
      </div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)" className="mt-3 h-12 w-full rounded-xl border-[1.5px] border-line bg-paper px-3.5 text-[15px]" />
      <label className="mt-2.5 flex h-12 items-center gap-2 rounded-xl border-[1.5px] border-line bg-paper px-3.5">
        <span className="text-[15px] text-muted">+91</span>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
          inputMode="numeric"
          placeholder="Mobile number"
          className="h-full flex-1 bg-transparent text-[15px] outline-none"
        />
      </label>
      {error && <p className="mt-2 text-sm text-error">{error}</p>}
      <button disabled={state === "busy" || phone.length !== 10} className="mt-3 h-12 w-full rounded-xl bg-ink text-sm font-bold text-reversed disabled:opacity-50">
        {state === "busy" ? "Saving…" : "Keep me posted"}
      </button>
    </form>
  );
}

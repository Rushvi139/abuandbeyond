/**
 * Browser side of the PayU hand-off: post the signed form our server built
 * to PayU's payment page. The page leaves the site here and comes back via
 * /api/payu/return, which settles the order server-side.
 */
export type PayuForm = { action: string; fields: Record<string, string> };

export function submitPayuForm(f: PayuForm) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = f.action;
  form.style.display = "none";
  for (const [name, value] of Object.entries(f.fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

/** Asks our server for a fresh signed form for an existing order, then goes. */
export async function payExistingOrder(code: string) {
  const res = await fetch("/api/payments/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; data?: PayuForm };
  if (!json.ok || !json.data) throw new Error(json.error ?? "Couldn't open payment.");
  submitPayuForm(json.data);
}

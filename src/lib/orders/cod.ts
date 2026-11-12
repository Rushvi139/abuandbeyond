import "server-only";
import { db } from "@/lib/db";
import { payuConfigured } from "@/lib/payments/payu";

/**
 * Whether we offer "pay the rider at the door".
 *
 * Two things decide it, and the second one matters most:
 *
 *  - the `cod_enabled` setting, which the owner controls; and
 *  - whether the gateway works at all. With no gateway, cash is the only way
 *    to order, so it is always offered — otherwise the shop is open, the
 *    kitchen is staffed, and nobody can buy anything.
 *
 * So the setting is really "offer cash *as well as* online", and the fallback
 * makes it impossible to end up with a menu that takes no orders.
 */
export async function codAllowed(): Promise<boolean> {
  if (!payuConfigured()) return true;
  const [row] = await db()<{ value: boolean }[]>`select value::boolean as value from settings where key = 'cod_enabled'`;
  return row?.value === true;
}

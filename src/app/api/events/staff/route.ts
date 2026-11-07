import { ALL_STAFF, currentStaff } from "@/lib/auth";
import { sseResponse } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const staff = await currentStaff();
  if (!staff || !ALL_STAFF.includes(staff.role)) return new Response("forbidden", { status: 403 });
  return sseResponse();
}

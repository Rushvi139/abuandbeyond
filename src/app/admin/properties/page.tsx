import { redirect } from "next/navigation";

/** Properties became Partners (hotels and businesses with their own QR). */
export default function PropertiesPage() {
  redirect("/admin/partners");
}

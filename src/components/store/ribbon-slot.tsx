import { getBanners, splitBanners } from "@/lib/menu/queries";
import { TopRibbon, type Ribbon } from "./top-ribbon";

/** Fetches the live ribbon lines; safe to drop at the top of any guest page. */
export async function RibbonSlot() {
  const rows = await getBanners().catch(() => []);
  const { ribbons } = splitBanners(rows);
  return <TopRibbon ribbons={ribbons as Ribbon[]} />;
}

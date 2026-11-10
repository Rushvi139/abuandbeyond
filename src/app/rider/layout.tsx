/** Staff or personal screen: never in search results (robots.txt also blocks the crawl). */
export const metadata = { robots: { index: false, follow: false } };

export default function NoIndexLayout({ children }: { children: React.ReactNode }) {
  return children;
}

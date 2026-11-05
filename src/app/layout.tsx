import type { Metadata } from "next";
import "@fontsource/anton/400.css";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: "Abu & Beyond — Beyond the usual",
  description: "A global kitchen in the Aravalli hills. Order from Mount Abu.",
  icons: { icon: "/brand/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "@fontsource/anton/400.css";
import "@fontsource-variable/inter";
import "./globals.css";
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, OG_IMAGE, SITE_NAME, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // Pages that set a plain string title ("Help · Abu & Beyond") keep it as is;
  // the default is the one Google shows for the home page.
  title: { default: DEFAULT_TITLE, template: "%s" },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_IN",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Abu & Beyond — Mount Abu" }],
  },
  twitter: { card: "summary_large_image", title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION, images: [OG_IMAGE] },
  // Search Console "HTML tag" verification. Prefer the DNS record (covers the
  // whole domain); set GOOGLE_SITE_VERIFICATION only if using the tag method.
  ...(process.env.GOOGLE_SITE_VERIFICATION ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } } : {}),
  icons: {
    icon: [
      { url: "/brand/favicon.ico", sizes: "any" },
      { url: "/brand/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/brand/favicon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/brand/favicon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/brand/favicon-180.png", sizes: "180x180" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

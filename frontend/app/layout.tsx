import "@fontsource/cairo/arabic-700.css";
import "@fontsource/cairo/latin-700.css";
import "@fontsource/cairo/arabic-800.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-400.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-600.css";
import "@fontsource/ibm-plex-sans-arabic/latin-400.css";
import "@fontsource/ibm-plex-sans-arabic/latin-600.css";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import Providers from "@/components/Providers";
import { THEME_BOOT } from "@/lib/theme";

export const metadata: Metadata = { title: "أكاديمية سلام · Salam Academy", description: "Salam values-based learning platform", robots: { index: false, follow: false } };

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#F5F7F6" }, { media: "(prefers-color-scheme: dark)", color: "#0A1517" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} /></head>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}

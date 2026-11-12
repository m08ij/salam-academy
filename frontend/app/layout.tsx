import "@fontsource/cairo/arabic-700.css";
import "@fontsource/cairo/latin-700.css";
import "@fontsource/cairo/arabic-800.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-400.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-600.css";
import "@fontsource/ibm-plex-sans-arabic/latin-400.css";
import "@fontsource/ibm-plex-sans-arabic/latin-600.css";
import "./globals.css";
import type { Metadata } from "next";
import Providers from "@/components/Providers";

export const metadata: Metadata = { title: "أكاديمية سلام · Salam Academy", description: "Salam values-based learning platform", robots: { index: false, follow: false } };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}

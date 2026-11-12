"use client";
import { I18nProvider } from "@/lib/i18n";
import { SessionProvider } from "@/lib/session";
import { ThemeProvider } from "@/lib/theme";
import { ToastProvider } from "./ui";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <ThemeProvider><I18nProvider><SessionProvider><ToastProvider>{children}</ToastProvider></SessionProvider></I18nProvider></ThemeProvider>;
}

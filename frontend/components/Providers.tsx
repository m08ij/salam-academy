"use client";
import { I18nProvider } from "@/lib/i18n";
import { SessionProvider } from "@/lib/session";
import { ToastProvider } from "./ui";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <I18nProvider><SessionProvider><ToastProvider>{children}</ToastProvider></SessionProvider></I18nProvider>;
}

/**
 * Bridge to the Android app (Capacitor). The app loads this site remotely and injects window.Capacitor,
 * so no npm dependency is needed. Every call is a no-op in a normal browser.
 */
import { asset } from "./env";

type Plugin = Record<string, (arg?: any) => Promise<any>> & { addListener?: (ev: string, cb: (e: any) => void) => Promise<{ remove: () => void }> };

function cap(): any {
  return typeof window !== "undefined" ? (window as any).Capacitor : undefined;
}

export const isApp = (): boolean => !!cap()?.isNativePlatform?.();

function plugin(name: string): Plugin | null {
  return isApp() ? (cap()?.Plugins?.[name] as Plugin) ?? null : null;
}

/** Learner progress shown by the "My level" home-screen widget. */
export type WidgetProgress = {
  lang: "ar" | "en"; program: string; level: number; levels: number; levelTitle: string;
  done: number; total: number; final: number | null; eligible: boolean; graduated: boolean;
  path: string; next: { t: string; path: string } | null;
};

export async function pushWidget(p: WidgetProgress) {
  try { await plugin("WidgetBridge")?.update?.({ data: JSON.stringify({ ...p, at: Date.now() }) }); } catch {}
}
export async function clearWidget() {
  try { await plugin("WidgetBridge")?.clear?.(); } catch {}
}
export async function widgetLang(lang: "ar" | "en") {
  try { await plugin("WidgetBridge")?.setLang?.({ lang }); } catch {}
}
/** Asks the launcher to add a widget; resolves false when the launcher cannot pin (the user adds it by long-pressing the home screen). */
export async function pinWidget(type: "value" | "progress"): Promise<boolean> {
  try { return !!(await plugin("WidgetBridge")?.pin?.({ type }))?.requested; } catch { return false; }
}

/* ---------------- app updates ---------------- */
export type Release = { versionCode: number; versionName: string; url: string; sha256: string; notes?: { ar?: string[]; en?: string[] }; size?: number };

/** Newer release published on the site (apk/version.json), or null. */
export async function checkUpdate(): Promise<{ release: Release; installed: string } | null> {
  const up = plugin("AppUpdater");
  if (!up) return null;
  try {
    const [info, res] = await Promise.all([up.info(), fetch(asset("/apk/version.json"), { cache: "no-store" })]);
    if (!res.ok) return null;
    const rel = (await res.json()) as Release;
    return rel.versionCode > Number(info.versionCode) ? { release: { ...rel, url: new URL(rel.url, location.href).href }, installed: info.versionName } : null;
  } catch { return null; }
}

/** Downloads, verifies and opens the installer. onProgress gets 0–100. */
export async function installUpdate(rel: Release, onProgress: (pct: number) => void): Promise<"started" | "permission" | "failed"> {
  const up = plugin("AppUpdater");
  if (!up) return "failed";
  const sub = await up.addListener?.("progress", (e: any) => onProgress(Number(e?.pct) || 0));
  try {
    const r = await up.install({ url: rel.url, sha256: rel.sha256 });
    return r?.needsPermission ? "permission" : "started";
  } catch { return "failed"; } finally { sub?.remove(); }
}

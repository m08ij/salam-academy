"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark";
const KEY = "salam-theme";

/**
 * Runs inline in <head> before the page paints, so a saved theme never flashes the other one.
 * Without a saved choice the CSS follows the device (prefers-color-scheme).
 */
export const THEME_BOOT = `try{var t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

const Ctx = createContext<{ theme: Theme; toggle: (origin?: { x: number; y: number }) => void }>({ theme: "light", toggle: () => {} });

const resolved = (): Theme => {
  const a = document.documentElement.getAttribute("data-theme");
  if (a === "light" || a === "dark") return a;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(resolved());
    // Follow the device while the user has not chosen explicitly.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => { if (!document.documentElement.getAttribute("data-theme")) setTheme(resolved()); };
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const toggle = useCallback((origin?: { x: number; y: number }) => {
    const next: Theme = resolved() === "dark" ? "light" : "dark";
    const apply = () => {
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem(KEY, next); } catch {}
      setTheme(next);
    };
    const doc = document as any;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!doc.startViewTransition || reduce) { apply(); return; }
    // A circle grows from the button that was pressed (View Transitions API; other browsers just switch).
    const x = origin?.x ?? innerWidth / 2, y = origin?.y ?? 0;
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const vt = doc.startViewTransition(apply);
    vt.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 520, easing: "cubic-bezier(.2,.7,.2,1)", pseudoElement: "::view-transition-new(root)" } as any,
      );
    }).catch(() => {});
  }, []);

  return <Ctx.Provider value={{ theme, toggle }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);

"use client";
import { useEffect, useRef, useState } from "react";
import { num, type Lang } from "./i18n";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Fades [data-reveal] elements in as they scroll into view. Content stays visible without JS or with reduced motion:
 * the hidden state only applies once <html> has .js-motion. Pass a value that changes when new content renders.
 */
export function useReveal(dep?: unknown) {
  useEffect(() => {
    if (reduced() || !("IntersectionObserver" in window)) return;
    document.documentElement.classList.add("js-motion");
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    document.querySelectorAll("[data-reveal]:not(.in)").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [dep]);
  useEffect(() => () => document.documentElement.classList.remove("js-motion"), []);
}

/** A number that counts up (ease-out) the first time it becomes visible. Renders the final value until then. */
export function CountUp({ value, lang, duration = 1400 }: { value: number; lang: Lang; duration?: number }) {
  const ref = useRef<HTMLElement>(null);
  const [v, setV] = useState(value);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced() || !("IntersectionObserver" in window)) { setV(value); return; }
    let raf = 0;
    setV(0);
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const step = (t: number) => {
        const p = Math.min(1, (t - t0) / duration);
        setV(Math.round(value * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [value, duration]);
  return <b ref={ref}>{num(v, lang)}</b>;
}

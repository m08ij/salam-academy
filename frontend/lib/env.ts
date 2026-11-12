/**
 * Build-time switches.
 * - NEXT_PUBLIC_BASE_PATH: set when the site is served from a sub-path (GitHub Pages: "/salam-academy").
 * - NEXT_PUBLIC_DEMO=1: static preview with no API server. Public data comes from a JSON snapshot
 *   generated at build time; sign-in and every private endpoint are disabled.
 */
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
export const DEMO = process.env.NEXT_PUBLIC_DEMO === "1";
/** Prefix a file in /public with the base path (next/link does this itself; <img> and fetch do not). */
export const asset = (p: string) => BASE + p;

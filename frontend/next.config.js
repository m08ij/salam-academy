/** @type {import('next').NextConfig} */
const API = process.env.API_ORIGIN || "http://localhost:8000";
const isDev = process.env.NODE_ENV !== "production";
const csp = [
  "default-src 'self'",
  // Next.js dev (React Refresh) needs eval; production stays strict.
  isDev ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");
// DEPLOY_TARGET=pages → static preview for GitHub Pages (no server: no proxy, no response headers).
const PAGES = process.env.DEPLOY_TARGET === "pages";
const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

const server = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  async rewrites() {
    // The browser only ever talks to this origin; cookies stay first-party and SameSite works as intended.
    return [{ source: "/api/:path*", destination: `${API}/api/:path*` }];
  },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: csp },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "same-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        // HSTS only in production: on http://localhost it would pin the browser to HTTPS.
        ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      ],
    }];
  },
};

const pages = {
  reactStrictMode: true,
  output: "export",
  distDir: ".next-pages", // separate from the dev server's .next so both can run side by side
  basePath: base,
  trailingSlash: true,
  images: { unoptimized: true },
};

module.exports = PAGES ? pages : server;

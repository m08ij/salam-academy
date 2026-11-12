import { DEMO, asset } from "./env";

// Same-origin JSON client. Sends the session-bound CSRF token on every state-changing request.
export class ApiError extends Error {
  status: number;
  code: string;
  detail: any;
  constructor(status: number, detail: any) {
    super(typeof detail?.code === "string" ? detail.code : `http_${status}`);
    this.status = status;
    this.code = typeof detail?.code === "string" ? detail.code : `http_${status}`;
    this.detail = detail;
  }
}

function csrf(): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(/(?:^|;\s*)salam_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  if (DEMO) return demoApi<T>(path);
  const method = opts.method || (opts.body !== undefined ? "POST" : "GET");
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") headers["X-CSRF-Token"] = csrf();
  const res = await fetch(path.startsWith("/api") ? path : `/api${path}`, {
    method,
    headers,
    credentials: "same-origin",
    cache: "no-store",
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("application/json") ? await res.json() : await res.text();
  if (!res.ok) throw new ApiError(res.status, (data as any)?.detail ?? data);
  return data as T;
}

export const get = <T = any>(p: string) => api<T>(p);
export const post = <T = any>(p: string, body: unknown = {}) => api<T>(p, { method: "POST", body });
export const put = <T = any>(p: string, body: unknown) => api<T>(p, { method: "PUT", body });
export const patch = <T = any>(p: string, body: unknown) => api<T>(p, { method: "PATCH", body });
export const del = <T = any>(p: string) => api<T>(p, { method: "DELETE" });

export async function download(path: string, filename: string) {
  const res = await fetch(`/api${path}`, { credentials: "same-origin" });
  if (!res.ok) throw new ApiError(res.status, { code: "download_failed" });
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Static preview: only the public overview exists (as a JSON snapshot); everything else behaves as "signed out". */
async function demoApi<T>(path: string): Promise<T> {
  const p = path.replace(/^\/api/, "");
  if (p === "/public/overview") {
    const r = await fetch(asset("/demo/overview.json"));
    if (r.ok) return (await r.json()) as T;
  }
  if (p === "/auth/me") throw new ApiError(401, { code: "unauthenticated" });
  throw new ApiError(503, { code: "demo_mode" });
}

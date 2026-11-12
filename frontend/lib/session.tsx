"use client";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ApiError, get, post } from "./api";
import { clearWidget } from "./native";

export type Me = {
  id: string; email: string; name: string; locale: "ar" | "en"; role: "owner" | "admin" | "developer" | "trainer" | "trainee";
  mfa_enabled: boolean; mfa_passed: boolean; mfa_setup_required: boolean; must_change_password: boolean; permissions: string[];
  share_reflections: boolean; share_plan: boolean;
};

const Ctx = createContext<{ me: Me | null; loading: boolean; refresh: () => Promise<Me | null>; logout: () => Promise<void>; can: (p: string) => boolean }>(null as any);

const PUBLIC = ["/login", "/forgot", "/reset", "/accept-invite", "/verify", "/mfa"];

export function homeFor(me: Me): string {
  if (!me.mfa_passed && !me.mfa_setup_required) return "/mfa";
  if (me.mfa_setup_required) return "/account?force=mfa";
  if (me.must_change_password) return "/account?force=password";
  if (me.role === "trainee") return "/learn";
  if (me.permissions.includes("train")) return "/trainer";
  if (me.permissions.includes("users")) return "/admin";
  return "/admin/programs";
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const path = usePathname();
  const refresh = useCallback(async () => {
    try { const m = await get<Me>("/auth/me"); setMe(m); return m; }
    catch (e) { if (e instanceof ApiError && e.status === 401) { setMe(null); return null; } throw e; }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (loading) return;
    const isPublic = path === "/" || PUBLIC.some((p) => path.startsWith(p));
    if (!me && !isPublic) router.replace("/login");
    else if (me && !isPublic) {
      if (!me.mfa_passed && !me.mfa_setup_required && !path.startsWith("/mfa")) router.replace("/mfa");
      else if ((me.mfa_setup_required || me.must_change_password) && !path.startsWith("/account")) router.replace(homeFor(me));
    }
  }, [loading, me, path, router]);
  const logout = useCallback(async () => { try { await post("/auth/logout"); } catch {} clearWidget(); setMe(null); router.replace("/login"); }, [router]);
  const can = useCallback((p: string) => !!me?.permissions.includes(p), [me]);
  return <Ctx.Provider value={{ me, loading, refresh, logout, can }}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);

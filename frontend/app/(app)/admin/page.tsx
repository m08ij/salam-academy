"use client";
import { useCallback, useEffect, useState } from "react";
import { Guard } from "@/components/Shell";
import { Alert, ConfirmButton, Field, Head, useToast } from "@/components/ui";
import { get, patch, post } from "@/lib/api";
import { date, num, useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";

const ROLES_BY: Record<string, string[]> = { owner: ["admin", "developer", "trainer", "trainee"], admin: ["developer", "trainer", "trainee"] };

export default function Users() {
  const { t, lang, err } = useI18n();
  const { me, can } = useSession();
  const toast = useToast();
  const [users, setUsers] = useState<any[] | null>(null);
  const [ov, setOv] = useState<any>(null);
  const [inv, setInv] = useState({ email: "", name: "", role: "trainee", locale: "ar" });
  const [error, setError] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const roles = ROLES_BY[me?.role || ""] || [];
  const load = useCallback(async () => { setUsers(await get("/admin/users")); setOv(await get("/admin/overview")); }, []);
  useEffect(() => { load().catch((x) => setError(err(x))); }, [load, err]);
  const act = async (fn: () => Promise<any>) => { setError(null); try { await fn(); toast(t("saved")); await load(); } catch (x) { setError(err(x)); } };
  return (
    <Guard perm="users">
      <Head eyebrow={t("role_" + (me?.role || "admin"))} title={t("nav_users")} />
      {ov && <div className="grid g4">{[[ov.users, lang === "ar" ? "المستخدمون" : "Users"], [ov.trainees, t("trainees")], [ov.invited, t("s_invited")], [ov.staff_without_mfa, lang === "ar" ? "فريق بلا تحقق بخطوتين" : "Team without 2-step"]].map(([v, l]) => <div key={String(l)} className="card stat"><span className="v">{num(v, lang)}</span><span className="l">{l}</span></div>)}</div>}
      {error && <Alert>{error}</Alert>}
      <form className="card" onSubmit={(e) => { e.preventDefault(); setDevLink(null); act(async () => { const r = await post("/admin/users/invite", inv); setDevLink(r.dev_invite_link || null); setInv({ ...inv, email: "", name: "" }); }); }}>
        <h3>{t("invite")}</h3>
        <div className="fgrid g4f">
          <Field label={t("name")} id="in"><input className="inp" id="in" value={inv.name} onChange={(e) => setInv({ ...inv, name: e.target.value })} required minLength={2} /></Field>
          <Field label={t("email")} id="ie"><input className="inp" id="ie" type="email" value={inv.email} onChange={(e) => setInv({ ...inv, email: e.target.value })} required /></Field>
          <Field label={t("role")} id="ir"><select className="inp" id="ir" value={inv.role} onChange={(e) => setInv({ ...inv, role: e.target.value })}>{roles.map((r) => <option key={r} value={r}>{t("role_" + r)}</option>)}</select></Field>
          <Field label={t("language")} id="il"><select className="inp" id="il" value={inv.locale} onChange={(e) => setInv({ ...inv, locale: e.target.value })}><option value="ar">العربية</option><option value="en">English</option></select></Field>
        </div>
        <div className="row"><button className="btn pri" type="submit">{t("send")}</button><span className="tiny faint">{lang === "ar" ? "يصل للمدعو رابط لإنشاء كلمة مروره بنفسه؛ لا يرى أحد كلمات المرور." : "The invitee gets a link to set their own password; nobody else ever sees it."}</span></div>
        {devLink && <Alert kind="warn">DEV: <span dir="ltr">{devLink}</span></Alert>}
      </form>
      {users && <div className="tbl-wrap"><table><thead><tr><th>{t("name")}</th><th>{t("email")}</th><th>{t("role")}</th><th>{t("status")}</th><th>2FA</th><th>{t("lastActive")}</th><th /></tr></thead><tbody>
        {users.map((u) => {
          const locked = u.id === me?.id || u.role === "owner" || (u.role === "admin" && me?.role !== "owner");
          return <tr key={u.id}>
            <td><b>{u.name}</b></td><td className="small" dir="ltr">{u.email}</td>
            <td>{locked ? <span className="pill acc">{t("role_" + u.role)}</span> : <select className="inp sm" aria-label={t("role")} value={u.role} disabled={!can("roles")} onChange={(e) => act(() => patch(`/admin/users/${u.id}`, { role: e.target.value }))}>{[u.role, ...roles.filter((r) => r !== u.role)].map((r) => <option key={r} value={r}>{t("role_" + r)}</option>)}</select>}</td>
            <td><span className={`pill ${u.status === "active" ? "ok" : u.status === "invited" ? "info" : "warn"}`}>{t("s_" + u.status)}</span>{u.locked && <span className="pill bad">🔒</span>}</td>
            <td>{u.mfa_enabled ? "✓" : "—"}</td><td className="small">{date(u.last_login_at, lang)}</td>
            <td>{!locked && <div className="row">
              {u.status === "active" && <ConfirmButton className="btn sm danger" onConfirm={() => act(() => patch(`/admin/users/${u.id}`, { status: "suspended" }))}>{t("suspend")}</ConfirmButton>}
              {u.status === "suspended" && <button className="btn sm" type="button" onClick={() => act(() => patch(`/admin/users/${u.id}`, { status: "active" }))}>{t("activate")}</button>}
              {u.status === "invited" && <button className="btn sm" type="button" onClick={() => act(() => post(`/admin/users/${u.id}/resend-invite`))}>{t("resend")}</button>}
              {u.status === "active" && <ConfirmButton className="btn sm" onConfirm={() => act(() => post(`/admin/users/${u.id}/force-reset`))}>{t("forceReset")}</ConfirmButton>}
              {u.mfa_enabled && can("roles") && <ConfirmButton className="btn sm" onConfirm={() => act(() => post(`/admin/users/${u.id}/reset-mfa`))}>{t("resetMfa")}</ConfirmButton>}
              {u.locked && <button className="btn sm" type="button" onClick={() => act(() => post(`/admin/users/${u.id}/unlock`))}>{t("unlock")}</button>}
            </div>}</td></tr>;
        })}</tbody></table></div>}
    </Guard>
  );
}

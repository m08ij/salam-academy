"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Icon from "@/components/icons";
import { Guard } from "@/components/Shell";
import { Alert, Avatar, ConfirmButton, Drawer, Empty, Field, Head, Menu, Stats, useToast } from "@/components/ui";
import { get, patch, post } from "@/lib/api";
import { date, num, useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";

const ROLES_BY: Record<string, string[]> = { owner: ["admin", "developer", "trainer", "trainee"], admin: ["developer", "trainer", "trainee"] };
const ROLE_TONE: Record<string, string> = { owner: "gold", admin: "acc", developer: "info", trainer: "ok", trainee: "" };

export default function Users() {
  const { t, L, lang, err } = useI18n();
  const { me, can } = useSession();
  const toast = useToast();
  const [users, setUsers] = useState<any[] | null>(null);
  const [ov, setOv] = useState<any>(null);
  const [inv, setInv] = useState({ email: "", name: "", role: "trainee", locale: "ar" });
  const [error, setError] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [shared, setShared] = useState<{ name: string; link: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [roleF, setRoleF] = useState("all");
  const roles = ROLES_BY[me?.role || ""] || [];
  const load = useCallback(async () => { setUsers(await get("/admin/users")); setOv(await get("/admin/overview")); }, []);
  useEffect(() => { load().catch((x) => setError(err(x))); }, [load, err]);
  const act = async (fn: () => Promise<any>) => { setError(null); try { await fn(); toast(t("saved")); await load(); } catch (x) { setError(err(x)); } };
  const close = useCallback(() => { setOpen(false); setDevLink(null); }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: users?.length || 0 };
    for (const u of users || []) c[u.role] = (c[u.role] || 0) + 1;
    return c;
  }, [users]);
  const shown = (users || []).filter((u) => (roleF === "all" || u.role === roleF) && (!q.trim() || `${u.name} ${u.email}`.toLowerCase().includes(q.trim().toLowerCase())));

  return (
    <Guard perm="users">
      <Head icon="users" eyebrow={t("role_" + (me?.role || "admin"))} title={t("nav_users")}
        sub={L(["ادعُ الفريق والمتدربين، وأدِر أدوارهم وحالات حساباتهم.", "Invite your team and trainees, and manage their roles and accounts."])}
        right={<button className="btn pri" type="button" onClick={() => setOpen(true)}><Icon name="plus" />{t("invite")}</button>} />

      <Stats items={[
        { icon: "users", value: ov?.users, label: L(["المستخدمون", "Users"]), tone: "acc" },
        { icon: "people", value: ov?.trainees, label: t("trainees"), tone: "ok" },
        { icon: "mail", value: ov?.invited, label: t("s_invited"), tone: "info" },
        { icon: "lock", value: ov?.staff_without_mfa, label: L(["فريق بلا تحقق بخطوتين", "Team without 2-step"]), tone: ov?.staff_without_mfa ? "bad" : "ok" },
      ]} />
      {error && <Alert>{error}</Alert>}
      {shared && <ShareLink title={L([`رابط دعوة ${shared.name}`, `Invite link for ${shared.name}`])} link={shared.link} onClose={() => setShared(null)} />}

      <div className="toolbar">
        <label className="search"><Icon name="search" /><input className="inp" placeholder={L(["ابحث بالاسم أو البريد…", "Search by name or e-mail…"])} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t("search")} /></label>
        <div className="chips" role="group" aria-label={t("role")}>
          {["all", "owner", "admin", "developer", "trainer", "trainee"].filter((r) => r === "all" || counts[r]).map((r) => (
            <button key={r} type="button" className="chip" aria-pressed={roleF === r} onClick={() => setRoleF(r)}>{r === "all" ? L(["الكل", "All"]) : t("role_" + r)}<span className="n">{num(counts[r] || 0, lang)}</span></button>
          ))}
        </div>
      </div>

      {users === null ? <div className="stack"><div className="skel" style={{ height: 60 }} /><div className="skel" style={{ height: 60 }} /></div>
        : shown.length === 0 ? <Empty icon="users">{L(["لا نتائج مطابقة.", "No matching results."])}</Empty> :
        <div className="tbl-wrap cards"><table>
          <thead><tr><th>{t("name")}</th><th>{t("role")}</th><th>{t("status")}</th><th>{L(["التحقق بخطوتين", "2-step"])}</th><th>{t("lastActive")}</th><th /></tr></thead>
          <tbody>{shown.map((u) => {
            const locked = u.id === me?.id || u.role === "owner" || (u.role === "admin" && me?.role !== "owner");
            return (
              <tr key={u.id}>
                <td className="lead"><span className="who-cell"><Avatar name={u.name} /><div><b>{u.name}{u.id === me?.id && <span className="tiny faint"> · {L(["أنت", "you"])}</span>}</b><span className="tiny faint" dir="ltr" style={{ textAlign: "start" }}>{u.email}</span></div></span></td>
                <td data-label={t("role")}>{locked || !can("roles") ? <span className={`pill ${ROLE_TONE[u.role]}`}>{t("role_" + u.role)}</span> :
                  <select className="inp sm" aria-label={t("role")} value={u.role} onChange={(e) => act(() => patch(`/admin/users/${u.id}`, { role: e.target.value }))}>{[u.role, ...roles.filter((r) => r !== u.role)].map((r) => <option key={r} value={r}>{t("role_" + r)}</option>)}</select>}</td>
                <td data-label={t("status")}><span className={`pill ${u.status === "active" ? "ok" : u.status === "invited" ? "info" : "warn"}`}>{t("s_" + u.status)}</span>{u.locked && <span className="pill bad" title={t("unlock")}>🔒</span>}</td>
                <td data-label={L(["التحقق بخطوتين", "2-step"])}>{u.mfa_enabled ? <span className="pill ok">✓ {L(["مفعّل", "On"])}</span> : <span className="pill">{L(["غير مفعّل", "Off"])}</span>}</td>
                <td data-label={t("lastActive")} className="small faint">{date(u.last_login_at, lang)}</td>
                <td>{!locked && (
                  <Menu label={L(["إجراءات", "Actions"])}>
                    {u.status === "invited" && <button className="btn" type="button" onClick={() => act(async () => { const r = await post(`/admin/users/${u.id}/resend-invite`); if (r?.invite_link) { setShared({ name: u.name, link: r.invite_link }); } })}><Icon name="mail" />{t("resend")}</button>}
                    {u.status === "suspended" && <button className="btn" type="button" onClick={() => act(() => patch(`/admin/users/${u.id}`, { status: "active" }))}><Icon name="check" />{t("activate")}</button>}
                    {u.locked && <button className="btn" type="button" onClick={() => act(() => post(`/admin/users/${u.id}/unlock`))}><Icon name="lock" />{t("unlock")}</button>}
                    {u.status === "active" && <ConfirmButton className="btn" onConfirm={() => act(() => post(`/admin/users/${u.id}/force-reset`))}>{t("forceReset")}</ConfirmButton>}
                    {u.mfa_enabled && can("roles") && <ConfirmButton className="btn" onConfirm={() => act(() => post(`/admin/users/${u.id}/reset-mfa`))}>{t("resetMfa")}</ConfirmButton>}
                    {u.status === "active" && <ConfirmButton className="btn danger" onConfirm={() => act(() => patch(`/admin/users/${u.id}`, { status: "suspended" }))}>{t("suspend")}</ConfirmButton>}
                  </Menu>
                )}</td>
              </tr>
            );
          })}</tbody></table></div>}

      <Drawer open={open} onClose={close} title={t("invite")}>
        <form className="stack" onSubmit={(e) => { e.preventDefault(); setDevLink(null); act(async () => { const r = await post("/admin/users/invite", inv); setDevLink(r.invite_link || null); setInv({ ...inv, email: "", name: "" }); }); }}>
          <p className="small muted">{L(["يصل للمدعو رابط لإنشاء كلمة مروره بنفسه؛ لا يرى أحد كلمات المرور.", "The invitee gets a link to set their own password; nobody else ever sees it."])}</p>
          <Field label={t("name")} id="in"><input className="inp" id="in" value={inv.name} onChange={(e) => setInv({ ...inv, name: e.target.value })} required minLength={2} autoFocus /></Field>
          <Field label={t("email")} id="ie"><input className="inp" id="ie" type="email" dir="ltr" value={inv.email} onChange={(e) => setInv({ ...inv, email: e.target.value })} required /></Field>
          <Field label={t("role")} id="ir">
            <div className="chips">{roles.map((r) => <button key={r} type="button" className="chip" aria-pressed={inv.role === r} onClick={() => setInv({ ...inv, role: r })}>{t("role_" + r)}</button>)}</div>
          </Field>
          <Field label={t("language")} id="il">
            <div className="chips">{[["ar", "العربية"], ["en", "English"]].map(([k, l]) => <button key={k} type="button" className="chip" aria-pressed={inv.locale === k} onClick={() => setInv({ ...inv, locale: k })}>{l}</button>)}</div>
          </Field>
          {error && <Alert>{error}</Alert>}
          <button className="btn pri lg block" type="submit"><Icon name="mail" />{t("send")}</button>
          {devLink && <ShareLink title={L(["تمت الدعوة — انسخ الرابط وأرسله للمدعو", "Invited — copy the link and send it to them"])} link={devLink} />}
        </form>
      </Drawer>
    </Guard>
  );
}

/** Invite link to hand over manually (hosts without e-mail). The link is single-use and expires. */
function ShareLink({ title, link, onClose }: { title: string; link: string; onClose?: () => void }) {
  const { L } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <div className="share-link" role="status">
      <div className="row between"><b>{title}</b>{onClose && <button type="button" className="iconbtn" onClick={onClose} aria-label="close"><Icon name="close" /></button>}</div>
      <code dir="ltr">{link}</code>
      <div className="row">
        <button type="button" className="btn pri sm" onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {} }}>
          <Icon name={copied ? "check" : "enroll"} />{copied ? L(["تم النسخ", "Copied"]) : L(["انسخ الرابط", "Copy link"])}</button>
        <a className="btn sm" href={`https://wa.me/?text=${encodeURIComponent(link)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
      </div>
      <span className="tiny faint">{L(["الرابط لمرة واحدة وصالح ٧٢ ساعة. أرسله للشخص نفسه فقط.", "Single-use, valid for 72 hours. Send it only to that person."])}</span>
    </div>
  );
}

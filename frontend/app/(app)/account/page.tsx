"use client";
import QRCode from "qrcode";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Alert, ConfirmButton, Field, Head, PasswordFields, useToast } from "@/components/ui";
import { del, get, post, put } from "@/lib/api";
import { date, useI18n } from "@/lib/i18n";
import { homeFor, useSession } from "@/lib/session";

function MfaSetup({ onDone }: { onDone: (codes: string[]) => void }) {
  const { t, err } = useI18n();
  const [s, setS] = useState<{ secret: string; otpauth_uri: string } | null>(null);
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  return !s ? <button className="btn pri" type="button" onClick={async () => { try { const r = await post("/me/mfa/setup"); setS(r); setQr(await QRCode.toDataURL(r.otpauth_uri, { margin: 1, width: 200 })); } catch (x) { setError(err(x)); } }}>{t("enableMfa")}</button> :
    <form className="stack" onSubmit={async (e) => { e.preventDefault(); setError(null); try { const r = await post("/me/mfa/confirm", { code }); onDone(r.recovery_codes); } catch (x) { setError(err(x)); setCode(""); } }}>
      <p className="small">{t("scanQr")}</p>
      {qr && <img src={qr} alt="QR" width={200} height={200} style={{ background: "#fff", padding: 8, borderRadius: 8 }} />}
      <details><summary className="small">{t("manualKey")}</summary><code dir="ltr" style={{ wordBreak: "break-all" }}>{s.secret}</code></details>
      {error && <Alert>{error}</Alert>}
      <Field label={t("mfaCode")} id="mc"><input className="inp" id="mc" inputMode="numeric" autoComplete="one-time-code" maxLength={6} dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} required /></Field>
      <button className="btn pri" type="submit">{t("continue")}</button>
    </form>;
}

function Codes({ codes }: { codes: string[] }) {
  const { t } = useI18n();
  return <Alert kind="warn"><b>{t("recoveryCodes")}</b><p className="small">{t("recoveryHint")}</p><div className="codes">{codes.map((c) => <span key={c}>{c}</span>)}</div></Alert>;
}

function Inner() {
  const { t, lang, err } = useI18n();
  const { me, refresh, logout } = useSession();
  const force = useSearchParams().get("force");
  const router = useRouter();
  const toast = useToast();
  const [codes, setCodes] = useState<string[] | null>(null);
  const [cur, setCur] = useState(""); const [pw, setPw] = useState(""); const [rep, setRep] = useState("");
  const [sessions, setSessions] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirmPw, setConfirmPw] = useState("");
  const [deletePw, setDeletePw] = useState("");
  const loadSessions = useCallback(() => { if (me?.mfa_passed && !me.must_change_password && !me.mfa_setup_required) get("/me/sessions").then(setSessions).catch(() => {}); }, [me]);
  useEffect(() => { loadSessions(); }, [loadSessions]);
  if (!me) return null;
  const A = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const act = async (fn: () => Promise<any>, ok = t("saved")) => { setError(null); try { const r = await fn(); toast(ok); await refresh(); loadSessions(); return r; } catch (x) { setError(err(x)); } };
  const forcedMfa = force === "mfa" && me.mfa_setup_required;
  const forcedPw = force === "password" && me.must_change_password;
  return (
    <>
      <Head eyebrow={t("role_" + me.role)} title={t("nav_account")} sub={me.email} />
      {forcedMfa && <Alert kind="warn">{t("mfaSetupForced")}</Alert>}
      {forcedPw && <Alert kind="warn">{t("pwChangeForced")}</Alert>}
      {error && <Alert>{error}</Alert>}
      {codes && <><Codes codes={codes} />{(forcedMfa || force === "mfa") && <button className="btn pri" type="button" onClick={async () => { const m = await refresh(); setCodes(null); if (m) router.replace(homeFor(m)); }}>{t("continue")}</button>}</>}
      <div className="grid g2">
        <div className="card"><h3>{t("mfaTitle")}</h3>
          {me.mfa_enabled ? <><span className="pill ok">✓ {t("mfaOn")}</span>
            {!forcedPw && <form className="stack" onSubmit={async (e) => { e.preventDefault(); const r = await act(() => post("/me/mfa/recovery-codes", { password: confirmPw })); if (r) setCodes(r.recovery_codes); setConfirmPw(""); }}>
              <Field label={t("password")} id="cp"><input className="inp" id="cp" type="password" autoComplete="current-password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required /></Field>
              <button className="btn" type="submit">{t("regenCodes")}</button></form>}
            {me.role !== "trainee" && <p className="tiny faint">{t("mfaRequiredStaff")}</p>}</> :
            <><span className="pill warn">{t("mfaOff")}</span><MfaSetup onDone={async (c) => { setCodes(c); await refresh(); }} /></>}
        </div>
        {!forcedMfa && <form className="card" onSubmit={async (e) => {
          e.preventDefault(); if (pw !== rep) { setError(t("pwMismatch")); return; }
          const r = await act(() => post("/me/password", { current: cur, new: pw }));
          if (r) { setCur(""); setPw(""); setRep(""); if (forcedPw) { const m = await refresh(); if (m) router.replace(homeFor(m)); } }
        }}>
          <h3>{t("changePassword")}</h3>
          <Field label={t("currentPassword")} id="cur"><input className="inp" id="cur" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} required /></Field>
          <PasswordFields value={pw} setValue={setPw} repeat={rep} setRepeat={setRep} />
          <button className="btn pri" type="submit">{t("save")}</button>
        </form>}
      </div>
      {!forcedMfa && !forcedPw && <>
        <div className="card"><div className="row between"><h3>{t("sessions")}</h3><button className="btn sm" type="button" onClick={() => act(() => post("/me/sessions/revoke-others"))}>{t("revokeOthers")}</button></div>
          <div className="tbl-wrap"><table><tbody>{sessions.map((s) => <tr key={s.id}><td className="small" dir="ltr">{(s.user_agent || "").slice(0, 70)}</td><td className="small" dir="ltr">{s.ip}</td><td className="small">{date(s.last_seen_at, lang)}</td>
            <td>{s.current ? <span className="pill acc">{t("thisDevice")}</span> : <button className="btn sm" type="button" onClick={() => act(() => del(`/me/sessions/${s.id}`))}>{t("revoke")}</button>}</td></tr>)}</tbody></table></div></div>
        {me.role === "trainee" && <div className="card"><h3>{t("privacy")}</h3>
          <label className="row"><input type="checkbox" checked={me.share_reflections} onChange={(e) => act(() => put("/me/privacy", { share_reflections: e.target.checked, share_plan: me.share_plan }))} /> {t("shareRefl")}</label>
          <label className="row"><input type="checkbox" checked={me.share_plan} onChange={(e) => act(() => put("/me/privacy", { share_reflections: me.share_reflections, share_plan: e.target.checked }))} /> {t("sharePlan")}</label>
          <p className="tiny faint">{A("بدون مشاركة لا يرى تأملاتك وخطتك أحد غيرك. تقدّمك في الدروس ومشاريعك يراها مدربك ومسؤولو المنصة.", "Without sharing, nobody but you sees your reflections and plan. Your trainer and admins see lesson progress and projects.")}</p></div>}
        <div className="card"><h3>{A("بياناتي", "My data")}</h3>
          <div className="row"><button className="btn" type="button" onClick={async () => { const d = await get("/me/export"); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 1)], { type: "application/json" })); a.download = "my-salam-data.json"; a.click(); }}>{t("exportData")}</button></div>
          {me.role !== "owner" && <form className="stack" onSubmit={(e) => e.preventDefault()}><p className="tiny faint">{t("deleteHint")}</p>
            <Field label={t("password")} id="dp"><input className="inp" id="dp" type="password" autoComplete="current-password" value={deletePw} onChange={(e) => setDeletePw(e.target.value)} /></Field>
            <ConfirmButton disabled={!deletePw} onConfirm={async () => { const r = await act(() => post("/me/delete", { password: deletePw })); if (r) logout(); }}>{t("deleteAccount")}</ConfirmButton></form>}
        </div>
      </>}
    </>
  );
}

export default function Account() { return <Suspense><Inner /></Suspense>; }

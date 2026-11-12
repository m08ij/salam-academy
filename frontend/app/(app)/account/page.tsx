"use client";
import QRCode from "qrcode";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Alert, Avatar, ConfirmButton, Field, PasswordFields, Tabs, useToast } from "@/components/ui";
import Icon from "@/components/icons";
import { del, get, post, put } from "@/lib/api";
import { date, num, useI18n } from "@/lib/i18n";
import { homeFor, useSession } from "@/lib/session";
import { isApp, pinWidget } from "@/lib/native";

/** Android app only: add the home-screen widgets. */
function AppWidgets() {
  const { L } = useI18n();
  const toast = useToast();
  const [app, setApp] = useState(false);
  useEffect(() => setApp(isApp()), []);
  if (!app) return null;
  const add = async (type: "value" | "progress") => {
    if (!(await pinWidget(type))) toast(L(["اضغط مطوّلًا على الشاشة الرئيسية ← الأدوات (Widgets) ← أكاديمية سلام.", "Long-press your home screen → Widgets → Salam Academy."]));
  };
  return (
    <div className="card">
      <h3>{L(["أدوات الشاشة الرئيسية", "Home-screen widgets"])}</h3>
      <p className="small muted">{L(["أضف «قيمة اليوم» لتذكّرك بقيمة وسلوك كل يوم (تعمل دون اتصال)، و«مستواي» لترى تقدّمك والدرس التالي.", "Add “Value of the day” for a daily value and behavior (works offline), and “My level” to see your progress and next lesson."])}</p>
      <div className="row">
        <button type="button" className="btn" onClick={() => add("value")}>{L(["أضف «قيمة اليوم»", "Add “Value of the day”"])}</button>
        <button type="button" className="btn" onClick={() => add("progress")}>{L(["أضف «مستواي»", "Add “My level”"])}</button>
      </div>
    </div>
  );
}

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

type AccTab = "security" | "privacy" | "data";

/** "Chrome · Windows" style label from a user agent, without showing the raw string. */
function device(ua: string | null) {
  const u = ua || "";
  const b = /Edg\//.test(u) ? "Edge" : /Chrome\//.test(u) ? "Chrome" : /Firefox\//.test(u) ? "Firefox" : /Safari\//.test(u) ? "Safari" : "Browser";
  const o = /Android/.test(u) ? "Android" : /iPhone|iPad/.test(u) ? "iOS" : /Windows/.test(u) ? "Windows" : /Mac OS/.test(u) ? "macOS" : /Linux/.test(u) ? "Linux" : "";
  return o ? `${b} · ${o}` : b;
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
  const [tab, setTab] = useState<AccTab>("security");
  const loadSessions = useCallback(() => { if (me?.mfa_passed && !me.must_change_password && !me.mfa_setup_required) get("/me/sessions").then(setSessions).catch(() => {}); }, [me]);
  useEffect(() => { loadSessions(); }, [loadSessions]);
  if (!me) return null;
  const A = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const act = async (fn: () => Promise<any>, ok = t("saved")) => { setError(null); try { const r = await fn(); toast(ok); await refresh(); loadSessions(); return r; } catch (x) { setError(err(x)); } };
  const forcedMfa = force === "mfa" && me.mfa_setup_required;
  const forcedPw = force === "password" && me.must_change_password;
  const score = (me.mfa_enabled ? 50 : 0) + 30 + (sessions.length <= 2 ? 20 : 10);
  return (
    <>
      <div className="acc-hero">
        <Avatar name={me.name} size={64} />
        <div className="acc-who"><b>{me.name}</b><span dir="ltr">{me.email}</span><span className="pill acc">{t("role_" + me.role)}</span></div>
        <div className="acc-score" title={A("مستوى أمان حسابك", "Your account security")}>
          <div className="acc-ring" style={{ ["--p" as any]: `${score}%` }}><b>{num(score, lang)}٪</b></div>
          <span className="tiny">{A("أمان الحساب", "Security")}</span>
        </div>
      </div>
      {forcedMfa && <Alert kind="warn">{t("mfaSetupForced")}</Alert>}
      {forcedPw && <Alert kind="warn">{t("pwChangeForced")}</Alert>}
      {error && <Alert>{error}</Alert>}
      {codes && <><Codes codes={codes} />{(forcedMfa || force === "mfa") && <button className="btn pri" type="button" onClick={async () => { const m = await refresh(); setCodes(null); if (m) router.replace(homeFor(m)); }}>{t("continue")}</button>}</>}
      {!forcedMfa && !forcedPw && <Tabs<AccTab> value={tab} onChange={setTab} tabs={[["security", A("الأمان", "Security")], ...(me.role === "trainee" ? [["privacy", A("الخصوصية", "Privacy")] as [AccTab, string]] : []), ["data", A("بياناتي", "My data")]]} />}

      {(tab === "security" || forcedMfa || forcedPw) && <>
        <div className="grid g2">
          <div className="card acc-card">
            <div className="acc-ch"><span className="acc-ic"><Icon name="lock" /></span><div><h3>{t("mfaTitle")}</h3><p className="tiny faint">{A("رمز من تطبيق على هاتفك مع كلمة المرور.", "A code from an app on your phone, plus your password.")}</p></div>
              {me.mfa_enabled ? <span className="pill ok">✓ {t("mfaOn")}</span> : <span className="pill warn">{t("mfaOff")}</span>}</div>
            {me.mfa_enabled ? <>
              {!forcedPw && <form className="stack" onSubmit={async (e) => { e.preventDefault(); const r = await act(() => post("/me/mfa/recovery-codes", { password: confirmPw })); if (r) setCodes(r.recovery_codes); setConfirmPw(""); }}>
                <Field label={t("password")} id="cp"><input className="inp" id="cp" type="password" autoComplete="current-password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required /></Field>
                <button className="btn" type="submit">{t("regenCodes")}</button></form>}
              {me.role !== "trainee" && <p className="tiny faint">{t("mfaRequiredStaff")}</p>}</> :
              <MfaSetup onDone={async (c) => { setCodes(c); await refresh(); }} />}
          </div>
          {!forcedMfa && <form className="card acc-card" onSubmit={async (e) => {
            e.preventDefault(); if (pw !== rep) { setError(t("pwMismatch")); return; }
            const r = await act(() => post("/me/password", { current: cur, new: pw }));
            if (r) { setCur(""); setPw(""); setRep(""); if (forcedPw) { const m = await refresh(); if (m) router.replace(homeFor(m)); } }
          }}>
            <div className="acc-ch"><span className="acc-ic"><Icon name="settings" /></span><div><h3>{t("changePassword")}</h3><p className="tiny faint">{A("تُسجَّل خارج الأجهزة الأخرى بعد التغيير.", "Other devices are signed out after a change.")}</p></div></div>
            <Field label={t("currentPassword")} id="cur"><input className="inp" id="cur" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} required /></Field>
            <PasswordFields value={pw} setValue={setPw} repeat={rep} setRepeat={setRep} />
            <button className="btn pri" type="submit">{t("save")}</button>
          </form>}
        </div>
        {!forcedMfa && !forcedPw && <div className="card acc-card">
          <div className="acc-ch"><span className="acc-ic"><Icon name="globe" /></span><div><h3>{t("sessions")}</h3><p className="tiny faint">{A("الأجهزة المسجّل دخولها الآن إلى حسابك.", "Devices signed in to your account now.")}</p></div>
            {sessions.length > 1 && <button className="btn sm" type="button" onClick={() => act(() => post("/me/sessions/revoke-others"))}>{t("revokeOthers")}</button>}</div>
          <ul className="acc-sessions">{sessions.map((s) => (
            <li key={s.id}><span className="acc-dev"><Icon name={/Mobile|Android|iPhone/i.test(s.user_agent || "") ? "account" : "programs"} /></span>
              <div><b>{device(s.user_agent)}</b><span className="tiny faint">{date(s.last_seen_at, lang)}</span></div>
              {s.current ? <span className="pill acc">{t("thisDevice")}</span> : <button className="btn sm" type="button" onClick={() => act(() => del(`/me/sessions/${s.id}`))}>{t("revoke")}</button>}</li>))}</ul>
        </div>}
      </>}

      {tab === "privacy" && me.role === "trainee" && !forcedMfa && !forcedPw && <div className="card acc-card">
        <div className="acc-ch"><span className="acc-ic"><Icon name="people" /></span><div><h3>{t("privacy")}</h3><p className="tiny faint">{A("بدون مشاركة لا يرى تأملاتك وخطتك أحد غيرك. تقدّمك في الدروس يراه مدربك.", "Without sharing, nobody but you sees your reflections and plan. Your trainer sees lesson progress.")}</p></div></div>
        <label className="switch-row"><span>{t("shareRefl")}</span><input type="checkbox" className="switch" checked={me.share_reflections} onChange={(e) => act(() => put("/me/privacy", { share_reflections: e.target.checked, share_plan: me.share_plan }))} /></label>
        <label className="switch-row"><span>{t("sharePlan")}</span><input type="checkbox" className="switch" checked={me.share_plan} onChange={(e) => act(() => put("/me/privacy", { share_reflections: me.share_reflections, share_plan: e.target.checked }))} /></label>
      </div>}

      {tab === "data" && !forcedMfa && !forcedPw && <>
        <AppWidgets />
        <div className="card acc-card">
          <div className="acc-ch"><span className="acc-ic"><Icon name="enroll" /></span><div><h3>{t("exportData")}</h3><p className="tiny faint">{A("نسخة من بياناتك بصيغة JSON.", "A copy of your data as JSON.")}</p></div>
            <button className="btn" type="button" onClick={async () => { const d = await get("/me/export"); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 1)], { type: "application/json" })); a.download = "my-salam-data.json"; a.click(); }}>{A("تنزيل", "Download")}</button></div>
        </div>
        {me.role !== "owner" && <form className="card acc-card danger-zone" onSubmit={(e) => e.preventDefault()}>
          <div className="acc-ch"><span className="acc-ic"><Icon name="close" /></span><div><h3>{t("deleteAccount")}</h3><p className="tiny faint">{t("deleteHint")}</p></div></div>
          <Field label={t("password")} id="dp"><input className="inp" id="dp" type="password" autoComplete="current-password" value={deletePw} onChange={(e) => setDeletePw(e.target.value)} /></Field>
          <ConfirmButton disabled={!deletePw} onConfirm={async () => { const r = await act(() => post("/me/delete", { password: deletePw })); if (r) logout(); }}>{t("deleteAccount")}</ConfirmButton></form>}
      </>}
    </>
  );
}

export default function Account() { return <Suspense><Inner /></Suspense>; }

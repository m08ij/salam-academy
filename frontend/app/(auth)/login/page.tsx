"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, Field } from "@/components/ui";
import { get, post } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { homeFor, useSession } from "@/lib/session";
import { DEMO } from "@/lib/env";

export default function Login() {
  const { t, err } = useI18n();
  const { refresh } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [trial, setTrial] = useState(false);
  useEffect(() => { get<{ trial: boolean }>("/public/config").then((c) => setTrial(!!c.trial)).catch(() => {}); }, []);
  return (
    <form className="stack" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setError(null);
      try { await post("/auth/login", { email, password }); const me = await refresh(); if (me) router.replace(homeFor(me)); }
      catch (x) { setError(err(x)); setPassword(""); } finally { setBusy(false); }
    }}>
      <div className="stack" style={{ gap: 4 }}><h1>{t("signIn")}</h1><p className="muted small">{t("signInSub")}</p></div>
      {trial && <div className="trial-note" role="note"><b>{t("trialTitle")}</b><span>{t("trialNote")}</span></div>}
      {error && <Alert>{error}</Alert>}
      <Field label={t("email")} id="email"><input className="inp" id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
      <Field label={t("password")} id="password"><input className="inp" id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
      <div className="row between" style={{ marginTop: -4 }}><span /><Link href="/forgot" className="small">{t("forgot")}</Link></div>
      <button className="btn pri lg block" type="submit" disabled={busy || DEMO}>{busy ? t("loading") : t("signIn")}</button>
      <p className="tiny faint" style={{ textAlign: "center" }}>{t("inviteOnly")}</p>
    </form>
  );
}

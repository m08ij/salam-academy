"use client";
import Link from "next/link";
import { useState } from "react";
import { Alert, Field } from "@/components/ui";
import { post } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function Forgot() {
  const { t, err } = useI18n();
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form className="stack" onSubmit={async (e) => { e.preventDefault(); setError(null); try { await post("/auth/forgot", { email }); setDone(true); } catch (x) { setError(err(x)); } }}>
      <h1>{t("forgotTitle")}</h1>
      {done ? <Alert kind="ok">{t("forgotDone")}</Alert> : <>
        {error && <Alert>{error}</Alert>}
        <Field label={t("email")} id="email"><input className="inp" id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
        <button className="btn pri" type="submit">{t("send")}</button></>}
      <Link href="/login" className="small">{t("signIn")}</Link>
    </form>
  );
}

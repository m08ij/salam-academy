"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Field } from "@/components/ui";
import { post } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { homeFor, useSession } from "@/lib/session";

export default function Mfa() {
  const { t, err } = useI18n();
  const { refresh, logout } = useSession();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form className="stack" onSubmit={async (e) => {
      e.preventDefault(); setError(null);
      try { await post("/auth/mfa", recovery ? { recovery_code: code } : { code }); const me = await refresh(); if (me) router.replace(homeFor(me)); }
      catch (x) { setError(err(x)); setCode(""); }
    }}>
      <h1>{t("mfaTitle")}</h1>
      {error && <Alert>{error}</Alert>}
      <Field label={recovery ? t("recoveryCode") : t("mfaCode")} id="code">
        <input className="inp" id="code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" inputMode={recovery ? "text" : "numeric"} maxLength={recovery ? 11 : 6} required autoFocus dir="ltr" />
      </Field>
      <button className="btn pri" type="submit">{t("continue")}</button>
      <div className="row between">
        <button type="button" className="btn ghost sm" onClick={() => { setRecovery(!recovery); setCode(""); }}>{recovery ? t("useApp") : t("useRecovery")}</button>
        <button type="button" className="btn ghost sm" onClick={logout}>{t("signOut")}</button>
      </div>
    </form>
  );
}

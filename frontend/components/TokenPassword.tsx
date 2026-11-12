"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Alert, PasswordFields } from "@/components/ui";
import { post } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

/** Shared form for password reset and invitation acceptance. The token travels only in the URL the user received by e-mail. */
export default function TokenPassword({ endpoint, titleKey, doneKey = "resetDone" }: { endpoint: string; titleKey: string; doneKey?: string }) {
  const { t, err } = useI18n();
  const token = useSearchParams().get("token") || "";
  const [pw, setPw] = useState("");
  const [rep, setRep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  return (
    <form className="stack" onSubmit={async (e) => {
      e.preventDefault(); setError(null);
      if (pw !== rep) { setError(t("pwMismatch")); return; }
      try { await post(endpoint, { token, password: pw }); setDone(true); } catch (x) { setError(err(x)); }
    }}>
      <h1>{t(titleKey)}</h1>
      {done ? <><Alert kind="ok">{t(doneKey)}</Alert><Link className="btn pri" href="/login">{t("signIn")}</Link></> : <>
        {!token && <Alert>{t("e_invalid_token")}</Alert>}
        {error && <Alert>{error}</Alert>}
        <PasswordFields value={pw} setValue={setPw} repeat={rep} setRepeat={setRep} />
        <button className="btn pri" type="submit" disabled={!token}>{t("save")}</button></>}
    </form>
  );
}

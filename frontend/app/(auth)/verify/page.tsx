"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui";
import { post } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

function Inner() {
  const { t, err } = useI18n();
  const token = useSearchParams().get("token") || "";
  const [state, setState] = useState<"wait" | "ok" | string>("wait");
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return; // the link is single-use: call it exactly once
    ran.current = true;
    post("/auth/verify", { token }).then(() => setState("ok")).catch((x) => setState(err(x)));
  }, [token, err]);
  return <div className="stack">{state === "wait" ? <p>{t("loading")}</p> : state === "ok" ? <Alert kind="ok">✓</Alert> : <Alert>{state}</Alert>}<Link href="/login">{t("signIn")}</Link></div>;
}
export default function Verify() { return <Suspense><Inner /></Suspense>; }

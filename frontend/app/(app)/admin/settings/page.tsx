"use client";
import { useEffect, useState } from "react";
import { Guard } from "@/components/Shell";
import { Alert, Head, useToast } from "@/components/ui";
import { get, put } from "@/lib/api";
import { num, useI18n } from "@/lib/i18n";

export default function Settings() {
  const { t, lang, err } = useI18n();
  const toast = useToast();
  const [s, setS] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { get("/settings").then(setS); }, []);
  if (!s) return <p className="muted">{t("loading")}</p>;
  const setR = (i: number, j: number, v: string) => { const r = s.rubric.map((x: string[]) => [...x]); r[i][j] = v; setS({ ...s, rubric: r }); };
  const setG = (i: number, k: string, v: any) => { const g = s.grades.map((x: any) => ({ ...x, t: [...x.t] })); if (k === "min") g[i].min = Number(v); else g[i].t[Number(k)] = v; setS({ ...s, grades: g }); };
  return (
    <Guard perm="settings">
      <Head icon="settings" eyebrow={t("nav_programs")} title={t("nav_settings")} />
      {error && <Alert>{error}</Alert>}
      <div className="card"><h3>{lang === "ar" ? "معايير تقييم المدرب" : "Trainer rubric"}</h3>
        {s.rubric.map((c: string[], i: number) => <div key={i} className="row"><span className="pill">{num(i + 1, lang)}</span><input className="inp" style={{ flex: 1 }} aria-label="ar" value={c[0]} onChange={(e) => setR(i, 0, e.target.value)} /><input className="inp" style={{ flex: 1 }} aria-label="en" dir="ltr" value={c[1]} onChange={(e) => setR(i, 1, e.target.value)} />
          <button className="btn sm danger" type="button" disabled={s.rubric.length <= 2} onClick={() => setS({ ...s, rubric: s.rubric.filter((_: any, k: number) => k !== i) })}>✕</button></div>)}
        {s.rubric.length < 8 && <button className="btn sm" type="button" onClick={() => setS({ ...s, rubric: [...s.rubric, ["", ""]] })}>+</button>}
        <p className="tiny faint">{lang === "ar" ? "تسري على التقييمات الجديدة؛ يحفظ كل تقييم نسخة من المعايير وقت إجرائه." : "Applies to new evaluations; each evaluation keeps a snapshot of the rubric it used."}</p></div>
      <div className="card"><h3>{lang === "ar" ? "سلّم التقديرات" : "Grade scale"}</h3>
        {s.grades.map((g: any, i: number) => <div key={i} className="row"><input className="inp sm" type="number" aria-label="min" value={g.min} onChange={(e) => setG(i, "min", e.target.value)} style={{ width: 90 }} /><input className="inp" style={{ flex: 1 }} aria-label="ar" value={g.t[0]} onChange={(e) => setG(i, "0", e.target.value)} /><input className="inp" style={{ flex: 1 }} aria-label="en" dir="ltr" value={g.t[1]} onChange={(e) => setG(i, "1", e.target.value)} /></div>)}</div>
      <div><button className="btn pri" type="button" onClick={async () => { setError(null); try { await put("/settings", s); toast(t("saved")); } catch (x) { setError(err(x)); } }}>{t("save")}</button></div>
    </Guard>
  );
}

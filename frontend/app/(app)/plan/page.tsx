"use client";
import { useEffect, useRef, useState } from "react";
import { Guard } from "@/components/Shell";
import { Field, Head } from "@/components/ui";
import { get, put } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";

export default function Plan() {
  const { t, lang } = useI18n();
  const { me } = useSession();
  const [p, setP] = useState<any>(null);
  const [beh, setBeh] = useState<Record<number, any>>({});
  const timer = useRef<any>(null);
  useEffect(() => { get("/me/plan").then(async (x) => { setP(x); const ids = x.items.map((i: any) => i.behavior_id).join(","); if (ids) { const b = await get(`/catalog/behaviors?ids=${ids}`); setBeh(Object.fromEntries(b.map((y: any) => [y.id, y]))); } }); }, []);
  if (!p) return <p className="muted">{t("loading")}</p>;
  const change = (next: any) => { setP(next); clearTimeout(timer.current); timer.current = setTimeout(() => put("/me/plan", next).catch(() => {}), 800); };
  const A = (ar: string, en: string) => (lang === "ar" ? ar : en);
  return (
    <Guard perm="learn">
      <Head icon="plan" eyebrow={t("nav_learn")} title={t("nav_plan")} sub={me?.share_plan ? A("خطتك مشاركة مع مدربك.", "Your plan is shared with your trainer.") : A("خطتك خاصة بك.", "Your plan is private to you.")} />
      <div className="card"><Field label={A("١. ملاحظة السلوك الحالي", "1. Observe current behavior")} id="o"><textarea className="inp" id="o" value={p.obs} maxLength={4000} onChange={(e) => change({ ...p, obs: e.target.value })} /></Field></div>
      <div className="card"><Field label={A("٢. تحديد السلوك المثالي", "2. Define the ideal behavior")} id="i"><textarea className="inp" id="i" value={p.ideal} maxLength={4000} onChange={(e) => change({ ...p, ideal: e.target.value })} /></Field></div>
      <div className="card"><h3>{A("٣–٤. القيم المستهدفة وخطة العمل", "3–4. Target values and action plan")}</h3>
        {p.items.length ? p.items.map((it: any, k: number) => <div key={it.behavior_id} className="pan stack"><b style={{ color: "var(--ink)", fontSize: ".92rem" }}>{beh[it.behavior_id] ? (lang === "ar" ? beh[it.behavior_id].ar : beh[it.behavior_id].en || beh[it.behavior_id].ar) : `#${it.behavior_id}`}</b>
          <textarea className="inp" aria-label={A("كيف ستطبّقه", "How you will apply it")} placeholder={A("كيف سأطبّق هذا السلوك تحديدًا؟", "How exactly will I apply this behavior?")} value={it.note} maxLength={1000} onChange={(e) => { const items = [...p.items]; items[k] = { ...it, note: e.target.value }; change({ ...p, items }); }} />
          <button className="btn sm danger" type="button" onClick={() => change({ ...p, items: p.items.filter((_: any, j: number) => j !== k) })}>{t("delete")}</button></div>) : <p className="muted">{A("أضف سلوكيات من «منظومة القيم».", "Add behaviors from the Values system.")}</p>}</div>
      <div className="card"><div className="fgrid"><Field label={A("٥. موعد المراجعة", "5. Review date")} id="d"><input className="inp" id="d" type="date" value={p.review_date} onChange={(e) => change({ ...p, review_date: e.target.value })} /></Field>
        <Field label={A("مؤشرات التقدم", "Progress indicators")} id="f" wide><textarea className="inp" id="f" value={p.follow} maxLength={4000} onChange={(e) => change({ ...p, follow: e.target.value })} /></Field></div></div>
    </Guard>
  );
}

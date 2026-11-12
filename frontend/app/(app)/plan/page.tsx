"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Icon from "@/components/icons";
import { Guard } from "@/components/Shell";
import { Head } from "@/components/ui";
import { get, put } from "@/lib/api";
import { num, useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";

type Item = { behavior_id: number; note: string; done?: boolean };
type Plan = { obs: string; ideal: string; review_date: string; follow: string; items: Item[] };

export default function GrowthPlan() {
  const { L, lang } = useI18n();
  const { me } = useSession();
  const [p, setP] = useState<Plan | null>(null);
  const [beh, setBeh] = useState<Record<number, any>>({});
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<any>(null);

  useEffect(() => {
    get<Plan>("/me/plan").then(async (x) => {
      setP(x);
      const ids = x.items.map((i) => i.behavior_id).join(",");
      if (ids) setBeh(Object.fromEntries((await get<any[]>(`/catalog/behaviors?ids=${ids}`)).map((y) => [y.id, y])));
    });
  }, []);
  if (!p) return <div className="stack"><div className="skel" style={{ height: 90 }} /><div className="skel" style={{ height: 220 }} /></div>;

  const change = (next: Plan) => {
    setP(next); setSaved("saving"); clearTimeout(timer.current);
    timer.current = setTimeout(() => put("/me/plan", next).then(() => setSaved("saved")).catch(() => setSaved("idle")), 700);
  };
  const steps = [
    { done: p.obs.trim().length > 10, t: L(["لاحظ سلوكك الحالي", "Observe your current behavior"]) },
    { done: p.ideal.trim().length > 10, t: L(["حدّد السلوك المثالي", "Define the ideal behavior"]) },
    { done: p.items.length > 0 && p.items.every((i) => i.note.trim()), t: L(["اختر سلوكيات وخطّط لتطبيقها", "Pick behaviors and plan them"]) },
    { done: !!p.review_date && p.follow.trim().length > 5, t: L(["حدّد موعد المراجعة", "Set a review date"]) },
  ];
  const doneSteps = steps.filter((s) => s.done).length;
  const doneItems = p.items.filter((i) => i.done).length;
  const text = (id: number) => (beh[id] ? (lang === "ar" ? beh[id].ar : beh[id].en || beh[id].ar) : "…");

  const Step = ({ n, title, hint, children }: { n: number; title: string; hint: string; children: React.ReactNode }) => (
    <section className={`gp-step ${steps[n - 1].done ? "done" : ""}`}>
      <div className="gp-num">{steps[n - 1].done ? <Icon name="check" /> : num(n, lang)}</div>
      <div className="gp-body"><h3>{title}</h3><p className="small muted">{hint}</p>{children}</div>
    </section>
  );

  return (
    <Guard perm="learn">
      <Head icon="plan" eyebrow={L(["خطوات عملية", "Practical steps"])} title={L(["خطة نموّي", "My growth plan"])}
        sub={L(["حوّل ما تتعلمه إلى سلوك يومي في أربع خطوات.", "Turn what you learn into daily behavior, in four steps."])}
        right={<span className={`gp-save ${saved}`}>{saved === "saving" ? L(["جارٍ الحفظ…", "Saving…"]) : saved === "saved" ? <>✓ {L(["حُفظ", "Saved"])}</> : me?.share_plan ? L(["مشاركة مع مدربك", "Shared with your trainer"]) : L(["خاصة بك", "Private to you"])}</span>} />

      <div className="gp-progress">
        <div className="gp-track">{steps.map((s, i) => <span key={i} className={s.done ? "on" : ""} title={s.t}><b>{s.done ? "✓" : num(i + 1, lang)}</b><em>{s.t}</em></span>)}</div>
        <div className="bar"><i style={{ width: `${(doneSteps / steps.length) * 100}%` }} /></div>
      </div>

      <Step n={1} title={L(["ما الذي تفعله اليوم؟", "What do you do today?"])} hint={L(["صِف بصدق سلوكًا تريد تغييره، ومتى وكيف يحدث.", "Describe honestly a behavior you want to change: when and how it happens."])}>
        <textarea className="inp" value={p.obs} maxLength={4000} placeholder={L(["مثال: أؤجّل مهامي حتى آخر لحظة عندما أشعر بالضغط…", "e.g. I postpone tasks until the last minute when I feel pressure…"])} onChange={(e) => change({ ...p, obs: e.target.value })} />
      </Step>
      <Step n={2} title={L(["كيف تريد أن تكون؟", "Who do you want to be?"])} hint={L(["صِف السلوك المثالي الذي يعكس قيمك وهويتك.", "Describe the ideal behavior that reflects your values and identity."])}>
        <textarea className="inp" value={p.ideal} maxLength={4000} placeholder={L(["مثال: أبدأ بأهم مهمة صباحًا وأنجزها قبل أي شيء آخر.", "e.g. I start my most important task each morning."])} onChange={(e) => change({ ...p, ideal: e.target.value })} />
      </Step>
      <Step n={3} title={L(["السلوكيات التي ستعمل عليها", "Behaviors you'll work on"])} hint={L(["اخترها من «منظومة القيم» بزر «+»، ثم اكتب لكل واحد كيف ستطبّقه وعلّمه عند إنجازه.", "Pick them in the Values system with “+”, then write how you'll apply each and tick it when done."])}>
        {p.items.length ? <>
          <div className="gp-count"><span className="pill acc">{num(doneItems, lang)}/{num(p.items.length, lang)} {L(["منجز", "done"])}</span></div>
          <ul className="gp-items">
            {p.items.map((it, k) => (
              <li key={it.behavior_id} className={it.done ? "done" : ""}>
                <button type="button" className="gp-check" aria-pressed={!!it.done} aria-label={L(["أنجزته", "Done"])} onClick={() => { const items = [...p.items]; items[k] = { ...it, done: !it.done }; change({ ...p, items }); }}><Icon name="check" /></button>
                <div className="gp-item">
                  <b>{text(it.behavior_id)}</b>
                  <input className="inp" value={it.note} maxLength={1000} placeholder={L(["كيف سأطبّقه تحديدًا؟ متى وأين؟", "How exactly will I apply it? When and where?"])} onChange={(e) => { const items = [...p.items]; items[k] = { ...it, note: e.target.value }; change({ ...p, items }); }} />
                </div>
                <button type="button" className="iconbtn" aria-label={L(["إزالة", "Remove"])} onClick={() => change({ ...p, items: p.items.filter((_, j) => j !== k) })}><Icon name="close" /></button>
              </li>
            ))}
          </ul>
        </> : <div className="gp-empty"><Icon name="values" /><p>{L(["لم تختر سلوكيات بعد.", "No behaviors yet."])}</p><Link className="btn pri sm" href="/values">{L(["اختر من منظومة القيم", "Choose from the Values system"])}</Link></div>}
      </Step>
      <Step n={4} title={L(["المراجعة والمتابعة", "Review and follow-up"])} hint={L(["حدّد موعدًا تراجع فيه تقدّمك، وكيف ستعرف أنك تحسّنت.", "Pick a date to review, and how you'll know you improved."])}>
        <div className="gp-review">
          <input className="inp" type="date" value={p.review_date} onChange={(e) => change({ ...p, review_date: e.target.value })} aria-label={L(["موعد المراجعة", "Review date"])} />
          <textarea className="inp" value={p.follow} maxLength={4000} placeholder={L(["مؤشرات التقدم: مثال: أنجزت المهمة الأهم ٥ أيام من ٧.", "Progress indicators, e.g. most important task done 5 of 7 days."])} onChange={(e) => change({ ...p, follow: e.target.value })} />
        </div>
      </Step>
    </Guard>
  );
}

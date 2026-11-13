"use client";
import { useEffect, useState } from "react";
import { Guard } from "@/components/Shell";
import { Head } from "@/components/ui";
import { get } from "@/lib/api";
import { num, useI18n } from "@/lib/i18n";

export default function Insights() {
  const { L, lang } = useI18n();
  const [d, setD] = useState<any>(null);
  useEffect(() => { get("/admin/insights").then(setD).catch(() => setD(false)); }, []);
  const max = d ? Math.max(1, ...d.lessons.map((l: any) => l.done)) : 1;
  return (
    <Guard perm="audit">
      <Head icon="audit" title={L(["أرقام الدورة", "Course numbers"])} sub={L(["نظرة سريعة على تقدّم المتدربين", "A quick look at learner progress"])} />
      {!d ? <div className="skel" style={{ height: 140 }} /> : <>
        <div className="stats-row">
          {[[L(["المسجّلون", "Enrolled"]), d.enrolled], [L(["أتمّوا الدورة", "Completed"]), d.completed], [L(["نشطون هذا الأسبوع", "Active this week"]), d.active_7d],
            [L(["متوسط الاختبار", "Avg. exam"]), d.avg_exam == null ? "—" : `${num(d.avg_exam, lang)}٪`], [L(["أسئلة المساعد (٧ أيام)", "Assistant Qs (7d)"]), d.assistant_7d]]
            .map(([k, v]: any) => <div key={k} className="card stat"><span className="tiny faint">{k}</span><b className="big">{typeof v === "number" ? num(v, lang) : v}</b></div>)}
        </div>
        <div className="card"><h3>{L(["عدد من أتمّ كل قسم", "Completions per section"])}</h3>
          {d.lessons.map((l: any, i: number) => <div key={i} className="hbar"><span className="small">{num(i + 1, lang)}. {l.title}</span><span className="bar"><i style={{ width: `${(100 * l.done) / max}%` }} /></span><b className="tiny num">{num(l.done, lang)}</b></div>)}
        </div>
      </>}
    </Guard>
  );
}

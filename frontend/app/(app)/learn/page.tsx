"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Empty, Head } from "@/components/ui";
import { get } from "@/lib/api";
import { date, num, useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { pushWidget } from "@/lib/native";

type En = { id: string; program: { title_ar: string; title_en: string }; level: number; levels: number; graduated: boolean; trainer: string | null };

export default function Learn() {
  const { t, L, lang } = useI18n();
  const { me } = useSession();
  const [ens, setEns] = useState<En[] | null>(null);
  const [tree, setTree] = useState<Record<string, any>>({});
  const [ann, setAnn] = useState<any[]>([]);
  useEffect(() => {
    get<En[]>("/learn/enrollments").then(async (r) => {
      setEns(r);
      const trees = await Promise.all(r.map((e) => get(`/learn/enrollments/${e.id}`)));
      setTree(Object.fromEntries(trees.map((x) => [x.id, x])));
    });
    get("/announcements").then(setAnn).catch(() => {});
  }, []);
  // Keep the "My level" home-screen widget in sync with the first enrollment (Android app only).
  useEffect(() => {
    const e = ens?.[0];
    const tr = e && tree[e.id];
    if (!e || !tr) return;
    const st = tr.stats;
    const lv = tr.levels?.[e.level - 1];
    const next = lv?.courses.flatMap((c: any) => c.lessons).find((x: any) => !x.done);
    pushWidget({
      lang, program: L([e.program.title_ar, e.program.title_en]), level: e.level, levels: e.levels,
      levelTitle: lv ? L([lv.title_ar, lv.title_en]) : "", done: st?.lessons_done ?? 0, total: st?.lessons_total ?? 0,
      final: st?.final_provisional ? null : st?.final ?? null, eligible: !!st?.eligible, graduated: e.graduated,
      path: `learn/${e.id}`, next: next ? { t: L([next.title_ar, next.title_en]), path: `learn/${e.id}/lesson/${next.id}` } : null,
    });
  }, [ens, tree, lang, L]);
  return (
    <>
      <Head eyebrow={t("brand")} title={lang === "ar" ? `أهلًا، ${me?.name || ""}` : `Welcome, ${me?.name || ""}`} sub={t("nav_learn")} />
      {ens === null ? <p className="muted">{t("loading")}</p> : ens.length === 0 ? <Empty>{lang === "ar" ? "لم تُسجَّل في برنامج بعد. سيسجّلك مسؤول المنصة ويُسند إليك مدربًا." : "You are not enrolled yet. The platform admin will enroll you and assign a trainer."}</Empty> :
        ens.map((e) => {
          const tr = tree[e.id];
          const st = tr?.stats;
          const lv = tr?.levels?.[e.level - 1];
          const next = lv?.courses.flatMap((c: any) => c.lessons).find((x: any) => !x.done);
          const pct = st && st.lessons_total ? Math.round((100 * st.lessons_done) / st.lessons_total) : 0;
          return (
            <div key={e.id} className="card hero">
              <span className="eyebrow">{L([e.program.title_ar, e.program.title_en])} · {e.graduated ? t("graduated") : `${t("level")} ${num(e.level, lang)} / ${num(e.levels, lang)}`}</span>
              <h1>{lv ? L([lv.title_ar, lv.title_en]) : "…"}</h1>
              <p>{e.trainer ? `${t("trainer")}: ${e.trainer}` : t("noTrainer")}{st && !e.graduated ? ` · ${num(pct, lang)}٪` : ""}</p>
              {st && !e.graduated && <div className="bar" style={{ background: "rgba(255,255,255,.25)" }}><i style={{ width: `${pct}%`, background: "var(--spark)" }} /></div>}
              <div className="row">
                {next && <Link className="btn pri" href={`/learn/${e.id}/lesson/${next.id}`}>{L([next.title_ar, next.title_en])}</Link>}
                <Link className="btn" href={`/learn/${e.id}`}>{t("toJourney")}</Link>
              </div>
            </div>
          );
        })}
      <div className="card"><h3>{t("announcements")}</h3>{ann.length ? ann.map((a) => <div key={a.id} className="stack" style={{ borderTop: "1px solid var(--line)", paddingTop: 8 }}><b>{a.title}</b><p className="small muted pre">{a.body}</p><span className="tiny faint">{date(a.at, lang)}</span></div>) : <p className="muted">{t("noData")}</p>}</div>
    </>
  );
}

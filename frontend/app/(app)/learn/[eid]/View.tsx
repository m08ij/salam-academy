"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Checks, LevelTrack, ScoreCards } from "@/components/level";
import { Alert, Field, Head, StatusPill, useToast } from "@/components/ui";
import { get, post } from "@/lib/api";
import CourseMap from "@/components/CourseMap";
import { date, num, useI18n } from "@/lib/i18n";

export default function Journey() {
  const { eid } = useParams<{ eid: string }>();
  const { t, L, lang, err } = useI18n();
  const toast = useToast();
  const [tree, setTree] = useState<any>(null);
  const [jr, setJr] = useState<any>(null);
  const [form, setForm] = useState({ title: "", summary: "", link: "" });
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const [a, b] = await Promise.all([get(`/learn/enrollments/${eid}`), get(`/learn/enrollments/${eid}/journey`)]);
    setTree(a); setJr(b);
    const s = b.project.submission;
    if (s) setForm({ title: s.title, summary: s.summary, link: s.link });
  }, [eid]);
  useEffect(() => { load(); }, [load]);
  if (!tree || !jr) return <p className="muted">{t("loading")}</p>;
  const st = jr.stats;
  const pj = jr.project;
  const ev = jr.evaluation;
  if (tree.program.self_paced) {
    const lv = tree.levels[0];
    return (
      <>
        <Head icon="learn" eyebrow={L(["خريطة الدورة", "Course map"])} title={L([tree.program.title_ar, tree.program.title_en])}
          sub={L(["كل فرع جزء من الدورة، وكل نقطة قسم. اضغط أي قسم لفتحه.", "Each branch is a part of the course and each node a section. Tap any section to open it."])}
          right={<span className={`pill ${tree.trainer ? "acc" : "warn"}`}>{tree.trainer ? `${t("trainer")}: ${tree.trainer}` : t("noTrainer")}</span>} />
        <CourseMap eid={eid} title={[tree.program.title_ar, tree.program.title_en]} graduated={st.graduated}
          parts={lv.courses.map((c: any) => ({ title_ar: c.title_ar, title_en: c.title_en, lessons: c.lessons }))} />
      </>
    );
  }
  return (
    <>
      <Head icon="learn" eyebrow={L([tree.program.title_ar, tree.program.title_en])} title={t("toJourney")} sub={st.graduated ? t("graduated") : `${t("level")} ${num(st.level, lang)} / ${num(st.levels, lang)}`}
        right={<span className={`pill ${tree.trainer ? "acc" : "warn"}`}>{tree.trainer ? `${t("trainer")}: ${tree.trainer}` : t("noTrainer")}</span>} />
      <LevelTrack levels={tree.levels} current={st.level} graduated={st.graduated} />
      {tree.levels.map((lv: any) => (
        <div key={lv.position} className="card" style={lv.locked ? { opacity: .65 } : {}}>
          <div className="row between"><h3>{lv.locked ? "🔒 " : ""}{L([lv.title_ar, lv.title_en])}</h3>{lv.position === st.level && !st.graduated && <span className={`pill ${st.eligible ? "ok" : "info"}`}>{st.eligible ? t("eligible") : t("inProgress")}</span>}</div>
          {lv.courses.map((c: any, i: number) => (
            <div key={i} className="stack"><b className="small">{L([c.title_ar, c.title_en])}</b>
              {c.lessons.map((ls: any) => (
                <Link key={ls.id} className={`lsn ${lv.locked ? "lock" : ""}`} href={lv.locked ? "#" : `/learn/${eid}/lesson/${ls.id}`} aria-disabled={lv.locked || undefined}>
                  <span>{ls.done ? "✓ " : ""}{L([ls.title_ar, ls.title_en])}</span>
                  <span className="tiny faint">{ls.best ? `${num(ls.best.score, lang)}/${num(ls.best.total, lang)} · ` : ""}{num(ls.hours, lang)} {t("hours")}</span>
                </Link>
              ))}
            </div>
          ))}
        </div>
      ))}
      {!st.graduated && <>
        <div className="grid g2">
          <div className="card"><h3>{t("criteria")}</h3><Checks stats={st} /></div>
          <div className="card"><h3>{t("evaluation")}</h3>{ev ? <><span className="pill acc">{num(ev.avg, lang)} / ٥</span>
            <ul>{ev.criteria.map((c: [string, string], i: number) => <li key={i}>{L(c)}: <b>{num(ev.scores[i], lang)}</b></li>)}</ul>{ev.note && <p className="small pre">{ev.note}</p>}</> : <p className="muted">—</p>}</div>
        </div>
        <ScoreCards stats={st} />
        {pj.required && (
          <div className="card">
            <div className="row between"><h3>{t("project")}: {L([pj.title_ar, pj.title_en])}</h3><StatusPill s={st.project_status} /></div>
            {L([pj.brief_ar, pj.brief_en]) && <p className="muted">{L([pj.brief_ar, pj.brief_en])}</p>}
            {pj.review && <div className="pan"><b>{t("trainerFeedback")} · {num(pj.review.grade, lang)}٪</b><span className="pre">{pj.review.note || "—"}</span></div>}
            {st.project_status !== "approved" && (
              <form className="stack" onSubmit={async (e) => {
                e.preventDefault(); setError(null);
                try { await post(`/learn/enrollments/${eid}/project`, form); toast(t("saved")); await load(); } catch (x) { setError(err(x)); }
              }}>
                {error && <Alert>{error}</Alert>}
                <Field label={t("projectTitle")} id="pt"><input className="inp" id="pt" value={form.title} maxLength={160} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></Field>
                <Field label={t("projectSummary")} id="ps"><textarea className="inp" id="ps" value={form.summary} minLength={20} maxLength={8000} onChange={(e) => setForm({ ...form, summary: e.target.value })} required /></Field>
                <Field label={t("projectLink")} id="pl"><input className="inp" id="pl" type="url" pattern="https://.*" dir="ltr" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} /></Field>
                <div className="row"><button className="btn pri" type="submit">{pj.submission ? t("resubmit") : t("submitProject")}</button>{pj.submission && <span className="tiny faint">v{num(pj.submission.version, lang)} · {date(pj.submission.at, lang)}</span>}</div>
              </form>
            )}
          </div>
        )}
      </>}
      {jr.promotions.length > 0 && <div className="card"><h3>{t("history")}</h3>{jr.promotions.map((p: any, i: number) => (
        <div key={i} className="row between"><span>{t("level")} {num(p.from, lang)} → {p.to ? `${t("level")} ${num(p.to, lang)}` : t("graduated")} {p.override && <span className="pill warn">{t("override")}</span>}</span><span className="row"><span className="pill acc">{num(p.final, lang)}٪</span><span className="tiny faint">{date(p.at, lang)}</span></span></div>))}</div>}
    </>
  );
}

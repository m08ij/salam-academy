"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Checks, LevelTrack, ScoreCards } from "@/components/level";
import { Guard } from "@/components/Shell";
import { Alert, ConfirmButton, Field, Head, Stats, StatusPill, Tabs, useToast } from "@/components/ui";
import { get, post } from "@/lib/api";
import { date, num, useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";

type Tab = "over" | "proj" | "eval" | "shared" | "hist";

export default function TraineeFile() {
  const { eid } = useParams<{ eid: string }>();
  const { t, L, lang, err } = useI18n();
  const { can } = useSession();
  const toast = useToast();
  const [f, setF] = useState<any>(null);
  const [tab, setTab] = useState<Tab>("over");
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState({ grade: "", status: "approved", note: "" });
  const [scores, setScores] = useState<number[]>([]);
  const [evNote, setEvNote] = useState("");
  const [reason, setReason] = useState("");
  const load = useCallback(async () => {
    try { const x = await get(`/training/enrollments/${eid}`); setF(x); setScores(x.rubric.map(() => 0)); } catch (e) { setError(err(e)); }
  }, [eid, err]);
  useEffect(() => { load(); }, [load]);
  if (error && !f) return <Alert>{error}</Alert>;
  if (!f) return <p className="muted">{t("loading")}</p>;
  const j = f.journey, st = j.stats, pj = j.project;
  const sp = !!f.program.self_paced;
  const act = async (fn: () => Promise<any>, ok: string) => { setError(null); try { await fn(); toast(ok); await load(); } catch (x) { setError(err(x)); } };
  return (
    <Guard perm="train">
      <Head icon="trainer" eyebrow={`${L([f.program.title_ar, f.program.title_en])} · ${st.graduated ? t("graduated") : `${t("level")} ${num(st.level, lang)}`}`} title={f.user.name} sub={`${t("trainer")}: ${f.trainer || "—"}`} right={<Link className="btn" href="/trainer">{t("back")}</Link>} />
      {error && <Alert>{error}</Alert>}
      {!sp && <LevelTrack levels={f.program.levels} current={st.level} graduated={st.graduated} />}
      <Tabs<Tab> value={tab} onChange={setTab} tabs={sp ? [["over", L(["التقدّم", "Progress"])], ["shared", t("reflection")], ["hist", t("history")]] : [["over", t("criteria")], ["proj", t("project")], ["eval", t("evaluation")], ["shared", t("reflection")], ["hist", t("history")]]} />
      {tab === "over" && sp && <SelfPaced f={f} st={st} />}
      {tab === "over" && !sp && <>
        <ScoreCards stats={st} />
        <div className="grid g2">
          <div className="card"><h3>{t("criteria")}</h3><Checks stats={st} /></div>
          <div className="card"><h3>{st.level < st.levels ? t("promote") : t("graduate")}</h3>
            {st.graduated ? <span className="pill ok">{t("graduated")}</span> : <>
              <ConfirmButton className="btn pri" disabled={!st.eligible} onConfirm={() => act(() => post(`/training/enrollments/${eid}/promote`), t("saved"))}>{st.level < st.levels ? `${t("promote")} → ${num(st.level + 1, lang)}` : t("graduate")}</ConfirmButton>
              {!st.eligible && <p className="tiny faint">{t("e_not_eligible")}</p>}
              {can("override") && <details><summary className="small" style={{ color: "var(--bad)", cursor: "pointer" }}>{t("override")}</summary>
                <div className="stack" style={{ marginTop: 8 }}><Field label={t("reason")} id="rsn"><textarea className="inp" id="rsn" value={reason} minLength={10} maxLength={1000} onChange={(e) => setReason(e.target.value)} /></Field>
                  <ConfirmButton disabled={reason.trim().length < 10} onConfirm={() => act(() => post(`/training/enrollments/${eid}/override`, { reason }), t("saved"))}>{t("override")}</ConfirmButton></div></details>}
            </>}
          </div>
        </div>
        <div className="tbl-wrap"><table><thead><tr><th>{t("lesson")}</th><th>{t("completed")}</th><th>{t("quiz")}</th></tr></thead><tbody>
          {f.lessons.map((l: any) => <tr key={l.id}><td>{L([l.title_ar, l.title_en])}</td><td>{date(l.done_at, lang)}</td><td className="num">{l.best ? `${num(l.best[0], lang)}/${num(l.best[1], lang)}` : "—"}</td></tr>)}</tbody></table></div>
      </>}
      {tab === "proj" && <div className="card">
        <div className="row between"><h3>{L([pj.title_ar, pj.title_en]) || t("project")}</h3><StatusPill s={st.project_status} /></div>
        {pj.submission ? <>
          <div className="pan"><b style={{ color: "var(--ink)", fontSize: ".95rem" }}>{pj.submission.title}</b><p className="pre small">{pj.submission.summary}</p>
            {pj.submission.link && /^https:\/\//.test(pj.submission.link) && <a href={pj.submission.link} target="_blank" rel="noopener noreferrer" dir="ltr">{pj.submission.link}</a>}
            <span className="tiny faint">v{num(pj.submission.version, lang)} · {date(pj.submission.at, lang)}</span></div>
          <form className="fgrid" onSubmit={(e) => { e.preventDefault(); act(() => post(`/training/enrollments/${eid}/review`, { grade: Number(rev.grade), status: rev.status, note: rev.note }), t("saved")); }}>
            <Field label={t("grade")} id="g"><input className="inp" id="g" type="number" min={0} max={100} required value={rev.grade} onChange={(e) => setRev({ ...rev, grade: e.target.value })} /></Field>
            <Field label={t("decision")} id="d"><select className="inp" id="d" value={rev.status} onChange={(e) => setRev({ ...rev, status: e.target.value })}><option value="approved">{t("p_approved")}</option><option value="revise">{t("p_revise")}</option></select></Field>
            <Field label={t("note")} id="n" wide><textarea className="inp" id="n" value={rev.note} maxLength={4000} onChange={(e) => setRev({ ...rev, note: e.target.value })} /></Field>
            <div className="wide"><button className="btn pri" type="submit">{t("saveReview")}</button></div>
          </form></> : <p className="muted">{t("e_no_submission")}</p>}
      </div>}
      {tab === "eval" && <div className="card">
        <h3>{t("evaluation")} · {t("level")} {num(st.level, lang)}</h3><p className="tiny faint">{t("rubricHint")}</p>
        {f.rubric.map((c: [string, string], i: number) => <div key={i} className="row between"><span style={{ flex: 1, minWidth: 200 }}>{L(c)}</span>
          <div className="rate" role="group" aria-label={L(c)}>{[1, 2, 3, 4, 5].map((v) => <button key={v} type="button" aria-pressed={scores[i] === v} onClick={() => { const s = [...scores]; s[i] = v; setScores(s); }}>{num(v, lang)}</button>)}</div></div>)}
        <Field label={t("note")} id="evn"><textarea className="inp" id="evn" value={evNote} maxLength={4000} onChange={(e) => setEvNote(e.target.value)} /></Field>
        <button className="btn pri" type="button" disabled={scores.some((s) => !s)} onClick={() => act(() => post(`/training/enrollments/${eid}/evaluation`, { scores, note: evNote }), t("saved"))}>{t("saveEval")}</button>
        {f.evaluations.length > 0 && <div className="stack">{f.evaluations.map((e: any, i: number) => <div key={i} className="row between small"><span>{t("level")} {num(e.level, lang)} · {e.note}</span><span className="row"><span className="pill">{num(e.avg, lang)} / ٥</span><span className="tiny faint">{date(e.at, lang)}</span></span></div>)}</div>}
      </div>}
      {tab === "shared" && <div className="grid g2">
        <div className="card"><h3>{t("reflection")}</h3>{f.shared.reflections ? (f.reflections.length ? f.reflections.map((r: any, i: number) => <div key={i} className="pan"><b>{L(r.lesson)}</b><span className="pre">{r.text}</span></div>) : <p className="muted">—</p>) : <p className="muted">{t("notShared")}</p>}</div>
        <div className="card"><h3>{t("nav_plan")}</h3>{f.shared.plan ? (f.plan ? <div className="stack small"><p className="pre">{f.plan.obs}</p><p className="pre">{f.plan.ideal}</p><span className="pill">{num(f.plan.items?.length || 0, lang)} {t("behaviors")}</span></div> : <p className="muted">—</p>) : <p className="muted">{t("notShared")}</p>}</div>
      </div>}
      {tab === "hist" && <div className="card">{j.promotions.length ? j.promotions.map((p: any, i: number) => <div key={i} className="row between"><span>{num(p.from, lang)} → {p.to ? num(p.to, lang) : t("graduated")} {p.override && <span className="pill warn">{t("override")}</span>}</span><span className="row"><span className="pill acc">{num(p.final, lang)}٪</span><span className="tiny faint">{date(p.at, lang)}</span></span></div>) : <p className="muted">—</p>}</div>}
    </Guard>
  );
}

/** Self-paced course: what the learner has done, where they stand, and where they may need help. */
function SelfPaced({ f, st }: { f: any; st: any }) {
  const { t, L, lang } = useI18n();
  const lessons = f.lessons as any[];
  const sections = lessons.filter((l) => !l.questions || l.questions <= 10);
  const exam = lessons.find((l) => l.questions > 10);
  const done = sections.filter((l) => l.done_at).length;
  const pct = sections.length ? Math.round((100 * done) / sections.length) : 0;
  const examPct = exam?.best ? Math.round((100 * exam.best[0]) / exam.best[1]) : null;
  const last = lessons.map((l) => l.done_at).filter(Boolean).sort().pop();
  const next = sections.find((l) => !l.done_at);
  return (
    <>
      <Stats items={[
        { icon: "book", value: `${num(done, lang)}/${num(sections.length, lang)}`, label: L(["الأقسام المكتملة", "Sections completed"]), tone: "acc" },
        { icon: "quiz", value: examPct ?? "—", suffix: examPct == null ? undefined : "٪", label: L(["أفضل نتيجة في الاختبار النهائي", "Best final-exam score"]), tone: examPct != null && examPct >= 70 ? "ok" : "gold" },
        { icon: "enroll", value: exam?.attempts ?? 0, label: L(["محاولات الاختبار", "Exam attempts"]), tone: (exam?.attempts ?? 0) >= 3 && (examPct ?? 0) < 70 ? "bad" : "info" },
        { icon: "medal", value: st.graduated ? L(["أتمّ الدورة", "Completed"]) : `${num(pct, lang)}٪`, label: L(["الحالة", "Status"]), tone: st.graduated ? "ok" : "acc" },
      ]} />
      <div className="card">
        <div className="row between"><h3>{L(["أين يقف المتعلّم؟", "Where the learner stands"])}</h3><span className="tiny faint">{L(["آخر نشاط", "Last activity"])}: {date(last || null, lang)}</span></div>
        <div className="bar"><i style={{ width: `${pct}%` }} /></div>
        <p className="small muted">{st.graduated ? L(["أتمّ الدورة واجتاز الاختبار النهائي. يُكمَل التقدّم تلقائيًا في هذه الدورة الذاتية.", "Completed the course and passed the final exam. Progress completes automatically in this self-paced course."])
          : next ? L([`القسم التالي: ${next.title_ar}`, `Next section: ${next.title_en || next.title_ar}`]) : L(["أنهى الأقسام؛ بقي الاختبار النهائي (٧٠٪ للنجاح).", "All sections done; the final exam remains (70% to pass)."])}</p>
        {(exam?.attempts ?? 0) >= 3 && (examPct ?? 0) < 70 && <div className="alert warn small">{L(["حاول الاختبار عدة مرات دون نجاح؛ قد يحتاج مساعدتك في المراجعة.", "Several exam attempts without passing — they may need your help reviewing."])}</div>}
      </div>
      <div className="tbl-wrap cards"><table><thead><tr><th>{t("lesson")}</th><th>{t("status")}</th><th>{t("completed")}</th><th>{t("quiz")}</th></tr></thead><tbody>
        {lessons.map((l: any, i: number) => <tr key={l.id}>
          <td className="lead"><b className="small">{num(i + 1, lang)}. {L([l.title_ar, l.title_en])}</b></td>
          <td data-label={t("status")}>{l.done_at ? <span className="pill ok">✓ {L(["مكتمل", "Done"])}</span> : <span className="pill">{L(["لم يبدأ", "Not yet"])}</span>}</td>
          <td data-label={t("completed")} className="small faint">{date(l.done_at, lang)}</td>
          <td data-label={t("quiz")} className="num">{l.best ? `${num(l.best[0], lang)}/${num(l.best[1], lang)} · ${num(l.attempts, lang)}×` : "—"}</td>
        </tr>)}</tbody></table></div>
    </>
  );
}

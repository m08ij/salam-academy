"use client";
import { useCallback, useEffect, useState } from "react";
import { Guard } from "@/components/Shell";
import { Alert, ConfirmButton, Field, Head, useToast } from "@/components/ui";
import { del, get, post, put } from "@/lib/api";
import { num, useI18n } from "@/lib/i18n";

const newLesson = () => ({ title_ar: "", title_en: "", hours: 1, body_ar: "", body_en: "", video_url: "", questions: [] as any[] });
const newCourse = () => ({ title_ar: "مقرر جديد", title_en: "New course", lessons: [newLesson()] });
const newLevel = (n: number) => ({ title_ar: `المستوى ${n}`, title_en: `Level ${n}`, desc_ar: "", desc_en: "", min_quiz: 70, min_eval: 3.5, min_project: 70, min_final: 70, w_quiz: 40, w_eval: 30, w_project: 30,
  project_required: true, project_title_ar: "", project_title_en: "", project_brief_ar: "", project_brief_en: "", courses: [newCourse()] });

export default function Programs() {
  const { t, L, lang, err } = useI18n();
  const toast = useToast();
  const [list, setList] = useState<any[]>([]);
  const [p, setP] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => setList(await get("/programs")), []);
  useEffect(() => { load(); }, [load]);
  const upd = (fn: (d: any) => void) => setP((cur: any) => { const d = structuredClone(cur); fn(d); return d; });
  const A = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const inp = (label: string, get_: (d: any) => any, set: (d: any, v: any) => void, opts: { type?: string; area?: boolean; wide?: boolean; dir?: string } = {}) => {
    const id = Math.random().toString(36).slice(2, 9);
    return <Field label={label} id={id} wide={opts.wide}>{opts.area
      ? <textarea className="inp" id={id} value={get_(p) ?? ""} dir={opts.dir} onChange={(e) => upd((d) => set(d, e.target.value))} />
      : <input className="inp" id={id} type={opts.type || "text"} step="any" dir={opts.dir} value={get_(p) ?? ""} onChange={(e) => upd((d) => set(d, opts.type === "number" ? Number(e.target.value) : e.target.value))} />}</Field>;
  };
  const save = async () => {
    setError(null);
    try { const r = p.id ? await put(`/programs/${p.id}`, p) : await post("/programs", p); setP(r); toast(t("saved")); await load(); }
    catch (x: any) { setError(err(x) + (x?.detail?.errors ? " — " + x.detail.errors.map((e: any) => `${(e.loc || []).slice(1).join(".")}: ${e.msg}`).join(" · ") : "")); }
  };
  return (
    <Guard perm="programs">
      <Head icon="programs" eyebrow={t("nav_programs")} title={t("nav_programs")} sub={A("كل برنامج مستويات، ولكل مستوى مقرراته وشروط الانتقال منه ومشروعه.", "Each program has levels; each level has its own courses, promotion criteria and project.")}
        right={<button className="btn pri" type="button" onClick={() => setP({ title_ar: "", title_en: "", desc_ar: "", desc_en: "", active: false, self_enroll: false, levels: [newLevel(1)] })}>{A("برنامج جديد", "New program")}</button>} />
      <div className="grid g3">{list.map((x) => <div key={x.id} className="card"><div className="row between"><span className={`pill ${x.active ? "ok" : ""}`}>{x.active ? A("مفعّل", "Active") : A("موقوف", "Inactive")}</span><span className="tiny faint">{num(x.enrollments, lang)} {t("trainees")}</span></div>
        <h3>{L([x.title_ar, x.title_en])}</h3><span className="small muted">{num(x.levels, lang)} {t("levels")} · {num(x.courses, lang)} · {num(x.lessons, lang)}</span>
        <div className="row"><button className="btn sm" type="button" onClick={async () => setP(await get(`/programs/${x.id}`))}>{A("حرّر", "Edit")}</button>
          {x.enrollments === 0 && <ConfirmButton className="btn sm danger" onConfirm={async () => { try { await del(`/programs/${x.id}`); await load(); } catch (e) { setError(err(e)); } }}>{t("delete")}</ConfirmButton>}</div></div>)}</div>
      {error && <Alert>{error}</Alert>}
      {p && <div className="card">
        <div className="row between"><h2>{L([p.title_ar, p.title_en]) || "—"}</h2><div className="row">
          <label className="row small"><input type="checkbox" checked={p.active} onChange={(e) => upd((d) => { d.active = e.target.checked; })} /> {A("مفعّل", "Active")}</label>
          <label className="row small"><input type="checkbox" checked={p.self_enroll} onChange={(e) => upd((d) => { d.self_enroll = e.target.checked; })} /> {A("تسجيل ذاتي", "Self-enrollment")}</label>
          <button className="btn" type="button" onClick={() => setP(null)}>{t("close")}</button></div></div>
        <div className="fgrid">{inp(A("الاسم (عربي)", "Name (Arabic)"), (d) => d.title_ar, (d, v) => { d.title_ar = v; })}{inp(A("الاسم (إنجليزي)", "Name (English)"), (d) => d.title_en, (d, v) => { d.title_en = v; }, { dir: "ltr" })}
          {inp(A("الوصف (عربي)", "Description (Arabic)"), (d) => d.desc_ar, (d, v) => { d.desc_ar = v; }, { area: true })}{inp(A("الوصف (إنجليزي)", "Description (English)"), (d) => d.desc_en, (d, v) => { d.desc_en = v; }, { area: true, dir: "ltr" })}</div>
        {p.levels.map((lv: any, i: number) => <div key={i} className="lvbox">
          <div className="row between"><h3>{t("level")} {num(i + 1, lang)}</h3><div className="row">
            <button className="btn sm ghost" type="button" disabled={!i} onClick={() => upd((d) => { [d.levels[i - 1], d.levels[i]] = [d.levels[i], d.levels[i - 1]]; })}>↑</button>
            <ConfirmButton className="btn sm danger" disabled={p.levels.length < 2} onConfirm={() => upd((d) => { d.levels.splice(i, 1); })}>{t("delete")}</ConfirmButton></div></div>
          <div className="fgrid">{inp(A("العنوان (عربي)", "Title (Arabic)"), (d) => d.levels[i].title_ar, (d, v) => { d.levels[i].title_ar = v; })}{inp(A("العنوان (إنجليزي)", "Title (English)"), (d) => d.levels[i].title_en, (d, v) => { d.levels[i].title_en = v; }, { dir: "ltr" })}</div>
          <b className="small">{t("criteria")}</b>
          <div className="fgrid g4f">
            {(["min_quiz", "min_eval", "min_project", "min_final", "w_quiz", "w_eval", "w_project"] as const).map((k) => <span key={k} style={{ display: "contents" }}>{inp({ min_quiz: A("أدنى متوسط اختبارات ٪", "Min quiz %"), min_eval: A("أدنى تقييم (١–٥)", "Min evaluation (1–5)"), min_project: A("أدنى درجة مشروع ٪", "Min project %"), min_final: A("أدنى علامة نهائية ٪", "Min final %"), w_quiz: A("وزن الاختبارات ٪", "Quiz weight %"), w_eval: A("وزن التقييم ٪", "Evaluation weight %"), w_project: A("وزن المشروع ٪", "Project weight %") }[k], (d) => d.levels[i][k], (d, v) => { d.levels[i][k] = v; }, { type: "number" })}</span>)}
            <label className="row small" style={{ alignSelf: "end" }}><input type="checkbox" checked={lv.project_required} onChange={(e) => upd((d) => { d.levels[i].project_required = e.target.checked; })} /> {A("المشروع إلزامي", "Project required")}</label>
          </div>
          {lv.w_quiz + lv.w_eval + lv.w_project !== 100 && <Alert kind="warn">{A("مجموع الأوزان يجب أن يساوي ١٠٠.", "Weights must add up to 100.")}</Alert>}
          <div className="fgrid">{inp(A("عنوان المشروع (عربي)", "Project title (Arabic)"), (d) => d.levels[i].project_title_ar, (d, v) => { d.levels[i].project_title_ar = v; })}{inp(A("عنوان المشروع (إنجليزي)", "Project title (English)"), (d) => d.levels[i].project_title_en, (d, v) => { d.levels[i].project_title_en = v; }, { dir: "ltr" })}
            {inp(A("وصف المشروع (عربي)", "Project brief (Arabic)"), (d) => d.levels[i].project_brief_ar, (d, v) => { d.levels[i].project_brief_ar = v; }, { area: true })}{inp(A("وصف المشروع (إنجليزي)", "Project brief (English)"), (d) => d.levels[i].project_brief_en, (d, v) => { d.levels[i].project_brief_en = v; }, { area: true, dir: "ltr" })}</div>
          {lv.courses.map((c: any, j: number) => <div key={j} className="crsbox">
            <div className="fgrid">{inp(A("اسم المقرر (عربي)", "Course (Arabic)"), (d) => d.levels[i].courses[j].title_ar, (d, v) => { d.levels[i].courses[j].title_ar = v; })}{inp(A("اسم المقرر (إنجليزي)", "Course (English)"), (d) => d.levels[i].courses[j].title_en, (d, v) => { d.levels[i].courses[j].title_en = v; }, { dir: "ltr" })}</div>
            {c.lessons.map((ls: any, k: number) => <details key={k} className="pan">
              <summary style={{ cursor: "pointer" }}><b style={{ display: "inline", color: "var(--ink)", fontSize: ".9rem" }}>{num(k + 1, lang)}. {L([ls.title_ar, ls.title_en]) || "—"}</b> <span className="tiny faint">{num(ls.questions.length, lang)} {t("quiz")}</span></summary>
              <div className="stack" style={{ marginTop: 8 }}>
                <div className="fgrid">{inp(A("العنوان (عربي)", "Title (Arabic)"), (d) => d.levels[i].courses[j].lessons[k].title_ar, (d, v) => { d.levels[i].courses[j].lessons[k].title_ar = v; })}{inp(A("العنوان (إنجليزي)", "Title (English)"), (d) => d.levels[i].courses[j].lessons[k].title_en, (d, v) => { d.levels[i].courses[j].lessons[k].title_en = v; }, { dir: "ltr" })}
                  {inp(A("الساعات", "Hours"), (d) => d.levels[i].courses[j].lessons[k].hours, (d, v) => { d.levels[i].courses[j].lessons[k].hours = v; }, { type: "number" })}{inp(A("رابط فيديو (https)", "Video link (https)"), (d) => d.levels[i].courses[j].lessons[k].video_url, (d, v) => { d.levels[i].courses[j].lessons[k].video_url = v; }, { dir: "ltr" })}
                  {inp(A("المحتوى (عربي)", "Content (Arabic)"), (d) => d.levels[i].courses[j].lessons[k].body_ar, (d, v) => { d.levels[i].courses[j].lessons[k].body_ar = v; }, { area: true, wide: true })}
                  {inp(A("المحتوى (إنجليزي)", "Content (English)"), (d) => d.levels[i].courses[j].lessons[k].body_en, (d, v) => { d.levels[i].courses[j].lessons[k].body_en = v; }, { area: true, wide: true, dir: "ltr" })}</div>
                {ls.questions.map((q: any, qi: number) => <div key={qi} className="crsbox">
                  <div className="fgrid">{inp(A("السؤال (عربي)", "Question (Arabic)"), (d) => d.levels[i].courses[j].lessons[k].questions[qi].q_ar, (d, v) => { d.levels[i].courses[j].lessons[k].questions[qi].q_ar = v; })}{inp(A("السؤال (إنجليزي)", "Question (English)"), (d) => d.levels[i].courses[j].lessons[k].questions[qi].q_en, (d, v) => { d.levels[i].courses[j].lessons[k].questions[qi].q_en = v; }, { dir: "ltr" })}</div>
                  {q.options.map((o: string[], oi: number) => <div key={oi} className="row"><input type="radio" name={`q-${i}-${j}-${k}-${qi}`} checked={q.correct === oi} aria-label={A("الإجابة الصحيحة", "Correct answer")} onChange={() => upd((d) => { d.levels[i].courses[j].lessons[k].questions[qi].correct = oi; })} />
                    <input className="inp" style={{ flex: 1 }} aria-label="ar" value={o[0]} onChange={(e) => upd((d) => { d.levels[i].courses[j].lessons[k].questions[qi].options[oi][0] = e.target.value; })} />
                    <input className="inp" style={{ flex: 1 }} aria-label="en" dir="ltr" value={o[1]} onChange={(e) => upd((d) => { d.levels[i].courses[j].lessons[k].questions[qi].options[oi][1] = e.target.value; })} /></div>)}
                  <button className="btn sm danger" type="button" onClick={() => upd((d) => { d.levels[i].courses[j].lessons[k].questions.splice(qi, 1); })}>{t("delete")}</button></div>)}
                <div className="row">
                  <button className="btn sm" type="button" onClick={() => upd((d) => { d.levels[i].courses[j].lessons[k].questions.push({ q_ar: "", q_en: "", options: [["", ""], ["", ""], ["", ""], ["", ""]], correct: 0 }); })}>+ {t("quiz")}</button>
                  <button className="btn sm ghost" type="button" disabled={!k} onClick={() => upd((d) => { const a = d.levels[i].courses[j].lessons; [a[k - 1], a[k]] = [a[k], a[k - 1]]; })}>↑</button>
                  <ConfirmButton className="btn sm danger" onConfirm={() => upd((d) => { d.levels[i].courses[j].lessons.splice(k, 1); })}>{t("delete")}</ConfirmButton></div>
              </div></details>)}
            <div className="row"><button className="btn sm" type="button" onClick={() => upd((d) => { d.levels[i].courses[j].lessons.push(newLesson()); })}>+ {t("lesson")}</button>
              <ConfirmButton className="btn sm danger" onConfirm={() => upd((d) => { d.levels[i].courses.splice(j, 1); })}>{t("delete")} {t("course")}</ConfirmButton></div>
          </div>)}
          <button className="btn sm" type="button" onClick={() => upd((d) => { d.levels[i].courses.push(newCourse()); })}>+ {t("course")}</button>
        </div>)}
        <div className="row"><button className="btn" type="button" onClick={() => upd((d) => { d.levels.push(newLevel(d.levels.length + 1)); })}>+ {t("level")}</button>
          <button className="btn pri" type="button" onClick={save}>{t("save")}</button></div>
        <p className="tiny faint">{A("الدروس المحفوظة تحتفظ بمعرّفها عند التعديل، فلا يضيع تقدم المتدربين. حذف درس يحذف تقدمه.", "Saved lessons keep their id when edited, so trainee progress survives. Deleting a lesson deletes its progress.")}</p>
      </div>}
    </Guard>
  );
}

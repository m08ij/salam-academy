"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Head, useToast } from "@/components/ui";
import { get, post, put } from "@/lib/api";
import { num, useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import LessonBody from "@/components/LessonBody";
import Reader from "@/components/Reader";
import Exercise from "@/components/Exercise";

/** A short, light confetti burst (CSS only; skipped when the user prefers reduced motion). */
function celebrate() {
  if (typeof window === "undefined" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const box = document.createElement("div");
  box.className = "confetti";
  for (let i = 0; i < 28; i++) {
    const p = document.createElement("i");
    p.style.setProperty("--x", `${Math.random() * 100}vw`); p.style.setProperty("--d", `${0.9 + Math.random() * 0.8}s`); p.style.setProperty("--h", `${Math.floor(Math.random() * 360)}`);
    box.appendChild(p);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 1900);
}

export default function LessonPage() {
  const { eid, lid } = useParams<{ eid: string; lid: string }>();
  const { t, L, lang, err } = useI18n();
  const { me } = useSession();
  const toast = useToast();
  const router = useRouter();
  const [ls, setLs] = useState<any>(null);
  const [tree, setTree] = useState<any>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<any>(null);
  const [refl, setRefl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<any>(null);
  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([get(`/learn/enrollments/${eid}/lessons/${lid}`), get(`/learn/enrollments/${eid}`)]);
      setLs(a); setTree(b); setRefl(a.reflection); setAnswers(a.questions.map(() => -1)); setResult(null); setError(null);
    } catch (x) { setError(err(x)); }
  }, [eid, lid, err]);
  useEffect(() => { load(); }, [load]);
  if (error && !ls) return <Alert>{error}</Alert>;
  if (!ls || !tree) return <p className="muted">{t("loading")}</p>;
  const open = tree.levels.filter((lv: any) => !lv.locked).flatMap((lv: any) => lv.courses.flatMap((c: any) => c.lessons));
  const i = open.findIndex((x: any) => x.id === lid);
  const prev = open[i - 1], next = open[i + 1];
  const quizOk = !ls.questions.length || (ls.best && ls.best.score >= ls.required_correct) || (result && result.passed);
  const body = L([ls.body_ar, ls.body_en]);
  return (
    <>
      <Head icon="book" eyebrow={L([tree.program.title_ar, tree.program.title_en])} title={L([ls.title_ar, ls.title_en])} sub={ls.hours < 1 ? `${num(Math.max(1, Math.round(ls.hours * 60)), lang)} ${L(["دقيقة قراءة", "min read"])}` : `${num(ls.hours, lang)} ${t("hours")}`} right={ls.done ? <span className="pill ok">{t("completed")}</span> : undefined} />
      {error && <Alert>{error}</Alert>}
      {!!ls.trainer_notes?.length && <div className="card note-card"><h3>💬 {L(["ملاحظة مدربك", "Your trainer's note"])}</h3>{ls.trainer_notes.map((n: any, k: number) => <p key={k} className="small">{n.text}</p>)}</div>}
      <div className="card lesson-card">{tree.program.self_paced && body.split(/\s+/).length > 260 ? <Reader text={body} title={L([ls.title_ar, ls.title_en])} /> : <LessonBody text={body} />}{ls.video_url && <a className="btn" href={ls.video_url} target="_blank" rel="noopener noreferrer">{t("watch")} ↗</a>}</div>
      {ls.questions.length > 0 && (
        <div className="card">
          <h3>{t("quiz")}</h3>
          {ls.questions.map((q: any, qi: number) => (
            <div key={qi} className="stack pan">
              <b style={{ fontSize: ".95rem", color: "var(--ink)" }}>{num(qi + 1, lang)}. {L([q.q_ar, q.q_en])}</b>
              {q.options.map((o: [string, string], oi: number) => {
                const cls = result?.right ? (answers[qi] === oi ? (result.right[qi] ? "right" : "wrong") : "") : "";
                return <button key={oi} type="button" className={`opt ${cls}`} aria-pressed={answers[qi] === oi} onClick={() => { if (result) return; const a = [...answers]; a[qi] = oi; setAnswers(a); }}>{L(o)}</button>;
              })}
            </div>
          ))}
          <div className="row">
            {!result ? <button type="button" className="btn pri" disabled={answers.some((a) => a < 0)} onClick={async () => {
              try { const r = await post(`/learn/enrollments/${eid}/lessons/${lid}/quiz`, { answers }); setResult(r); } catch (x) { setError(err(x)); }
            }}>{t("checkAnswers")}</button> : <button type="button" className="btn" onClick={() => { setResult(null); setAnswers(ls.questions.map(() => -1)); }}>↻</button>}
            {result && <span className={`pill ${result.passed ? "ok" : "warn"}`}>{num(result.score, lang)}/{num(result.total, lang)}</span>}
            {result && !result.right && <span className="small muted">{result.passed ? L(["نجحت! اضغط «أكمل الدرس» لإتمام الدورة.", "Passed! Press “Complete” to finish the course."]) : L(["لم تصل إلى ٧٠٪ بعد. راجع الدروس (يمكنك سؤال المساعد) ثم أعد المحاولة.", "Not 70% yet. Review the lessons (you can ask the assistant), then try again."])}</span>}
            <span className="tiny faint">{t("needCorrect")} {num(ls.required_correct, lang)}</span>
          </div>
        </div>
      )}
      <Exercise title={ls.title_ar} value={refl} onSave={(v) => { setRefl(v); put(`/learn/enrollments/${eid}/lessons/${lid}/reflection`, { text: v }).catch(() => {}); }} />
      <div className="card">
        <h3>{t("reflection")}</h3>
        <textarea className="inp" value={refl.replace(/\n*⟦تمرين⟧\{.*\}/s, "")} maxLength={5000} placeholder={t("reflectionHint")} aria-label={t("reflection")} onChange={(e) => {
          const v = e.target.value + (refl.match(/\n*⟦تمرين⟧\{.*\}/s)?.[0] || ""); setRefl(v); clearTimeout(timer.current);
          timer.current = setTimeout(() => put(`/learn/enrollments/${eid}/lessons/${lid}/reflection`, { text: v }).catch(() => {}), 900);
        }} />
        <p className="tiny faint">{me?.share_reflections ? t("reflShared") : t("reflPrivate")}</p>
      </div>
      <div className="card row between">
        <div>{prev && <Link className="btn" href={`/learn/${eid}/lesson/${prev.id}`}>{t("prevLesson")}</Link>}</div>
        <div className="row">
          <button type="button" className="btn pri" disabled={!quizOk || ls.done} onClick={async () => {
            try {
              const r = await post(`/learn/enrollments/${eid}/lessons/${lid}/complete`);
              if (r?.completed_course) { celebrate(); toast(L(["مبارك! أتممت الدورة 🎓", "Congratulations — you completed the course! 🎓"])); router.push("/learn"); return; }
              celebrate(); toast(L(["أحسنت! خطوة جديدة نحو هويتك ✨", "Well done! One more step ✨"])); await new Promise((ok) => setTimeout(ok, 900)); if (next) router.push(`/learn/${eid}/lesson/${next.id}`); else router.push(`/learn/${eid}`); } catch (x) { setError(err(x)); }
          }}>{ls.done ? t("completed") + " ✓" : t("complete")}</button>
          {next ? <Link className="btn" href={`/learn/${eid}/lesson/${next.id}`}>{t("nextLesson")}</Link> : <Link className="btn" href={`/learn/${eid}`}>{t("toJourney")}</Link>}
        </div>
      </div>
    </>
  );
}

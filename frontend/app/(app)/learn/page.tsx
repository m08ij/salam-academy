"use client";
import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import Icon from "@/components/icons";
import { Empty, Stats } from "@/components/ui";
import { get } from "@/lib/api";
import { date, num, useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { pushWidget } from "@/lib/native";
import CourseAssistant from "@/components/CourseAssistant";

type En = { id: string; program: { slug?: string; title_ar: string; title_en: string }; level: number; levels: number; graduated: boolean; trainer: string | null };

/** Circular progress; animates from empty on first paint. */
function Ring({ pct, label }: { pct: number; label: string }) {
  const { lang } = useI18n();
  const R = 52, C = 2 * Math.PI * R;
  const [shown, setShown] = useState(0);
  useEffect(() => { const id = requestAnimationFrame(() => setShown(pct)); return () => cancelAnimationFrame(id); }, [pct]);
  return (
    <div className="ring" role="img" aria-label={`${pct}%`}>
      <svg viewBox="0 0 120 120"><circle className="bg" cx="60" cy="60" r={R} /><circle className="fg" cx="60" cy="60" r={R} strokeDasharray={C} strokeDashoffset={C * (1 - shown / 100)} /></svg>
      <div className="lbl"><div><b>{num(pct, lang)}٪</b><span>{label}</span></div></div>
    </div>
  );
}

export default function Learn() {
  const { t, L, lang } = useI18n();
  const { me } = useSession();
  const [ens, setEns] = useState<En[] | null>(null);
  const [tree, setTree] = useState<Record<string, any>>({});
  const [ann, setAnn] = useState<any[]>([]);
  useEffect(() => {
    get<En[]>("/learn/enrollments").then(async (r) => {
      r.sort((a, b) => Number(b.program.slug === "identity") - Number(a.program.slug === "identity")); // the Identity course leads
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

  const hour = new Date().getHours();
  const hello = hour < 12 ? L(["صباح الخير", "Good morning"]) : L(["مساء الخير", "Good evening"]);
  const first = (me?.name || "").split(/\s+/)[0];

  return (
    <>
      {ens === null ? <div className="stack"><div className="skel" style={{ height: 210, borderRadius: 22 }} /><div className="skel" style={{ height: 80 }} /></div>
        : ens.length === 0 ? <>
          <div className="card hero"><span className="eyebrow">{t("brand")}</span><h1>{hello}{lang === "ar" ? "، " : ", "}{first} 👋</h1><p>{L(["مرحبًا بك في أكاديمية سلام.", "Welcome to Salam Academy."])}</p></div>
          <Empty icon="learn">{L(["لم تُسجَّل في برنامج بعد. سيسجّلك مسؤول المنصة ويُسند إليك مدربًا، وستظهر رحلتك هنا.", "You are not enrolled yet. The platform admin will enroll you and assign a trainer — your journey will appear here."])}</Empty>
        </> :
        ens.map((e) => {
          const tr = tree[e.id];
          const st = tr?.stats;
          const lv = tr?.levels?.[e.level - 1];
          const next = lv?.courses.flatMap((c: any) => c.lessons).find((x: any) => !x.done);
          const pct = st && st.lessons_total ? Math.round((100 * st.lessons_done) / st.lessons_total) : 0;
          return (
            <Fragment key={e.id}>
              <div className="card hero">
                <div className="home-hero">
                  <Ring pct={e.graduated ? 100 : pct} label={e.graduated ? t("graduated") : L(["من المستوى", "of level"])} />
                  <div className="stack" style={{ gap: 10 }}>
                    <span className="eyebrow">{hello}{lang === "ar" ? "، " : ", "}{first} · {L([e.program.title_ar, e.program.title_en])}</span>
                    <h1>{e.graduated ? L(["أتممت البرنامج، مبارك! 🎓", "You completed the program — congratulations! 🎓"]) : lv ? L([lv.title_ar, lv.title_en]) : "…"}</h1>
                    <div className="steps" aria-label={t("level")}>
                      {Array.from({ length: e.levels }, (_, i) => i + 1).map((n) => (
                        <Fragment key={n}>
                          {n > 1 && <span className="ln" />}
                          <span className={`st ${e.graduated || n < e.level ? "done" : n === e.level ? "cur" : ""}`}><i>{e.graduated || n < e.level ? "✓" : num(n, lang)}</i>{n === e.level && !e.graduated ? L(["أنت هنا", "You are here"]) : ""}</span>
                        </Fragment>
                      ))}
                    </div>
                    <p className="small">{e.trainer ? `${t("trainer")}: ${e.trainer}` : t("noTrainer")}</p>
                    <div className="row"><Link className="btn" href={`/learn/${e.id}`}>{t("toJourney")}</Link></div>
                  </div>
                </div>
              </div>

              {next && !e.graduated && (
                <Link className="next-card" href={`/learn/${e.id}/lesson/${next.id}`}>
                  <span className="play"><Icon name="play" /></span>
                  <span className="stack" style={{ gap: 2 }}><span className="tiny faint">{L(["تابع من حيث توقفت", "Pick up where you left off"])}</span><b>{L([next.title_ar, next.title_en])}</b></span>
                  <Icon name="arrow" className="ico go" />
                </Link>
              )}

              {st && <Stats items={[
                { icon: "book", value: `${num(st.lessons_done, lang)}/${num(st.lessons_total, lang)}`, label: L(["دروس المستوى", "Level lessons"]), tone: "acc" },
                { icon: "quiz", value: st.quiz ?? "—", suffix: st.quiz == null ? undefined : "٪", label: t("quizzes"), tone: "info" },
                { icon: "star", value: st.eval == null ? "—" : `${num(st.eval, lang)}/${num(5, lang)}`, label: t("evaluation"), tone: "gold" },
                { icon: "medal", value: st.final ?? 0, suffix: "٪", label: st.final_provisional ? L(["العلامة (مبدئية)", "Grade (provisional)"]) : t("final"), tone: st.eligible ? "ok" : "acc" },
              ]} />}
            </Fragment>
          );
        })}

      {ens?.some((e) => e.program.slug === "identity") && <CourseAssistant />}
      <div className="card">
        <div className="row between"><h3>{t("announcements")}</h3>{ann.length > 0 && <span className="pill acc">{num(ann.length, lang)}</span>}</div>
        {ann.length ? ann.map((a) => (
          <div key={a.id} className="stack" style={{ gap: 4, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
            <b>{a.title}</b><p className="small muted pre">{a.body}</p><span className="tiny faint">{date(a.at, lang)}</span>
          </div>
        )) : <p className="muted small">{L(["لا إعلانات حاليًا. ستظهر هنا رسائل مدربك وإدارة الأكاديمية.", "No announcements yet. Messages from your trainer and the academy will appear here."])}</p>}
      </div>
    </>
  );
}

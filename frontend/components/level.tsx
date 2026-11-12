"use client";
import { num, useI18n } from "@/lib/i18n";

export type Stats = {
  level: number; levels: number; level_title: [string, string]; graduated: boolean; lessons_total: number; lessons_done: number;
  quiz: number | null; eval: number | null; project: number | null; project_status: string; final: number; final_provisional: boolean; grade: [string, string] | null;
  weights: { quiz: number; eval: number; project: number }; checks: { key: string; ok: boolean; value: any; required?: number; status?: string }[]; eligible: boolean;
};

export function LevelTrack({ levels, current, graduated }: { levels: { position: number; title_ar: string; title_en: string }[]; current: number; graduated: boolean }) {
  const { t, L, lang } = useI18n();
  return (
    <div className="lvtrack">
      {levels.map((lv) => {
        const st = graduated || lv.position < current ? "done" : lv.position === current ? "cur" : "lock";
        return <div key={lv.position} className={`lvstep ${st}`}><b>{num(lv.position, lang)}</b><span>{L([lv.title_ar, lv.title_en])}</span><i>{st === "done" ? t("passed") + " ✓" : st === "cur" ? t("current") : "🔒 " + t("locked")}</i></div>;
      })}
    </div>
  );
}

export function Checks({ stats }: { stats: Stats }) {
  const { t, lang } = useI18n();
  const fmt = (c: Stats["checks"][0]) => {
    if (c.key === "lessons") return c.value;
    if (c.key === "eval") return c.value == null ? "—" : `${num(c.value, lang)} / ٥`;
    if (c.key === "project" && c.value == null) return t("p_" + (c.status || "none"));
    return c.value == null ? "—" : `${num(c.value, lang)}٪`;
  };
  return (
    <ul className="chk">
      {stats.checks.map((c) => (
        <li key={c.key} className={c.ok ? "ok" : ""}>
          <span className="ci" aria-hidden="true">{c.ok ? "✓" : "•"}</span><span>{t("c_" + c.key)}</span><b className="num">{fmt(c)}</b>
          {c.required != null && <span className="tiny faint">{t("required")}: {c.key === "eval" ? `${num(c.required, lang)} / ٥` : `${num(c.required, lang)}٪`}</span>}
        </li>
      ))}
    </ul>
  );
}

export function ScoreCards({ stats }: { stats: Stats }) {
  const { t, L, lang } = useI18n();
  const cards: [string, string][] = [
    [stats.quiz == null ? "—" : `${num(stats.quiz, lang)}٪`, `${t("quizzes")} · ${num(stats.weights.quiz, lang)}٪`],
    [stats.eval == null ? "—" : `${num(stats.eval, lang)} / ٥`, `${t("evaluation")} · ${num(stats.weights.eval, lang)}٪`],
    [stats.project == null ? "—" : `${num(stats.project, lang)}٪`, `${t("project")} · ${num(stats.weights.project, lang)}٪`],
    [`${num(stats.final, lang)}٪`, `${t("final")} · ${stats.final_provisional ? t("provisional") : L(stats.grade)}`],
  ];
  return <div className="grid g4">{cards.map(([v, l]) => <div key={l} className="card stat"><span className="v">{v}</span><span className="l">{l}</span></div>)}</div>;
}

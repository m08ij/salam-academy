"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/icons";
import { Guard } from "@/components/Shell";
import { Avatar, Empty, Head, Stats, StatusPill } from "@/components/ui";
import { download, get } from "@/lib/api";
import { date, num, useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";

type Filter = "all" | "eligible" | "pending" | "graduated";

export default function Trainer() {
  const { t, L, lang } = useI18n();
  const { can } = useSession();
  const router = useRouter();
  const [scope, setScope] = useState("mine");
  const [rows, setRows] = useState<any[] | null>(null);
  const [trainers, setTrainers] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  useEffect(() => { if (can("users")) get("/admin/trainers").then(setTrainers).catch(() => {}); }, [can]);
  useEffect(() => { setRows(null); get(`/training/trainees?scope=${scope}`).then(setRows).catch(() => setRows([])); }, [scope]);

  const elig = rows?.filter((r) => r.stats.eligible).length || 0;
  const pend = rows?.filter((r) => r.stats.project_status === "pending").length || 0;
  const grad = rows?.filter((r) => r.stats.graduated).length || 0;
  const avg = rows?.length ? Math.round(rows.reduce((s, r) => s + r.stats.final, 0) / rows.length) : 0;
  const shown = useMemo(() => (rows || []).filter((r) => {
    if (filter === "eligible" && !r.stats.eligible) return false;
    if (filter === "pending" && r.stats.project_status !== "pending") return false;
    if (filter === "graduated" && !r.stats.graduated) return false;
    const s = q.trim().toLowerCase();
    return !s || r.user.name.toLowerCase().includes(s) || (r.user.email || "").toLowerCase().includes(s);
  }), [rows, q, filter]);
  const ar = lang === "ar";

  return (
    <Guard perm="train">
      <Head icon="trainer" eyebrow={t("nav_trainer")} title={can("train_all") ? t("trainees") : t("mine")}
        sub={L(["تابع تقدّم المتدربين، وقيّمهم، واعتمد انتقالهم بين المستويات.", "Follow progress, evaluate, and approve level promotions."])}
        right={<>
          {can("train_all") && <select className="inp" style={{ width: "auto" }} value={scope} onChange={(e) => setScope(e.target.value)} aria-label={t("trainer")}>
            <option value="mine">{t("mine")}</option><option value="all">{t("all")}</option><option value="none">{t("unassigned")}</option>
            {trainers.map((x) => <option key={x.id} value={x.id}>{t("trainer")}: {x.name}</option>)}</select>}
          {can("export") && <button className="btn" type="button" onClick={() => download("/admin/export/trainees.xlsx", "salam-trainees.xlsx")}><Icon name="enroll" />Excel</button>}
        </>} />

      <Stats items={[
        { icon: "people", value: rows?.length ?? 0, label: t("trainees"), tone: "acc" },
        { icon: "medal", value: elig, label: t("eligible"), tone: "ok" },
        { icon: "enroll", value: pend, label: L(["مشاريع بانتظار المراجعة", "Projects awaiting review"]), tone: "gold" },
        { icon: "star", value: avg, suffix: "٪", label: L(["متوسط العلامة النهائية", "Average final grade"]), tone: "info" },
      ]} />

      <div className="toolbar">
        <label className="search"><Icon name="search" /><input className="inp" placeholder={L(["ابحث بالاسم أو البريد…", "Search by name or e-mail…"])} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t("search")} /></label>
        <div className="chips" role="group" aria-label={t("status")}>
          {([["all", L(["الكل", "All"]), rows?.length ?? 0], ["eligible", t("eligible"), elig], ["pending", t("p_pending"), pend], ["graduated", t("graduated"), grad]] as [Filter, string, number][]).map(([k, l, n]) => (
            <button key={k} type="button" className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}<span className="n">{num(n, lang)}</span></button>
          ))}
        </div>
      </div>

      {rows === null ? <div className="stack"><div className="skel" style={{ height: 64 }} /><div className="skel" style={{ height: 64 }} /><div className="skel" style={{ height: 64 }} /></div>
        : shown.length === 0 ? <Empty icon="people">{rows.length === 0 ? L(["لا يوجد متدربون مسندون إليك بعد. سيظهرون هنا حين يسندهم المسؤول.", "No trainees assigned yet. They will appear here once an admin assigns them."]) : L(["لا نتائج مطابقة.", "No matching results."])}</Empty> :
        <div className="tbl-wrap cards"><table>
          <thead><tr><th>{t("name")}</th><th>{t("level")}</th><th>{L(["الدروس", "Lessons"])}</th><th>{t("quizzes")}</th><th>{t("evaluation")}</th><th>{t("project")}</th><th>{t("final")}</th><th>{t("status")}</th>{can("train_all") && <th>{t("trainer")}</th>}<th>{t("lastActive")}</th><th /></tr></thead>
          <tbody>{shown.map((r) => {
            const pct = r.stats.lessons_total ? Math.round(100 * r.stats.lessons_done / r.stats.lessons_total) : 0;
            const done = r.stats.checks.filter((c: any) => c.ok).length;
            return (
              <tr key={r.enrollment_id} data-href onClick={(e) => { if (!(e.target as HTMLElement).closest("a,button,select")) router.push(`/trainer/${r.enrollment_id}`); }}>
                <td className="lead"><span className="who-cell"><Avatar name={r.user.name} /><div><b>{r.user.name}</b>{r.alerts?.includes("inactive") && <span className="pill warn tiny">{L(["غير نشط ٧ أيام", "Inactive 7d"])}</span>}{r.alerts?.includes("exam") && <span className="pill bad tiny">{L(["تعثّر في الاختبار", "Exam trouble"])}</span>}<span className="tiny faint">{L([r.program.title_ar, r.program.title_en])}</span></div></span></td>
                <td data-label={t("level")}>{r.stats.graduated ? <span className="pill ok">{t("graduated")}</span> : <span className="pill acc">{num(r.stats.level, lang)} / {num(r.stats.levels, lang)}</span>}</td>
                <td data-label={L(["الدروس", "Lessons"])}><span className="mini-bar"><span className="bar"><i style={{ width: `${pct}%` }} /></span><span className="tiny num">{num(r.stats.lessons_done, lang)}/{num(r.stats.lessons_total, lang)}</span></span></td>
                <td data-label={t("quizzes")} className="num">{r.stats.quiz == null ? "—" : `${num(r.stats.quiz, lang)}٪`}</td>
                <td data-label={t("evaluation")} className="num">{r.stats.eval == null ? "—" : `${num(r.stats.eval, lang)} / ${num(5, lang)}`}</td>
                <td data-label={t("project")}><StatusPill s={r.stats.project_status} /></td>
                <td data-label={t("final")} className="num"><b>{num(r.stats.final, lang)}٪</b></td>
                <td data-label={t("status")}>{r.stats.graduated ? <span className="pill ok">🎓 {t("graduated")}</span> : r.stats.eligible ? <span className="pill ok">✓ {t("eligible")}</span> : <span className="pill">{num(done, lang)}/{num(r.stats.checks.length, lang)} {ar ? "شروط" : "criteria"}</span>}</td>
                {can("train_all") && <td data-label={t("trainer")} className="small">{r.trainer || "—"}</td>}
                <td data-label={t("lastActive")} className="small faint">{date(r.last_login_at, lang)}</td>
                <td><Link className="btn sm" href={`/trainer/${r.enrollment_id}`}>{t("open")}<Icon name="arrow" className="ico flip" /></Link></td>
              </tr>
            );
          })}</tbody></table></div>}
    </Guard>
  );
}

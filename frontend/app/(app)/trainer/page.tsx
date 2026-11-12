"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Guard } from "@/components/Shell";
import { Empty, Head, StatusPill } from "@/components/ui";
import { download, get } from "@/lib/api";
import { date, num, useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";

export default function Trainer() {
  const { t, L, lang } = useI18n();
  const { can } = useSession();
  const [scope, setScope] = useState("mine");
  const [rows, setRows] = useState<any[] | null>(null);
  const [trainers, setTrainers] = useState<any[]>([]);
  useEffect(() => { if (can("users")) get("/admin/trainers").then(setTrainers).catch(() => {}); }, [can]);
  useEffect(() => { setRows(null); get(`/training/trainees?scope=${scope}`).then(setRows).catch(() => setRows([])); }, [scope]);
  const elig = rows?.filter((r) => r.stats.eligible).length || 0;
  const pend = rows?.filter((r) => r.stats.project_status === "pending").length || 0;
  const avg = rows?.length ? Math.round(rows.reduce((s, r) => s + r.stats.final, 0) / rows.length) : 0;
  return (
    <Guard perm="train">
      <Head eyebrow={t("nav_trainer")} title={can("train_all") ? t("trainees") : t("mine")} right={<div className="row">
        {can("train_all") && <select className="inp sm" value={scope} onChange={(e) => setScope(e.target.value)} aria-label="scope">
          <option value="mine">{t("mine")}</option><option value="all">{t("all")}</option><option value="none">{t("unassigned")}</option>
          {trainers.map((x) => <option key={x.id} value={x.id}>{t("trainer")}: {x.name}</option>)}</select>}
        {can("export") && <button className="btn" type="button" onClick={() => download("/admin/export/trainees.xlsx", "salam-trainees.xlsx")}>Excel</button>}
      </div>} />
      <div className="grid g4">{[[rows?.length || 0, t("trainees")], [elig, t("eligible")], [pend, t("p_pending")], [`${num(avg, lang)}٪`, t("final")]].map(([v, l]) => <div key={String(l)} className="card stat"><span className="v">{typeof v === "number" ? num(v, lang) : v}</span><span className="l">{l}</span></div>)}</div>
      {rows === null ? <p className="muted">{t("loading")}</p> : rows.length === 0 ? <Empty>{t("noData")}</Empty> :
        <div className="tbl-wrap"><table><thead><tr><th>{t("name")}</th><th>{t("program")}</th><th>{t("level")}</th><th>{t("quizzes")}</th><th>{t("evaluation")}</th><th>{t("project")}</th><th>{t("final")}</th><th>{t("status")}</th>{can("train_all") && <th>{t("trainer")}</th>}<th>{t("lastActive")}</th><th /></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.enrollment_id}>
            <td><b>{r.user.name}</b></td><td>{L([r.program.title_ar, r.program.title_en])}</td>
            <td>{r.stats.graduated ? t("graduated") : `${num(r.stats.level, lang)} · ${num(r.stats.lessons_done, lang)}/${num(r.stats.lessons_total, lang)}`}</td>
            <td className="num">{r.stats.quiz == null ? "—" : `${num(r.stats.quiz, lang)}٪`}</td><td className="num">{r.stats.eval == null ? "—" : num(r.stats.eval, lang)}</td>
            <td><StatusPill s={r.stats.project_status} /></td><td className="num">{num(r.stats.final, lang)}٪</td>
            <td>{r.stats.graduated ? <span className="pill ok">{t("graduated")}</span> : r.stats.eligible ? <span className="pill ok">{t("eligible")}</span> : <span className="pill">{num(r.stats.checks.filter((c: any) => c.ok).length, lang)}/{num(r.stats.checks.length, lang)}</span>}</td>
            {can("train_all") && <td className="small">{r.trainer || "—"}</td>}<td className="small">{date(r.last_login_at, lang)}</td>
            <td><Link className="btn sm" href={`/trainer/${r.enrollment_id}`}>{t("open")}</Link></td></tr>)}</tbody></table></div>}
    </Guard>
  );
}

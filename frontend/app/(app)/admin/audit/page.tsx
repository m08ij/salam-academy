"use client";
import { useCallback, useEffect, useState } from "react";
import { Guard } from "@/components/Shell";
import { Head } from "@/components/ui";
import { get } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function Audit() {
  const { t, lang } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  const [action, setAction] = useState("");
  const [more, setMore] = useState(true);
  const load = useCallback(async (before?: number) => {
    const q = new URLSearchParams({ limit: "100" });
    if (before) q.set("before", String(before));
    if (action) q.set("action", action);
    const r = await get<any[]>(`/admin/audit?${q}`);
    setRows((x) => (before ? [...x, ...r] : r)); setMore(r.length === 100);
  }, [action]);
  useEffect(() => { load(); }, [load]);
  return (
    <Guard perm="audit">
      <Head eyebrow={t("security")} title={t("nav_audit")} right={<input className="inp sm" placeholder="action…" value={action} onChange={(e) => setAction(e.target.value.trim())} aria-label="action" dir="ltr" />} />
      <div className="tbl-wrap"><table><thead><tr><th>{lang === "ar" ? "الوقت" : "Time"}</th><th>{lang === "ar" ? "المنفّذ" : "Actor"}</th><th>{t("role")}</th><th>{lang === "ar" ? "الإجراء" : "Action"}</th><th>{lang === "ar" ? "الهدف" : "Target"}</th><th>IP</th><th>{lang === "ar" ? "التفاصيل" : "Details"}</th></tr></thead><tbody>
        {rows.map((r) => <tr key={r.id}><td className="small">{new Date(r.ts + "Z").toLocaleString(lang === "ar" ? "ar-EG" : "en-GB")}</td><td>{r.actor || "—"}</td><td className="small">{r.actor_role ? t("role_" + r.actor_role) : "—"}</td>
          <td><span className="pill" dir="ltr">{r.action}</span></td><td className="tiny" dir="ltr">{r.target_type ? `${r.target_type}:${(r.target_id || "").slice(0, 8)}` : ""}</td><td className="tiny" dir="ltr">{r.ip}</td><td className="tiny" dir="ltr">{Object.keys(r.detail || {}).length ? JSON.stringify(r.detail) : ""}</td></tr>)}</tbody></table></div>
      {more && rows.length > 0 && <button className="btn" type="button" onClick={() => load(rows[rows.length - 1].id)}>{lang === "ar" ? "المزيد" : "More"}</button>}
    </Guard>
  );
}

"use client";
import { useCallback, useEffect, useState } from "react";
import { Guard } from "@/components/Shell";
import { Head } from "@/components/ui";
import { get } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

// Human-readable names for actions and detail fields (unknown ones fall back to the raw key).
const ACT: Record<string, [string, string]> = {
  login: ["تسجيل دخول", "Sign-in"], login_failed: ["محاولة دخول فاشلة", "Failed sign-in"], login_trial_blocked: ["دخول مرفوض (خارج التجربة)", "Blocked (not in trial)"],
  account_locked: ["قفل الحساب", "Account locked"], assistant_question: ["سؤال للمساعد", "Assistant question"], self_enrolled: ["انضم إلى دورة", "Joined a course"],
  self_paced_completed: ["أتمّ الدورة", "Completed the course"], user_invited: ["دعوة مستخدم", "User invited"], role_changed: ["تغيير دور", "Role changed"],
  invite_accepted: ["قبول دعوة", "Invite accepted"], password_reset: ["استعادة كلمة المرور", "Password reset"], course_content_imported: ["تحديث محتوى الدورة", "Course content updated"],
  trial_user_created: ["إنشاء حساب تجريبي", "Trial account created"], owner_bootstrapped: ["إنشاء المالك", "Owner created"], enrollment_created: ["تسجيل في برنامج", "Enrolled"],
};
const KEY: Record<string, [string, string]> = {
  who: ["السائل", "Asked by"], hits: ["مقاطع مطابقة", "Matches"], trainer: ["المدرب", "Trainer"], program: ["البرنامج", "Program"], role: ["الدور", "Role"],
  old: ["من", "From"], new: ["إلى", "To"], email_hash: ["بصمة البريد", "E-mail hash"], final: ["العلامة", "Grade"], lessons: ["دروس", "Lessons"], exam: ["أسئلة", "Questions"], pages: ["صفحات", "Pages"],
};
const VAL: Record<string, [string, string]> = { staff: ["فريق المنصة", "Staff"], learner: ["متعلّم", "Learner"], identity: ["دورة الهوية", "Identity course"] };

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
      <Head icon="audit" eyebrow={t("security")} title={t("nav_audit")} right={<input className="inp sm" placeholder="action…" value={action} onChange={(e) => setAction(e.target.value.trim())} aria-label="action" dir="ltr" />} />
      <div className="tbl-wrap"><table><thead><tr><th>{lang === "ar" ? "الوقت" : "Time"}</th><th>{lang === "ar" ? "المنفّذ" : "Actor"}</th><th>{t("role")}</th><th>{lang === "ar" ? "الإجراء" : "Action"}</th><th>{lang === "ar" ? "الهدف" : "Target"}</th><th>IP</th><th>{lang === "ar" ? "التفاصيل" : "Details"}</th></tr></thead><tbody>
        {rows.map((r) => <tr key={r.id}><td className="small">{new Date(r.ts + "Z").toLocaleString(lang === "ar" ? "ar-EG" : "en-GB")}</td><td>{r.actor || "—"}</td><td className="small">{r.actor_role ? t("role_" + r.actor_role) : "—"}</td>
          <td><span className="pill" title={r.action}>{ACT[r.action] ? (lang === "ar" ? ACT[r.action][0] : ACT[r.action][1]) : r.action}</span></td><td className="tiny" dir="ltr">{r.target_type ? `${r.target_type}:${(r.target_id || "").slice(0, 8)}` : ""}</td><td className="tiny" dir="ltr">{r.ip}</td><td><div className="row" style={{ gap: 4 }}>{Object.entries(r.detail || {}).map(([k, v]) => {
            const L2 = (p: [string, string] | undefined, f: string) => (p ? (lang === "ar" ? p[0] : p[1]) : f);
            const val = typeof v === "string" && /^[0-9a-f-]{36}$/.test(v) ? v.slice(0, 8) : L2(VAL[String(v)], ["role", "old", "new"].includes(k) ? t("role_" + v) : String(v));
            return <span key={k} className="pill tiny">{L2(KEY[k], k)}: <b>{val}</b></span>;
          })}</div></td></tr>)}</tbody></table></div>
      {more && rows.length > 0 && <button className="btn" type="button" onClick={() => load(rows[rows.length - 1].id)}>{lang === "ar" ? "المزيد" : "More"}</button>}
    </Guard>
  );
}

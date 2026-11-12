"use client";
import { useCallback, useEffect, useState } from "react";
import { Guard } from "@/components/Shell";
import { Alert, Field, Head, useToast } from "@/components/ui";
import { get, patch, post } from "@/lib/api";
import { num, useI18n } from "@/lib/i18n";

export default function Enrollments() {
  const { t, L, lang, err } = useI18n();
  const toast = useToast();
  const [ens, setEns] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [progs, setProgs] = useState<any[]>([]);
  const [trainers, setTrainers] = useState<any[]>([]);
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [form, setForm] = useState({ user_id: "", program_id: "", trainer_id: "", cohort_id: "" });
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const [a, b, c, d, e] = await Promise.all([get("/admin/enrollments"), get("/admin/users"), get("/programs"), get("/admin/trainers"), get("/cohorts")]);
    setEns(a); setUsers(b.filter((u: any) => u.role === "trainee" && u.status !== "deleted")); setProgs(c); setTrainers(d); setCohorts(e);
  }, []);
  useEffect(() => { load().catch((x) => setError(err(x))); }, [load, err]);
  const act = async (fn: () => Promise<any>) => { setError(null); try { await fn(); toast(t("saved")); await load(); } catch (x) { setError(err(x)); } };
  return (
    <Guard perm="users">
      <Head icon="enroll" eyebrow={t("nav_users")} title={t("nav_enroll")} />
      {error && <Alert>{error}</Alert>}
      <form className="card" onSubmit={(e) => { e.preventDefault(); act(() => post("/admin/enrollments", { ...form, trainer_id: form.trainer_id || null, cohort_id: form.cohort_id || null })); }}>
        <div className="fgrid g4f">
          <Field label={t("role_trainee")} id="eu"><select className="inp" id="eu" required value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })}><option value="">—</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
          <Field label={t("program")} id="ep"><select className="inp" id="ep" required value={form.program_id} onChange={(e) => setForm({ ...form, program_id: e.target.value })}><option value="">—</option>{progs.map((p) => <option key={p.id} value={p.id}>{L([p.title_ar, p.title_en])}</option>)}</select></Field>
          <Field label={t("trainer")} id="et"><select className="inp" id="et" value={form.trainer_id} onChange={(e) => setForm({ ...form, trainer_id: e.target.value })}><option value="">—</option>{trainers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
          <Field label={t("cohort")} id="ec"><select className="inp" id="ec" value={form.cohort_id} onChange={(e) => setForm({ ...form, cohort_id: e.target.value })}><option value="">—</option>{cohorts.filter((c) => !form.program_id || c.program_id === form.program_id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        </div>
        <div><button className="btn pri" type="submit">{t("save")}</button></div>
      </form>
      <div className="tbl-wrap"><table><thead><tr><th>{t("role_trainee")}</th><th>{t("program")}</th><th>{t("level")}</th><th>{t("trainer")}</th><th>{t("cohort")}</th></tr></thead><tbody>
        {ens.map((e) => <tr key={e.id}><td><b>{e.user.name}</b><div className="tiny faint" dir="ltr">{e.user.email}</div></td><td>{L([e.program.title_ar, e.program.title_en])}</td>
          <td>{e.graduated ? t("graduated") : `${num(e.level, lang)} / ${num(e.levels, lang)}`}</td>
          <td><select className="inp sm" aria-label={t("trainer")} value={e.trainer?.id || ""} onChange={(x) => act(() => patch(`/admin/enrollments/${e.id}`, { trainer_id: x.target.value || null }))}><option value="">—</option>{trainers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></td>
          <td><select className="inp sm" aria-label={t("cohort")} value={e.cohort_id || ""} onChange={(x) => act(() => patch(`/admin/enrollments/${e.id}`, { cohort_id: x.target.value || null }))}><option value="">—</option>{cohorts.filter((c) => c.program_id === e.program.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></td></tr>)}
      </tbody></table></div>
    </Guard>
  );
}

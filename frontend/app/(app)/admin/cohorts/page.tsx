"use client";
import { useCallback, useEffect, useState } from "react";
import { Guard } from "@/components/Shell";
import { Alert, ConfirmButton, Field, Head, useToast } from "@/components/ui";
import { del, get, post } from "@/lib/api";
import { date, useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";

export default function Cohorts() {
  const { t, L, lang, err } = useI18n();
  const { can } = useSession();
  const toast = useToast();
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [progs, setProgs] = useState<any[]>([]);
  const [ann, setAnn] = useState<any[]>([]);
  const [c, setC] = useState({ program_id: "", name: "", starts_on: "", ends_on: "", mode: "online", place: "", capacity: 30 });
  const [a, setA] = useState({ title: "", body: "" });
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const [x, y, z] = await Promise.all([get("/cohorts"), get("/programs"), get("/announcements")]);
    setCohorts(x); setProgs(y); setAnn(z);
  }, []);
  useEffect(() => { load().catch((e) => setError(err(e))); }, [load, err]);
  const act = async (fn: () => Promise<any>) => { setError(null); try { await fn(); toast(t("saved")); await load(); } catch (x) { setError(err(x)); } };
  return (
    <Guard perm="announce">
      <Head icon="cohorts" eyebrow={t("nav_trainer")} title={t("nav_cohorts")} />
      {error && <Alert>{error}</Alert>}
      {can("cohorts") && <form className="card" onSubmit={(e) => { e.preventDefault(); act(() => post("/cohorts", { ...c, starts_on: c.starts_on || null, ends_on: c.ends_on || null, capacity: Number(c.capacity) })); }}>
        <h3>{t("cohort")}</h3>
        <div className="fgrid g4f">
          <Field label={t("program")} id="cp"><select className="inp" id="cp" required value={c.program_id} onChange={(e) => setC({ ...c, program_id: e.target.value })}><option value="">—</option>{progs.map((p) => <option key={p.id} value={p.id}>{L([p.title_ar, p.title_en])}</option>)}</select></Field>
          <Field label={t("name")} id="cn"><input className="inp" id="cn" required minLength={2} value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} /></Field>
          <Field label={lang === "ar" ? "البداية" : "Start"} id="cs"><input className="inp" id="cs" type="date" value={c.starts_on} onChange={(e) => setC({ ...c, starts_on: e.target.value })} /></Field>
          <Field label={lang === "ar" ? "النهاية" : "End"} id="ce"><input className="inp" id="ce" type="date" value={c.ends_on} onChange={(e) => setC({ ...c, ends_on: e.target.value })} /></Field>
          <Field label={lang === "ar" ? "النمط" : "Mode"} id="cm"><select className="inp" id="cm" value={c.mode} onChange={(e) => setC({ ...c, mode: e.target.value })}><option value="online">{lang === "ar" ? "إلكتروني" : "Online"}</option><option value="onsite">{lang === "ar" ? "حضوري" : "On site"}</option><option value="blended">{lang === "ar" ? "مدمج" : "Blended"}</option></select></Field>
          <Field label={lang === "ar" ? "المكان / الرابط" : "Place / link"} id="cl"><input className="inp" id="cl" value={c.place} onChange={(e) => setC({ ...c, place: e.target.value })} /></Field>
          <Field label={lang === "ar" ? "السعة" : "Capacity"} id="cc"><input className="inp" id="cc" type="number" min={1} value={c.capacity} onChange={(e) => setC({ ...c, capacity: Number(e.target.value) })} /></Field>
        </div>
        <div><button className="btn pri" type="submit">{t("save")}</button></div>
      </form>}
      <div className="tbl-wrap"><table><thead><tr><th>{t("name")}</th><th>{t("program")}</th><th>{lang === "ar" ? "البداية" : "Start"}</th><th>{lang === "ar" ? "النمط" : "Mode"}</th><th /></tr></thead><tbody>
        {cohorts.map((x) => <tr key={x.id}><td>{x.name}</td><td>{L([progs.find((p) => p.id === x.program_id)?.title_ar, progs.find((p) => p.id === x.program_id)?.title_en])}</td><td>{x.starts_on || "—"}</td><td>{x.mode}</td>
          <td>{can("cohorts") && <ConfirmButton className="btn sm danger" onConfirm={() => act(() => del(`/cohorts/${x.id}`))}>{t("delete")}</ConfirmButton>}</td></tr>)}</tbody></table></div>
      <form className="card" onSubmit={(e) => { e.preventDefault(); act(async () => { await post("/announcements", a); setA({ title: "", body: "" }); }); }}>
        <h3>{t("announcements")}</h3>
        <Field label={lang === "ar" ? "العنوان" : "Title"} id="at"><input className="inp" id="at" required minLength={2} value={a.title} onChange={(e) => setA({ ...a, title: e.target.value })} /></Field>
        <Field label={lang === "ar" ? "النص" : "Text"} id="ab"><textarea className="inp" id="ab" value={a.body} onChange={(e) => setA({ ...a, body: e.target.value })} /></Field>
        <div><button className="btn pri" type="submit">{t("send")}</button></div>
        {ann.map((x) => <div key={x.id} className="row between" style={{ borderTop: "1px solid var(--line)", paddingTop: 8 }}><div><b>{x.title}</b><p className="small muted pre">{x.body}</p><span className="tiny faint">{date(x.at, lang)}</span></div><ConfirmButton className="btn sm danger" onConfirm={() => act(() => del(`/announcements/${x.id}`))}>{t("delete")}</ConfirmButton></div>)}
      </form>
    </Guard>
  );
}

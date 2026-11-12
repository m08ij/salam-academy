"use client";
import { useEffect, useState } from "react";
import { Head, Tabs, useToast } from "@/components/ui";
import { get, put } from "@/lib/api";
import { num, useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";

type T = "1" | "2" | "3" | "g";

export default function Values() {
  const { t, L, lang } = useI18n();
  const { can } = useSession();
  const toast = useToast();
  const [tab, setTab] = useState<T>("2");
  const [vals, setVals] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [v, setV] = useState<any>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  useEffect(() => { get("/catalog/groups").then(setGroups); if (can("learn")) get("/me/plan").then(setPlan).catch(() => {}); }, [can]);
  useEffect(() => { if (tab !== "g") get(`/catalog/values?relation=${tab}`).then((r) => { setVals(r); setSel(r[0]?.id ?? null); }); }, [tab]);
  useEffect(() => { if (sel) get(`/catalog/values/${sel}`).then(setV); }, [sel]);
  useEffect(() => { const h = setTimeout(() => { if (q.trim().length >= 2) get(`/catalog/search?q=${encodeURIComponent(q.trim())}`).then(setHits); else setHits(null); }, 300); return () => clearTimeout(h); }, [q]);
  const inPlan = (id: number) => !!plan?.items?.some((i: any) => i.behavior_id === id);
  const toggle = async (id: number) => {
    const items = inPlan(id) ? plan.items.filter((i: any) => i.behavior_id !== id) : [...(plan.items || []), { behavior_id: id, note: "" }];
    const next = { ...plan, items }; setPlan(next); await put("/me/plan", next); toast(t("saved"));
  };
  const Beh = ({ b }: { b: any }) => <li className="lsn"><span>{lang === "ar" ? b.ar : b.en || b.ar}</span>{plan && <button type="button" className={`btn sm ${inPlan(b.id) ? "pri" : ""}`} aria-pressed={inPlan(b.id)} onClick={() => toggle(b.id)}>{inPlan(b.id) ? t("inPlan") + " ✓" : "+ " + t("addToPlan")}</button>}</li>;
  return (
    <>
      <Head eyebrow={t("brand")} title={t("nav_values")} right={<input className="inp" style={{ width: "min(320px,100%)" }} placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t("search")} />} />
      {hits && <div className="card"><h3>{t("behaviors")}</h3><div className="row">{hits.values.map((x: any) => <button key={x.id} type="button" className="btn sm" onClick={() => { setTab(String(x.relation) as T); setSel(x.id); setQ(""); }}>{L([x.title_ar, x.title_en])}</button>)}</div><ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>{hits.behaviors.map((b: any) => <Beh key={b.id} b={b} />)}</ul></div>}
      <Tabs<T> value={tab} onChange={setTab} tabs={[["1", t("rel1")], ["2", t("rel2")], ["3", t("rel3")], ["g", t("groups")]]} />
      {tab === "g" ? <div className="grid g3">{groups.map((g) => <div key={g.id} className="card" style={{ borderTop: `6px solid ${g.color}` }}><span className="eyebrow">{num(g.position, lang)} / ١٢</span><h3>{L([g.title_ar, g.title_en])}</h3><p className="small muted">{L([g.desc_ar, g.desc_en])}</p><div className="row">{g.names.map((n: any) => <span key={n.id} className="pill">{L([n.ar, n.en])}</span>)}</div></div>)}</div> :
        <div className="vsplit">
          <div className="card vlist" role="listbox" aria-label={t("nav_values")}>{vals.map((x) => <button key={x.id} type="button" className="opt" role="option" aria-selected={sel === x.id} aria-pressed={sel === x.id} onClick={() => setSel(x.id)}>{L([x.title_ar, x.title_en])}</button>)}</div>
          {v && <div className="stack">
            <div className="card"><h2>{L([v.title_ar, v.title_en])}</h2>
              <div className="scale3"><div className="pan t"><b>{t("excess")}</b>{L(v.scale.excess)}</div><div className="pan b"><b>{t("balance")}</b>{L(v.scale.balance)}</div><div className="pan l"><b>{t("deficit")}</b>{L(v.scale.deficit)}</div></div>
              {v.siblings.length > 0 && <div className="row">{v.siblings.map((s: any) => <button key={s.id} type="button" className="btn sm" onClick={() => { setTab(String(s.relation) as T); setSel(s.id); }}>{t("rel" + s.relation)} → {L([s.title_ar, s.title_en])}</button>)}</div>}</div>
            <div className="card"><h3>{t("behaviors")} · {num(v.behaviors.length, lang)}</h3><ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>{v.behaviors.map((b: any) => <Beh key={b.id} b={b} />)}</ul></div>
          </div>}
        </div>}
    </>
  );
}

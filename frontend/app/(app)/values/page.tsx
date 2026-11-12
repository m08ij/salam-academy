"use client";
import { useEffect, useMemo, useState } from "react";
import Icon, { type IconName } from "@/components/icons";
import { Head, useToast } from "@/components/ui";
import { get, put } from "@/lib/api";
import { num, useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";

type Rel = "1" | "2" | "3" | "g";
type Val = { id: number; relation: number; title_ar: string; title_en: string };
type Beh = { id: number; ar: string; en: string };

const REL: { k: Rel; icon: IconName; t: [string, string]; c: string }[] = [
  { k: "1", icon: "sun", t: ["العلاقة بالله ﷻ", "With Allah"], c: "var(--rel1)" },
  { k: "2", icon: "heart", t: ["العلاقة بالنفس", "With self"], c: "var(--rel2)" },
  { k: "3", icon: "people", t: ["العلاقة بالآخرين", "With others"], c: "var(--rel3)" },
  { k: "g", icon: "programs", t: ["مجموعات الأسماء الحسنى", "Groups of the Names"], c: "var(--accent)" },
];
const PAGE = 12;

export default function Values() {
  const { t, L, lang } = useI18n();
  const { can } = useSession();
  const toast = useToast();
  const [tab, setTab] = useState<Rel>("2");
  const [all, setAll] = useState<Val[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [v, setV] = useState<any>(null);
  const [filter, setFilter] = useState("");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [bq, setBq] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [openG, setOpenG] = useState<number | null>(null);

  useEffect(() => {
    get<Val[]>("/catalog/values").then(setAll);
    get("/catalog/groups").then(setGroups);
    if (can("learn")) get("/me/plan").then(setPlan).catch(() => {});
  }, [can]);
  const list = useMemo(() => all.filter((x) => String(x.relation) === tab && (!filter.trim() || L([x.title_ar, x.title_en]).includes(filter.trim()))), [all, tab, filter, L]);
  useEffect(() => { if (tab !== "g" && list.length && !list.some((x) => x.id === sel)) setSel(list[0].id); }, [tab, list, sel]);
  useEffect(() => { if (sel) { setV(null); setBq(""); setShown(PAGE); get(`/catalog/values/${sel}`).then(setV); } }, [sel]);
  useEffect(() => {
    const h = setTimeout(() => { if (q.trim().length >= 2) get(`/catalog/search?q=${encodeURIComponent(q.trim())}`).then(setHits); else setHits(null); }, 300);
    return () => clearTimeout(h);
  }, [q]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { "1": 0, "2": 0, "3": 0 };
    for (const x of all) c[String(x.relation)] = (c[String(x.relation)] || 0) + 1;
    return c;
  }, [all]);
  const inPlan = (id: number) => !!plan?.items?.some((i: any) => i.behavior_id === id);
  const toggle = async (id: number) => {
    const had = inPlan(id);
    const items = had ? plan.items.filter((i: any) => i.behavior_id !== id) : [...(plan.items || []), { behavior_id: id, note: "" }];
    const next = { ...plan, items }; setPlan(next); await put("/me/plan", next);
    toast(had ? L(["أُزيل من خطتك", "Removed from your plan"]) : L(["أُضيف إلى خطتك", "Added to your plan"]));
  };
  const behText = (b: Beh) => (lang === "ar" ? b.ar : b.en || b.ar);
  const behs: Beh[] = (v?.behaviors || []).filter((b: Beh) => !bq.trim() || behText(b).includes(bq.trim()));
  const rel = REL.find((r) => r.k === tab)!;
  const go = (id: number, relation: number) => { setTab(String(relation) as Rel); setFilter(""); setSel(id); setQ(""); };

  const Behavior = ({ b }: { b: Beh }) => (
    <li className="vx-beh">
      <span>{behText(b)}</span>
      {plan && <button type="button" className={`vx-add ${inPlan(b.id) ? "on" : ""}`} aria-pressed={inPlan(b.id)} title={inPlan(b.id) ? t("inPlan") : t("addToPlan")} aria-label={inPlan(b.id) ? t("inPlan") : t("addToPlan")} onClick={() => toggle(b.id)}>
        <Icon name={inPlan(b.id) ? "check" : "plus"} /></button>}
    </li>
  );

  return (
    <>
      <Head icon="values" eyebrow={t("brand")} title={t("nav_values")}
        sub={L(["٢٠٩ قيمة في ثلاث علاقات؛ لكل قيمة ميزان بين الطغيان والخسران، وسلوكيات عملية تحوّلها إلى خُلق.", "209 values in three relationships; each has a scale between excess and deficit, and practical behaviors that turn it into character."])} />

      <div className="vx-search">
        <Icon name="search" />
        <input className="inp" placeholder={L(["ابحث في القيم والسلوكيات… مثل: الصبر، الرحمة، الامتنان", "Search values and behaviors… e.g. patience, compassion"])} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t("search")} />
        {q && <button type="button" className="iconbtn" onClick={() => setQ("")} aria-label="clear"><Icon name="close" /></button>}
      </div>

      {hits ? (
        <div className="card vx-results">
          <div className="row between"><h3>{L(["نتائج البحث", "Search results"])}</h3><span className="tiny faint">{num(hits.values.length, lang)} {L(["قيمة", "values"])} · {num(hits.behaviors.length, lang)} {L(["سلوكًا", "behaviors"])}</span></div>
          {hits.values.length > 0 && <div className="vx-chips">{hits.values.map((x: Val) => <button key={x.id} type="button" className="chip" style={{ ["--c" as any]: REL[x.relation - 1].c }} onClick={() => go(x.id, x.relation)}><i className="vx-dot" />{L([x.title_ar, x.title_en])}</button>)}</div>}
          {hits.behaviors.length > 0 ? <ul className="vx-behs">{hits.behaviors.slice(0, 20).map((b: Beh) => <Behavior key={b.id} b={b} />)}</ul>
            : hits.values.length === 0 && <p className="muted small">{L(["لا نتائج. جرّب كلمة أخرى.", "No results. Try another word."])}</p>}
        </div>
      ) : <>
        <div className="vx-tabs" role="tablist">
          {REL.map((r) => (
            <button key={r.k} type="button" role="tab" aria-selected={tab === r.k} style={{ ["--c" as any]: r.c }} onClick={() => { setTab(r.k); setFilter(""); }}>
              <span className="vx-ti"><Icon name={r.icon} /></span>
              <span className="vx-tt"><b>{L(r.t)}</b><span>{r.k === "g" ? `${num(groups.length || 12, lang)} ${L(["مجموعة", "groups"])}` : `${num(counts[r.k] || 0, lang)} ${L(["قيمة", "values"])}`}</span></span>
            </button>
          ))}
        </div>

        {tab === "g" ? (
          <div className="vx-groups">
            {groups.map((g) => {
              const open = openG === g.id;
              return (
                <div key={g.id} className={`vx-group ${open ? "open" : ""}`} style={{ ["--c" as any]: g.color }}>
                  <button type="button" className="vx-gh" onClick={() => setOpenG(open ? null : g.id)} aria-expanded={open}>
                    <span className="vx-gn">{num(g.position, lang)}</span>
                    <span className="vx-gt"><b>{L([g.title_ar, g.title_en])}</b><span className="tiny faint">{num(g.names.length, lang)} {L(["من الأسماء", "Names"])}</span></span>
                    <Icon name="arrow" className="ico vx-chev" />
                  </button>
                  <p className="small muted vx-gd">{L([g.desc_ar, g.desc_en])}</p>
                  <div className="vx-names">{(open ? g.names : g.names.slice(0, 5)).map((n: any) => <span key={n.id} className="pill">{L([n.ar, n.en])}</span>)}
                    {!open && g.names.length > 5 && <button type="button" className="pill more" onClick={() => setOpenG(g.id)}>+{num(g.names.length - 5, lang)}</button>}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="vx" style={{ ["--c" as any]: rel.c }}>
            <aside className="vx-list">
              <div className="vx-filter"><Icon name="search" /><input className="inp" placeholder={L(["صفِّ القائمة…", "Filter…"])} value={filter} onChange={(e) => setFilter(e.target.value)} aria-label={L(["تصفية القيم", "Filter values"])} /></div>
              <div className="vx-items" role="listbox" aria-label={L(rel.t)}>
                {list.map((x, i) => (
                  <button key={x.id} type="button" role="option" aria-selected={sel === x.id} className="vx-item" onClick={() => setSel(x.id)}>
                    <span className="vx-n">{num(i + 1, lang)}</span><span>{L([x.title_ar, x.title_en])}</span>
                  </button>
                ))}
                {!list.length && <p className="tiny faint" style={{ padding: 10 }}>{L(["لا قيم مطابقة.", "No matching values."])}</p>}
              </div>
            </aside>

            <div className="vx-detail" key={sel ?? 0}>
              {!v ? <><div className="skel" style={{ height: 140 }} /><div className="skel" style={{ height: 220 }} /></> : <>
                <section className="vx-hero">
                  <span className="vx-rel"><Icon name={rel.icon} />{L(rel.t)}</span>
                  <h2>{L([v.title_ar, v.title_en])}</h2>
                  <div className="vx-scale">
                    <div className="vx-side t"><b>{t("excess")}</b><span>{L(v.scale.excess) || "—"}</span></div>
                    <div className="vx-mid"><span className="vx-ic"><Icon name="check" /></span><b>{t("balance")}</b><span>{L(v.scale.balance) || "—"}</span></div>
                    <div className="vx-side l"><b>{t("deficit")}</b><span>{L(v.scale.deficit) || "—"}</span></div>
                  </div>
                  {v.siblings.length > 0 && <div className="vx-sib"><span className="tiny faint">{L(["القيمة نفسها في علاقة أخرى:", "Same value in another relationship:"])}</span>
                    {v.siblings.map((s: any) => <button key={s.id} type="button" className="chip" style={{ ["--c" as any]: REL[s.relation - 1].c }} onClick={() => go(s.id, s.relation)}><i className="vx-dot" />{t("rel" + s.relation)}</button>)}</div>}
                </section>

                <section className="card vx-behaviors">
                  <div className="row between">
                    <h3>{t("behaviors")} <span className="pill acc">{num(v.behaviors.length, lang)}</span></h3>
                    {v.behaviors.length > PAGE && <div className="vx-filter sm"><Icon name="search" /><input className="inp" placeholder={L(["ابحث في السلوكيات…", "Search behaviors…"])} value={bq} onChange={(e) => { setBq(e.target.value); setShown(PAGE); }} /></div>}
                  </div>
                  {plan && <p className="tiny faint">{L(["اضغط «+» لإضافة سلوك إلى خطة نموك.", "Press “+” to add a behavior to your growth plan."])}</p>}
                  <ul className="vx-behs">{behs.slice(0, shown).map((b) => <Behavior key={b.id} b={b} />)}</ul>
                  {behs.length > shown && <button type="button" className="btn block" onClick={() => setShown((n) => n + PAGE * 2)}>{L([`عرض المزيد (${num(behs.length - shown, lang)})`, `Show more (${behs.length - shown})`])}</button>}
                  {!behs.length && <p className="muted small">{L(["لا سلوكيات مطابقة.", "No matching behaviors."])}</p>}
                </section>
              </>}
            </div>
          </div>
        )}
      </>}
    </>
  );
}

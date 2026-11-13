"use client";
import { useEffect, useState } from "react";
import { Head } from "@/components/ui";
import { get } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function Glossary() {
  const { L } = useI18n();
  const [terms, setTerms] = useState<{ term: string; def: string; ref: string }[] | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => { get<any[]>("/learn/glossary").then(setTerms).catch(() => setTerms([])); }, []);
  const list = (terms || []).filter((x) => !q || (x.term + x.def).includes(q));
  return (
    <>
      <Head icon="book" title={L(["قاموس الدورة", "Course glossary"])} sub={L(["أهم مصطلحات «هويتي المتكاملة» كما تشرحها الدورة", "Key terms as the course explains them"])} />
      <input className="inp" placeholder={L(["ابحث عن مصطلح…", "Search a term…"])} value={q} onChange={(e) => setQ(e.target.value)} />
      {terms === null ? <div className="skel" style={{ height: 120 }} /> : !list.length ? <p className="muted">{L(["لا توجد مصطلحات بعد.", "No terms yet."])}</p> :
        <div className="gloss">{list.map((x) => <div key={x.term} className="card gloss-item"><h3>{x.term}</h3><p>{x.def}</p><span className="cite">{x.ref}</span></div>)}</div>}
    </>
  );
}

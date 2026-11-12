"use client";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Icon from "@/components/icons";
import { num, useI18n } from "@/lib/i18n";

type Lesson = { id: string; title_ar: string; title_en: string; done: boolean; hours: number; best?: { score: number; total: number } | null };
type Part = { title_ar: string; title_en: string; lessons: Lesson[] };
const HUES = ["var(--rel2)", "var(--rel1)", "var(--rel3)", "var(--accent)"];

/**
 * Mind map of a course: the course in the centre, one branch per part, one node per section.
 * Done sections are filled, the next one pulses; nodes link to the lesson. Curved connectors are drawn
 * between the centre and each branch from the real layout, so the map stays correct at every width.
 */
export default function CourseMap({ eid, title, parts, graduated }: { eid: string; title: [string, string]; parts: Part[]; graduated: boolean }) {
  const { L, lang } = useI18n();
  const box = useRef<HTMLDivElement>(null);
  const core = useRef<HTMLDivElement>(null);
  const heads = useRef<(HTMLDivElement | null)[]>([]);
  const [paths, setPaths] = useState<{ d: string; c: string }[]>([]);
  const all = parts.flatMap((p) => p.lessons);
  const done = all.filter((l) => l.done).length;
  const next = all.find((l) => !l.done);
  const pct = all.length ? Math.round((100 * done) / all.length) : 0;

  const draw = () => {
    const b = box.current?.getBoundingClientRect(), c = core.current?.getBoundingClientRect();
    if (!b || !c || window.innerWidth < 900) { setPaths([]); return; }
    const cx = c.left + c.width / 2 - b.left, cy = c.top + c.height / 2 - b.top;
    setPaths(heads.current.map((h, i) => {
      if (!h) return { d: "", c: HUES[i % 4] };
      const r = h.getBoundingClientRect();
      const left = r.left + r.width / 2 < c.left + c.width / 2;
      const x = (left ? r.right : r.left) - b.left, y = r.top + r.height / 2 - b.top;
      const mx = (cx + x) / 2;
      return { d: `M ${cx} ${cy} C ${mx} ${cy}, ${mx} ${y}, ${x} ${y}`, c: HUES[i % 4] };
    }));
  };
  const drawRef = useRef(draw);
  drawRef.current = draw;
  // Redraw only when the content changes or the window resizes (setting state on every render would loop).
  useLayoutEffect(() => { drawRef.current(); }, [parts.length, done, lang]);
  useEffect(() => {
    const on = () => drawRef.current();
    window.addEventListener("resize", on);
    const t = setTimeout(on, 700);  // after the entrance animation settles
    return () => { window.removeEventListener("resize", on); clearTimeout(t); };
  }, []);

  const branch = (p: Part, i: number) => {
    const pd = p.lessons.filter((l) => l.done).length;
    return (
      <div key={i} className={`mm-branch b${i}`} style={{ ["--c" as any]: HUES[i % 4], ["--i" as any]: i }}>
        <div className="mm-head" ref={(el) => { heads.current[i] = el; }}>
          <span className="mm-pn">{num(i + 1, lang)}</span>
          <div><b>{L([p.title_ar, p.title_en]).replace(/^.*?:\s*/, "")}</b><span className="tiny faint">{num(pd, lang)}/{num(p.lessons.length, lang)} {L(["مكتمل", "done"])}</span></div>
          <span className="mm-mini"><i style={{ width: `${p.lessons.length ? (100 * pd) / p.lessons.length : 0}%` }} /></span>
        </div>
        <ol className="mm-nodes">
          {p.lessons.map((l) => {
            const state = l.done ? "done" : next?.id === l.id ? "next" : "";
            return (
              <li key={l.id} className={state}>
                <Link href={`/learn/${eid}/lesson/${l.id}`}>
                  <span className="mm-dot">{l.done ? <Icon name="check" /> : null}</span>
                  <span className="mm-t">{L([l.title_ar, l.title_en])}</span>
                  {state === "next" && <span className="mm-tag">{L(["التالي", "Next"])}</span>}
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    );
  };

  return (
    <div className="mm" ref={box}>
      <svg className="mm-lines" aria-hidden>{paths.map((p, i) => p.d && <path key={i} d={p.d} style={{ stroke: p.c }} />)}</svg>
      {parts.slice(0, 2).map((p, i) => branch(p, i))}
      <div className="mm-core" ref={core}>
        <div className="mm-ring" style={{ ["--p" as any]: `${pct}%` }}><b>{num(pct, lang)}٪</b></div>
        <b className="mm-title">{L(title)}</b>
        <span className="tiny">{graduated ? L(["أتممت الدورة 🎓", "Course completed 🎓"]) : `${num(done, lang)} / ${num(all.length, lang)} ${L(["قسمًا", "sections"])}`}</span>
        {next && <Link className="btn pri sm" href={`/learn/${eid}/lesson/${next.id}`}>{done ? L(["تابع", "Continue"]) : L(["ابدأ", "Start"])}<Icon name="arrow" className="ico flip" /></Link>}
      </div>
      {parts.slice(2).map((p, i) => branch(p, i + 2))}
    </div>
  );
}

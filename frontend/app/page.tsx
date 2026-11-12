"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import AppUpdate from "@/components/AppUpdate";
import ThemeToggle from "@/components/ThemeToggle";
import Icon, { type IconName } from "@/components/icons";
import { get } from "@/lib/api";
import { num, useI18n } from "@/lib/i18n";
import { homeFor, useSession } from "@/lib/session";
import { CountUp, useReveal } from "@/lib/motion";
import { DEMO, asset } from "@/lib/env";

type Pair = [string, string];
type Overview = {
  stats: { relations: number; groups: number; names: number; values: number; behaviors: number };
  relations: Record<string, number>;
  groups: { id: number; position: number; t: Pair; d: Pair; color: string; skills: [string[], string[]]; names: Pair[] }[];
  academy: { slug: string; t: Pair; d: Pair; levels: { position: number; t: Pair; d: Pair; courses: Pair[]; lessons: number; hours: number; project: Pair | null }[] }[];
  framework: { title: Pair; intro: Pair; concepts: { t: Pair; d: Pair }[] };
  programs: { id: string; t: Pair; aud: Pair; dur?: Pair; d: Pair; out: Pair[]; url: string }[];
  books: { t: Pair; d: Pair; u: string }[];
  lectures: { t: string; u: string }[];
};

const REL: { k: string; t: Pair; d: Pair; c: string; icon: IconName }[] = [
  { k: "1", t: ["العلاقة بالله ﷻ", "Relationship with Allah"], d: ["الإيمان بالله وأسمائه الحسنى منبع الطمأنينة والتوازن.", "Faith in Allah and His Beautiful Names — the source of reassurance and balance."], c: "var(--rel1)", icon: "sun" },
  { k: "2", t: ["العلاقة بالنفس", "Relationship with Self"], d: ["فهم المشاعر وإدارتها، وبناء الهوية والأهداف والعادات.", "Understanding and managing emotions; building identity, goals and habits."], c: "var(--rel2)", icon: "heart" },
  { k: "3", t: ["العلاقة بالآخرين", "Relationship with Others"], d: ["العدل والرحمة والتواصل في الأسرة والعمل والمجتمع.", "Justice, compassion and communication at home, at work and in the community."], c: "var(--rel3)", icon: "people" },
];
const CRIT: { icon: IconName; t: Pair; d: Pair }[] = [
  { icon: "book", t: ["إكمال الدروس", "Complete the lessons"], d: ["كل دروس المستوى مع اجتياز اختباراتها.", "Every lesson in the level, passing its quizzes."] },
  { icon: "quiz", t: ["الاختبارات", "Quizzes"], d: ["متوسط اختبارات المستوى فوق الحد الأدنى.", "A level quiz average above the minimum."] },
  { icon: "star", t: ["تقييم المدرب", "Trainer evaluation"], d: ["تقييم على معايير المنصة من ١ إلى ٥.", "A 1–5 rating on the platform rubric."] },
  { icon: "enroll", t: ["مشروع المستوى", "Level project"], d: ["مشروع تطبيقي يعتمده المدرب.", "An applied project approved by the trainer."] },
  { icon: "medal", t: ["العلامة النهائية", "Final grade"], d: ["علامة مرجّحة واعتماد المدرب للانتقال.", "A weighted grade and the trainer’s sign-off."] },
];
const COVERS = ["#0A5C66", "#7A4E8F", "#A8800C", "#23774A", "#2A5E8C", "#B4473B", "#0B7F7A", "#5B4B8A", "#8A6B1D", "#1F6F8B", "#9C3D5B", "#3E7C59", "#6A5ACD"];

export default function Home() {
  const { t, L, lang, setLang } = useI18n();
  const { me } = useSession();
  const [d, setD] = useState<Overview | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => { get<Overview>("/public/overview").then(setD).catch(() => {}); }, []);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on(); window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  useReveal(d);
  const n = (v: number | undefined) => num(v ?? 0, lang);
  const s = d?.stats;
  const academy = d?.academy[0];
  const enter = me ? <Link className="btn pri" href={homeFor(me)}>{L(["لوحتي", "My dashboard"])}<Icon name="arrow" className="ico flip" /></Link>
    : <Link className="btn pri" href="/login">{t("signIn")}</Link>;

  return (
    <div className="pub">
      <div className="scroll-prog" aria-hidden />
      {DEMO && <div className="demo-bar">{t("demoBanner")}</div>}
      <header className={`pub-nav ${scrolled ? "scrolled" : ""}`}>
        <div className="in">
          <Link className="brand" href="/"><img src={asset("/logo.png")} alt="" /><div><b>{t("brand")}</b><span>{t("tagline")}</span></div></Link>
          <nav className="links" aria-label={t("mainNav")}>
            <a href="#system">{L(["المنظومة", "The system"])}</a>
            <a href="#path">{L(["المسار التعليمي", "Learning path"])}</a>
            <a href="#programs">{L(["البرامج", "Programs"])}</a>
            <a href="#library">{L(["المكتبة", "Library"])}</a>
          </nav>
          <span className="sp" />
          <ThemeToggle />
          <button type="button" className="iconbtn" onClick={() => setLang(lang === "ar" ? "en" : "ar")} aria-label={t("language")} title={lang === "ar" ? "English" : "عربي"}><Icon name="globe" /></button>
          {enter}
        </div>
      </header>

      <main style={{ padding: 0 }}>
        <div style={{ maxWidth: 1200, marginInline: "auto", padding: "12px 16px 0" }}><AppUpdate /></div>
        {/* ---------------- hero ---------------- */}
        <section className="p-hero">
          <span className="blob a" aria-hidden /><span className="blob b" aria-hidden />
          <div className="in">
            <div className="copy">
              <span className="badge"><i>{L(["جديد", "New"])}</i>{L(["أكاديمية سلام الإلكترونية", "The Salam online academy"])}</span>
              <h1>{lang === "ar" ? <>كن <em>أفضل نسخة</em> من نفسك</> : <>Become the <em>best version</em> of yourself</>}</h1>
              <p className="lead">{L(["برنامج صحة نفسية وتنمية ذات مبني على القيم؛ يجمع الإيمان بالله ﷻ وأسمائه الحسنى مع علم النفس الإيجابي والذكاء العاطفي، في مسار متدرّج يرافقك فيه مدرب.",
                "A values-based mental-health and personal-growth program that brings together faith in Allah and His Beautiful Names with positive psychology and emotional intelligence — in a step-by-step path with a trainer beside you."])}</p>
              <div className="cta">
                {me ? <Link className="btn pri lg" href={homeFor(me)}>{L(["تابع رحلتك", "Continue your journey"])}<Icon name="arrow" className="ico flip" /></Link>
                  : <Link className="btn pri lg" href="/login">{L(["ادخل إلى الأكاديمية", "Enter the academy"])}<Icon name="arrow" className="ico flip" /></Link>}
                <a className="btn lg" href="#system">{L(["تعرّف على المنظومة", "Explore the system"])}</a>
              </div>
            </div>
            <Orbit groups={d?.groups} lang={lang} />
          </div>
        </section>

        {/* ---------------- stats ---------------- */}
        <div style={{ maxWidth: 1200, marginInline: "auto", padding: "0 20px", marginTop: -36, position: "relative" }}>
          <div className="stats-strip" data-reveal="zoom">
            {([[s?.relations ?? 3, ["علاقات", "relationships"]], [s?.groups ?? 12, ["مجموعة للأسماء الحسنى", "groups of the Names"]], [s?.names ?? 106, ["اسمًا من الأسماء الحسنى", "Beautiful Names"]],
              [s?.values ?? 209, ["قيمة بموازينها", "values with scales"]], [s?.behaviors ?? 3177, ["سلوكًا عمليًا", "practical behaviors"]]] as [number, Pair][]).map(([v, l]) => (
              <div key={l[1]}><CountUp value={v} lang={lang} /><span>{L(l)}</span></div>
            ))}
          </div>
        </div>

        {/* ---------------- relationships ---------------- */}
        <section className="sec" id="system">
          <div className="sec-h c" data-reveal>
            <span className="kicker">{L(["منظومة سلام", "The Salam system"])}</span>
            <h2>{L(["السلام الداخلي يبدأ بالعدل في ثلاث علاقات", "Inner peace begins with justice in three relationships"])}</h2>
            <p>{L(["كل قيمة في المنظومة لها ميزان: نقطة اتزان بين الطغيان والخسران، وسلوكيات عملية تحوّلها إلى خُلق في حياتك اليومية.",
              "Every value has a scale — a point of balance between excess and deficit — and practical behaviors that turn it into character in daily life."])}</p>
          </div>
          <div className="rels">
            {REL.map((r, i) => (
              <div key={r.k} className="rel" data-reveal style={{ ["--c" as any]: r.c, ["--i" as any]: i }}>
                <span className="dot"><Icon name={r.icon} /></span>
                <h3>{L(r.t)}</h3>
                <p className="muted small">{L(r.d)}</p>
                <div className="row" style={{ marginTop: "auto", gap: 6, alignItems: "baseline" }}><b className="big">{n(d?.relations[r.k])}</b><span className="faint small">{L(["قيمة", "values"])}</span></div>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------- concepts ---------------- */}
        <div className="band">
          <section className="sec">
            <div className="sec-h" data-reveal>
              <span className="kicker">{L(["الأسس والمفاهيم", "Foundations"])}</span>
              <h2>{L(["كيف تعمل المنظومة؟", "How does the system work?"])}</h2>
              {d && <p>{L(d.framework.intro)}</p>}
            </div>
            <div className="grid g3">
              {(d?.framework.concepts ?? Array.from({ length: 6 }, () => null)).map((c, i) => c ? (
                <div key={i} className="card concept" data-reveal style={{ ["--i" as any]: i % 3 }}><span className="n">{n(i + 1)}</span><h3>{L(c.t)}</h3><p>{L(c.d)}</p></div>
              ) : <div key={i} className="skel" style={{ height: 150 }} />)}
            </div>
          </section>
        </div>

        {/* ---------------- groups ---------------- */}
        <section className="sec">
          <div className="sec-h" data-reveal>
            <span className="kicker">{L(["الأسماء الحسنى", "The Beautiful Names"])}</span>
            <h2>{L(["١٢ مجموعة، ومهارات ذكاء عاطفي مستلهمة منها", "12 groups — and the emotional-intelligence skills drawn from them"])}</h2>
            <p>{L(["كل اسم يُدرس لغويًا وقرآنيًا وفي سياقه، ثم تُستخرج منه السلوكيات والمهارات والقيم.", "Each Name is studied linguistically and in its Quranic context; behaviors, skills and values are then derived from it."])}</p>
          </div>
          <div className="groups">
            {(d?.groups ?? Array.from({ length: 12 }, () => null)).map((g, i) => g ? (
              <div key={g.id} className="grpc" data-reveal style={{ ["--c" as any]: g.color, ["--i" as any]: i % 4 }}>
                <div className="row between"><span className="sw">{n(g.position)}</span><span className="pill">{n(g.names.length)} {L(["اسمًا", "Names"])}</span></div>
                <h3>{L(g.t)}</h3>
                <span className="names">{g.names.map((x) => L(x)).join(lang === "ar" ? "، " : ", ")}</span>
              </div>
            ) : <div key={i} className="skel" style={{ height: 112 }} />)}
          </div>
        </section>

        {/* ---------------- learning path ---------------- */}
        <div className="band" id="path">
          <section className="sec">
            <div className="sec-h" data-reveal>
              <span className="kicker">{L(["المسار التعليمي", "Learning path"])}</span>
              <h2>{academy ? L(academy.t) : L(["أفضل نسخة من نفسك", "Best Version of Yourself"])} — {L(["ثلاثة مستويات متدرّجة", "three progressive levels"])}</h2>
              <p>{L(["تتعلّم بالتسلسل: لا يُفتح المستوى التالي إلا بعد استيفاء شروطه واعتماد مدربك.", "You learn in sequence: the next level opens only once its criteria are met and your trainer signs off."])}</p>
            </div>
            <div className="path">
              {(academy?.levels ?? [null, null, null]).map((lv, i) => lv ? (
                <div key={lv.position} className="lvl" data-reveal style={{ ["--i" as any]: i }}>
                  <span className="no">{L(["المستوى", "LEVEL"])} {n(lv.position)}</span>
                  <h3>{L(lv.t).replace(/^.*?:\s*/, "")}</h3>
                  <div className="row" style={{ gap: 6 }}><span className="pill acc">{n(lv.lessons)} {L(["درسًا", "lessons"])}</span><span className="pill">{n(lv.hours)} {L(["ساعة", "hours"])}</span></div>
                  <ul>{lv.courses.map((c, k) => <li key={k}><Icon name="check" />{L(c).replace(/^.*?:\s*/, "")}</li>)}</ul>
                  {lv.project && <div className="proj"><b>{L(["مشروع المستوى", "Level project"])}</b>{L(lv.project)}</div>}
                </div>
              ) : <div key={i} className="skel" style={{ height: 280 }} />)}
            </div>
            <div className="criteria">
              {CRIT.map((c, i) => <div key={c.t[1]} className="crit" data-reveal style={{ ["--i" as any]: i }}><Icon name={c.icon} /><b>{L(c.t)}</b>{L(c.d)}</div>)}
            </div>
          </section>
        </div>

        {/* ---------------- programs ---------------- */}
        <section className="sec" id="programs">
          <div className="sec-h" data-reveal>
            <span className="kicker">{L(["برامج سلام", "Salam programs"])}</span>
            <h2>{L(["برنامج لكل مرحلة ودور في الحياة", "A program for every stage and role in life"])}</h2>
            <p>{L(["تبدأ الأكاديمية ببرنامج «أفضل نسخة من نفسك»، وتتبعه بقية البرامج تباعًا.", "The academy opens with “Best Version of Yourself”; the other programs follow."])}</p>
          </div>
          <div className="grid g3">
            {(d?.programs ?? Array.from({ length: 6 }, () => null)).map((p, i) => p ? (
              <div key={p.id} className={`card prog ${i === 0 ? "flag" : ""}`} data-reveal style={{ ["--i" as any]: i % 3 }}>
                <div className="row between"><span className="aud">{L(p.aud)}</span>{i === 0 && <span className="pill">{L(["متاح الآن", "Available now"])}</span>}</div>
                <h3>{L(p.t)}</h3>
                <p>{L(p.d)}</p>
                <div className="meta">{p.dur && L(p.dur) && <span className="pill">{L(p.dur)}</span>}{i > 0 && <span className="pill">{L(["قريبًا", "Coming soon"])}</span>}</div>
              </div>
            ) : <div key={i} className="skel" style={{ height: 190 }} />)}
          </div>
        </section>

        {/* ---------------- library ---------------- */}
        <div className="band" id="library">
          <section className="sec">
            <div className="sec-h" data-reveal>
              <span className="kicker">{L(["المكتبة", "Library"])}</span>
              <h2>{L(["كتب ومحاضرات المنهج", "Books and lectures"])}</h2>
            </div>
            <div className="books">
              {(d?.books ?? []).map((b, i) => (
                <a key={i} className="book" data-reveal style={{ ["--i" as any]: i % 6 }} href={b.u || undefined} target="_blank" rel="noopener noreferrer">
                  <span className="cover" style={{ background: `linear-gradient(160deg, ${COVERS[i % COVERS.length]}, color-mix(in srgb, ${COVERS[i % COVERS.length]} 70%, #000))` }}>
                    <b>{L(b.t)}</b><span>{L(["سلسلة سلام", "Salam series"])}</span>
                  </span>
                </a>
              ))}
            </div>
            {!!d?.lectures.length && <div className="grid g3">
              {d.lectures.map((x, i) => (
                <a key={i} className="lect" data-reveal="fade" style={{ ["--i" as any]: i % 3 }} href={x.u} target="_blank" rel="noopener noreferrer"><span className="play"><Icon name="play" /></span><span className="small" style={{ fontWeight: 600 }}>{x.t}</span></a>
              ))}
            </div>}
          </section>
        </div>

        {/* ---------------- CTA ---------------- */}
        <section className="sec tight">
          <div className="cta-band" data-reveal="zoom">
            <Icon name="sparkle" className="ico" />
            <h2>{L(["رحلتك نحو الحياة الطيبة تبدأ بخطوة", "Your journey to the good life starts with one step"])}</h2>
            <p>{L(["الالتحاق بالأكاديمية بدعوة من فريق سلام. إن وصلتك دعوة، ادخل وابدأ مستواك الأول اليوم.", "Joining is by invitation from the Salam team. If you have received one, sign in and start your first level today."])}</p>
            {me ? <Link className="btn pri lg" href={homeFor(me)}>{L(["تابع رحلتك", "Continue your journey"])}</Link> : <Link className="btn pri lg" href="/login">{t("signIn")}</Link>}
          </div>
        </section>
      </main>

      <footer className="pub-foot">
        <div className="in">
          <span className="row" style={{ gap: 8 }}><img src={asset("/logo.png")} alt="" width={22} height={22} style={{ objectFit: "contain" }} />{t("brand")} · {n(new Date().getFullYear())}</span>
          <span>{L(["منظومة القيم مستوحاة من الأسماء الحسنى", "A values system inspired by the Beautiful Names"])}</span>
        </div>
      </footer>
    </div>
  );
}

/** Hero illustration: three relationship rings around the logo, with the 12 groups orbiting outside. */
function Orbit({ groups, lang }: { groups?: Overview["groups"]; lang: string }) {
  const cols = groups?.map((g) => g.color) ?? Array(12).fill("#cfe3e1");
  const R = [205, 150, 98];
  const rel = [["العلاقة بالآخرين", "Others", "var(--rel3)"], ["العلاقة بالنفس", "Self", "var(--rel2)"], ["العلاقة بالله", "Allah", "var(--rel1)"]];
  return (
    <div className="art">
      <svg className="orbit" viewBox="0 0 500 500" role="img" aria-label={lang === "ar" ? "العلاقات الثلاث ومجموعات الأسماء الحسنى" : "The three relationships and the groups of the Names"}>
        <defs>
          <radialGradient id="og" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="var(--accent-soft)" /><stop offset="100%" stopColor="var(--accent-soft)" stopOpacity="0" /></radialGradient>
        </defs>
        <circle cx="250" cy="250" r="240" fill="url(#og)" />
        {R.map((r, i) => (
          <g key={r}>
            <circle className="ring" cx="250" cy="250" r={r} fill="none" stroke={rel[i][2]} strokeOpacity=".35" strokeWidth="1.5" strokeDasharray={i === 0 ? "2 7" : undefined} style={{ animationDelay: `${-i * 2.3}s` }} />
            <circle cx={250} cy={250 - r} r="5" fill={rel[i][2]} />
            <circle className="pulse" cx={250} cy={250 - r} r="5" fill="none" stroke={rel[i][2]} strokeWidth="1.5" style={{ animationDelay: `${i * 0.9}s` }} />
            <text x="250" y={250 - r - 12} textAnchor="middle" fontSize="13" fill={rel[i][2]}>{lang === "ar" ? rel[i][0] : rel[i][1]}</text>
          </g>
        ))}
        <g className="spin">
          {cols.map((c, i) => {
            const a = (i / cols.length) * Math.PI * 2 + 0.26;
            // Rounded so server and client render identical attributes (avoids a hydration mismatch).
            return <circle key={i} cx={(250 + Math.cos(a) * 205).toFixed(2)} cy={(250 + Math.sin(a) * 205).toFixed(2)} r="11" fill={c} stroke="var(--surface)" strokeWidth="3" style={{ animationDelay: `${-i * 0.37}s` }} />;
          })}
        </g>
        <g className="core">
          <circle cx="250" cy="250" r="56" fill="var(--surface)" stroke="var(--line)" />
          <image href={asset("/logo.png")} x="222" y="205" width="56" height="90" preserveAspectRatio="xMidYMid meet" />
        </g>
      </svg>
    </div>
  );
}

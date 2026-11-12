"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import { useI18n } from "@/lib/i18n";
import { DEMO, asset } from "@/lib/env";
import { CountUp } from "@/lib/motion";

// A few values from the Salam catalog that rotate on the brand panel.
const VALUES: [string, string][] = [
  ["الرحمة", "Compassion"], ["الصدق والأمانة", "Truthfulness & Honesty"], ["التسامح", "Forgiveness"], ["الإتقان", "Proficiency"],
  ["الامتنان والشكر", "Gratitude & Thankfulness"], ["التواضع", "Humility"], ["البر والإحسان", "Kindness and Benevolence"], ["الجرأة والشجاعة", "Boldness & Courage"],
];

/** Split layout: an animated brand panel (desktop only) beside the form card. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t, L, lang, setLang } = useI18n();
  const [vi, setVi] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setVi((i) => (i + 1) % VALUES.length), 3200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="auth">
      <aside className="auth-side">
        <span className="auth-blob a" aria-hidden /><span className="auth-blob b" aria-hidden />
        <Link href="/" className="brand" style={{ color: "#fff" }}><img src={asset("/logo.png")} alt="" /><div><b>{t("brand")}</b><span style={{ color: "#BFE1DD" }}>{t("tagline")}</span></div></Link>
        <svg className="rings" viewBox="0 0 400 400" fill="none" aria-hidden>
          <circle cx="200" cy="200" r="190" stroke="#fff" strokeOpacity=".22" strokeDasharray="2 8" />
          <circle cx="200" cy="200" r="140" stroke="#fff" strokeOpacity=".3" />
          <circle cx="200" cy="200" r="90" stroke="#fff" strokeOpacity=".4" />
          <g className="orb o1"><circle cx="200" cy="10" r="7" fill="#E7CF4A" /></g>
          <g className="orb o2"><circle cx="340" cy="200" r="6" fill="#fff" fillOpacity=".85" /></g>
          <g className="orb o3"><circle cx="200" cy="290" r="5" fill="#6FD8D0" /></g>
        </svg>
        <div className="auth-copy">
          <span className="auth-chip" aria-live="polite">
            <i />{L(["قيمة تتأملها", "A value to reflect on"])}: <b key={vi}>{L(VALUES[vi])}</b>
          </span>
          <h2>{L(["كن أفضل نسخة من نفسك، بالقيم التي تؤمن بها.", "Become the best version of yourself, through the values you believe in."])}</h2>
          <p>{L(["رحلة تعلّم متدرّجة تبني التوازن في علاقتك بالله ﷻ وبنفسك وبالآخرين، مع مدرب يرافقك في كل مستوى.", "A step-by-step learning journey that builds balance in your relationship with Allah, yourself and others — with a trainer beside you at every level."])}</p>
        </div>
        <div className="facts">
          {([[3, ["علاقات", "relationships"]], [12, ["مجموعة للأسماء", "groups of Names"]], [209, ["قيمة", "values"]], [3177, ["سلوكًا", "behaviors"]]] as [number, [string, string]][]).map(([v, l]) => (
            <div key={l[1]}><CountUp value={v} lang={lang} duration={1600} /><span>{L(l)}</span></div>
          ))}
        </div>
      </aside>
      <div className="auth-main">
        <div className="card auth-card">
          <div className="row between">
            <Link href="/" className="logo"><img src={asset("/logo.png")} alt="" /><div><b style={{ fontFamily: "var(--f-disp)" }}>{t("brand")}</b><div className="tiny faint">{t("tagline")}</div></div></Link>
            <div className="row" style={{ gap: 4, flexWrap: "nowrap" }}><ThemeToggle /><div className="langsw" data-active={lang} role="group" aria-label={t("language")}><button type="button" aria-pressed={lang === "ar"} onClick={() => setLang("ar")}>عربي</button><button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")}>EN</button></div></div>
          </div>
          {DEMO && <div className="alert warn small">{t("demoBanner")}</div>}
          {children}
        </div>
      </div>
    </div>
  );
}

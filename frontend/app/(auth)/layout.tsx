"use client";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

/** Split layout: a brand panel (desktop only) beside the form card. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t, L, lang, setLang } = useI18n();
  return (
    <div className="auth">
      <aside className="auth-side" aria-hidden>
        <Link href="/" className="brand" style={{ color: "#fff" }}><img src="/logo.png" alt="" /><div><b>{t("brand")}</b><span style={{ color: "#BFE1DD" }}>{t("tagline")}</span></div></Link>
        <svg className="rings" viewBox="0 0 400 400" fill="none" stroke="#fff" strokeWidth="1.2">
          <circle cx="200" cy="200" r="190" opacity=".25" /><circle cx="200" cy="200" r="140" opacity=".35" /><circle cx="200" cy="200" r="90" opacity=".45" />
          <circle cx="200" cy="10" r="7" fill="#E7CF4A" stroke="none" /><circle cx="340" cy="200" r="6" fill="#fff" stroke="none" opacity=".8" /><circle cx="200" cy="290" r="5" fill="#6FD8D0" stroke="none" />
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, position: "relative" }}>
          <h2>{L(["كن أفضل نسخة من نفسك، بالقيم التي تؤمن بها.", "Become the best version of yourself, through the values you believe in."])}</h2>
          <p>{L(["رحلة تعلّم متدرّجة تبني التوازن في علاقتك بالله ﷻ وبنفسك وبالآخرين، مع مدرب يرافقك في كل مستوى.", "A step-by-step learning journey that builds balance in your relationship with Allah, yourself and others — with a trainer beside you at every level."])}</p>
        </div>
        <div className="facts">
          <div><b>{L(["٣", "3"])}</b><span>{L(["علاقات", "relationships"])}</span></div>
          <div><b>{L(["١٢", "12"])}</b><span>{L(["مجموعة للأسماء", "groups of Names"])}</span></div>
          <div><b>{L(["٢٠٩", "209"])}</b><span>{L(["قيمة", "values"])}</span></div>
          <div><b>{L(["٣١٧٧", "3,177"])}</b><span>{L(["سلوكًا", "behaviors"])}</span></div>
        </div>
      </aside>
      <div className="auth-main">
        <div className="card">
          <div className="row between">
            <Link href="/" className="logo"><img src="/logo.png" alt="" /><div><b style={{ fontFamily: "var(--f-disp)" }}>{t("brand")}</b><div className="tiny faint">{t("tagline")}</div></div></Link>
            <div className="langsw" role="group" aria-label={t("language")}><button type="button" aria-pressed={lang === "ar"} onClick={() => setLang("ar")}>عربي</button><button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")}>EN</button></div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

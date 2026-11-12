"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import AppUpdate from "@/components/AppUpdate";
import ThemeToggle from "@/components/ThemeToggle";
import Icon, { type IconName } from "@/components/icons";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { asset } from "@/lib/env";

type Item = [string, string, string | null, IconName]; // href, label key, required permission, icon

const GROUPS: [string, Item[]][] = [
  ["learnG", [["/learn", "nav_learn", "learn", "learn"], ["/values", "nav_values", null, "values"], ["/plan", "nav_plan", "learn", "plan"]]],
  ["trainG", [["/trainer", "nav_trainer", "train", "trainer"], ["/admin", "nav_users", "users", "users"], ["/admin/enrollments", "nav_enroll", "users", "enroll"], ["/admin/programs", "nav_programs", "programs", "programs"],
    ["/admin/cohorts", "nav_cohorts", "announce", "cohorts"], ["/admin/audit", "nav_audit", "audit", "audit"], ["/admin/settings", "nav_settings", "settings", "settings"]]],
  ["accG", [["/account", "nav_account", null, "account"]]],
];
const GL: Record<string, [string, string]> = { learnG: ["التعلّم", "LEARNING"], trainG: ["التدريب والإدارة", "TRAINING & ADMIN"], accG: ["الحساب", "ACCOUNT"] };
/** Which destinations earn a slot in the mobile tab bar, in priority order (the rest live under "More"). */
const TAB_PRIORITY = ["/learn", "/trainer", "/admin", "/admin/programs", "/values", "/plan"];
const TAB_LABEL: Record<string, string> = { "/learn": "tab_learn", "/values": "tab_values", "/plan": "tab_plan", "/trainer": "tab_trainer", "/admin": "tab_users", "/admin/programs": "tab_programs" };

const isActive = (href: string, path: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(href + "/"));
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("");

export default function Shell({ children }: { children: React.ReactNode }) {
  const { t, L, lang, setLang } = useI18n();
  const { me, can, logout } = useSession();
  const path = usePathname();
  const [more, setMore] = useState(false);

  useEffect(() => { setMore(false); }, [path]);
  useEffect(() => {
    if (!more) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMore(false); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [more]);

  if (!me) return <main><div className="wrap"><div className="skel" style={{ height: 28, width: 220 }} /><div className="skel" style={{ height: 160 }} /><div className="skel" style={{ height: 90 }} /></div></main>;

  const visible = GROUPS.map(([g, items]) => [g, items.filter(([, , p]) => !p || can(p))] as [string, Item[]]).filter(([, items]) => items.length);
  const all = visible.flatMap(([, items]) => items);
  const tabs = TAB_PRIORITY.map((h) => all.find(([href]) => href === h)).filter(Boolean).slice(0, 4) as Item[];
  const moreActive = !tabs.some(([href]) => isActive(href, path));
  const current = [...all].sort((a, b) => b[0].length - a[0].length).find(([href]) => isActive(href, path));
  const hour = new Date().getHours();
  const greet = hour < 12 ? L(["صباح الخير", "Good morning"]) : hour < 18 ? L(["مساء الخير", "Good afternoon"]) : L(["مساء النور", "Good evening"]);

  const navList = (
    <nav className="nav" aria-label={t("mainNav")}>
      {visible.map(([g, items]) => (
        <div key={g} style={{ display: "contents" }}>
          <div className="grp">{L(GL[g])}</div>
          {items.map(([href, key, , icon]) => (
            <Link key={href} href={href} aria-current={isActive(href, path) ? "page" : undefined}><Icon name={icon} />{t(key)}</Link>
          ))}
        </div>
      ))}
    </nav>
  );
  const langSwitch = (
    <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
      <div className="langsw" data-active={lang} role="group" aria-label={t("language")} style={{ flex: 1 }}>
        <button type="button" aria-pressed={lang === "ar"} onClick={() => setLang("ar")}>عربي</button>
        <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")}>English</button>
      </div>
      <ThemeToggle />
    </div>
  );
  const meCard = (
    <div className="me">
      <span className="avatar" aria-hidden>{initials(me.name)}</span>
      <span className="who"><b>{me.name}</b><span className="tiny faint">{t("role_" + me.role)}</span></span>
      <button type="button" className="iconbtn" onClick={logout} title={t("signOut")} aria-label={t("signOut")}><Icon name="logout" className="ico flip" /></button>
    </div>
  );

  return (
    <div className="shell">
      <aside className="rail">
        <Link className="brand" href="/"><img src={asset("/logo.png")} alt="" /><div><b>{t("brand")}</b><span>{t("tagline")}</span></div></Link>
        {navList}
        <div className="foot">{meCard}</div>
      </aside>

      <header className="topbar">
        <Link className="brand" href="/"><img src={asset("/logo.png")} alt="" /><div><b>{t("brand")}</b></div></Link>
        <span className="sp" />
        <ThemeToggle />
        <button type="button" className="iconbtn" onClick={() => setLang(lang === "ar" ? "en" : "ar")} aria-label={t("language")} title={lang === "ar" ? "English" : "عربي"}><Icon name="globe" /></button>
        <Link href="/account" className="avatar" aria-label={t("nav_account")} style={{ textDecoration: "none", width: 34, height: 34, fontSize: ".85rem" }}>{initials(me.name)}</Link>
      </header>

      <main id="main">
        <div className="appbar">
          {current && <span className="crumb"><Icon name={current[3]} />{t(current[1])}</span>}
          <span className="sp" />
          <span className="greet">{greet}{lang === "ar" ? "، " : ", "}{me.name.split(/\s+/)[0]}</span>
          {langSwitch}
        </div>
        <div className="wrap" key={path}><AppUpdate />{children}</div>
      </main>

      <nav className="tabbar" aria-label={t("mainNav")}>
        {tabs.map(([href, key, , icon]) => {
          const on = isActive(href, path);
          return <Link key={href} href={href} aria-current={on ? "page" : undefined}>{on && <span className="pip" />}<Icon name={icon} />{t(TAB_LABEL[href] || key)}</Link>;
        })}
        <button type="button" aria-expanded={more} aria-current={moreActive && !more ? "page" : undefined} onClick={() => setMore((v) => !v)}>
          {moreActive && !more && <span className="pip" />}<Icon name="more" />{t("tab_more")}
        </button>
      </nav>

      {more && <>
        <div className="sheet-bg" onClick={() => setMore(false)} />
        <div className="sheet" role="dialog" aria-modal="true" aria-label={t("tab_more")}>
          <div className="grab" />
          {meCard}
          {navList}
          {langSwitch}
        </div>
      </>}
    </div>
  );
}

export function Guard({ perm, children }: { perm?: string; children: React.ReactNode }) {
  const { t } = useI18n();
  const { can, me } = useSession();
  if (!me) return null;
  if (perm && !can(perm)) return <div className="empty">{t("forbidden")}</div>;
  return <>{children}</>;
}

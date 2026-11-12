"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Icon, { type IconName } from "@/components/icons";
import { CountUp } from "@/lib/motion";
import { useI18n } from "@/lib/i18n";

export function Head({ eyebrow, title, sub, right, icon }: { eyebrow?: string; title: string; sub?: string; right?: React.ReactNode; icon?: IconName }) {
  return (
    <div className="head">
      <div className="head-main">
        {icon && <span className="head-ic" aria-hidden><Icon name={icon} /></span>}
        <div className="t">{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{sub && <p className="muted">{sub}</p>}</div>
      </div>
      {right && <div className="head-actions">{right}</div>}
    </div>
  );
}

/** Row of key figures with an icon each; numbers count up when they come into view. */
export function Stats({ items }: { items: { icon: IconName; value: number | string | null | undefined; label: string; tone?: "acc" | "ok" | "gold" | "info" | "bad"; suffix?: string }[] }) {
  const { lang } = useI18n();
  return (
    <div className="stats">
      {items.map((it) => (
        <div key={it.label} className={`stat2 tone-${it.tone || "acc"}`}>
          <span className="si" aria-hidden><Icon name={it.icon} /></span>
          <div className="sv">
            <b>{typeof it.value === "number" ? <CountUp value={it.value} lang={lang} duration={900} /> : it.value ?? "—"}{it.suffix && <small>{it.suffix}</small>}</b>
            <span>{it.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("");

export function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  // A stable hue per person so the same name always gets the same colour.
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return <span className="avatar" aria-hidden style={{ width: size, height: size, fontSize: size * 0.38, background: `linear-gradient(135deg, hsl(${h} 45% 38%), hsl(${(h + 40) % 360} 50% 48%))` }}>{initials(name)}</span>;
}

/** Side panel on desktop, bottom sheet on phones. Closes with Esc or the backdrop. */
export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="drawer-bg" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="drawer-h"><h2>{title}</h2><button type="button" className="iconbtn" onClick={onClose} aria-label="close"><Icon name="close" /></button></div>
        <div className="drawer-b">{children}</div>
      </aside>
    </>
  );
}

/** Compact "⋯" menu for row actions. */
export function Menu({ label, children }: { label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false; };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);
  return (
    <details className="menu" ref={ref}>
      <summary className="iconbtn" aria-label={label} title={label}><Icon name="more" /></summary>
      <div className="menu-pop">{children}</div>
    </details>
  );
}

export function Field({ label, id, children, wide }: { label: string; id: string; children: React.ReactNode; wide?: boolean }) {
  return <div className={`fld ${wide ? "wide" : ""}`}><label htmlFor={id}>{label}</label>{children}</div>;
}

export function Alert({ kind = "bad", children }: { kind?: "bad" | "ok" | "warn"; children: React.ReactNode }) {
  return <div className={`alert ${kind}`} role={kind === "bad" ? "alert" : "status"}>{children}</div>;
}

export function Empty({ children, icon = "sparkle" }: { children: React.ReactNode; icon?: IconName }) {
  return <div className="empty"><span className="empty-ic" aria-hidden><Icon name={icon} /></span>{children}</div>;
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: [T, string][]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={value === k} onClick={() => onChange(k)}>{l}</button>)}
    </div>
  );
}

/** Two-press confirmation for destructive or decisive actions. */
export function ConfirmButton({ onConfirm, children, className = "btn danger", disabled }: { onConfirm: () => void; children: React.ReactNode; className?: string; disabled?: boolean }) {
  const { t } = useI18n();
  const [armed, setArmed] = useState(false);
  const timer = useRef<any>(null);
  return (
    <button type="button" className={className} disabled={disabled} onClick={() => {
      if (armed) { clearTimeout(timer.current); setArmed(false); onConfirm(); return; }
      setArmed(true); timer.current = setTimeout(() => setArmed(false), 5000);
    }}>{armed ? t("confirmAgain") : children}</button>
  );
}

const ToastCtx = createContext<(m: string) => void>(() => {});
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<any>(null);
  const show = useCallback((m: string) => { setMsg(m); clearTimeout(timer.current); timer.current = setTimeout(() => setMsg(null), 2600); }, []);
  return <ToastCtx.Provider value={show}>{children}{msg && <div className="toast" role="status" aria-live="polite">{msg}</div>}</ToastCtx.Provider>;
}
export const useToast = () => useContext(ToastCtx);

export function PasswordFields({ value, setValue, repeat, setRepeat, prefix = "pw" }: { value: string; setValue: (v: string) => void; repeat: string; setRepeat: (v: string) => void; prefix?: string }) {
  const { t } = useI18n();
  return (
    <>
      <Field label={t("newPassword")} id={`${prefix}-new`}><input className="inp" id={`${prefix}-new`} type="password" autoComplete="new-password" value={value} onChange={(e) => setValue(e.target.value)} minLength={12} maxLength={128} required /></Field>
      <Field label={t("repeatPassword")} id={`${prefix}-rep`}><input className="inp" id={`${prefix}-rep`} type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} required /></Field>
      <p className="tiny faint">{t("pwHint")}</p>
    </>
  );
}

export function StatusPill({ s }: { s: string }) {
  const { t } = useI18n();
  const cls = s === "approved" ? "ok" : s === "pending" ? "info" : "warn";
  return <span className={`pill ${cls}`}>{t("p_" + s)}</span>;
}

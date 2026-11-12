"use client";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";

export function Head({ eyebrow, title, sub, right }: { eyebrow?: string; title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="head">
      <div className="t">{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{sub && <p className="muted">{sub}</p>}</div>
      {right}
    </div>
  );
}

export function Field({ label, id, children, wide }: { label: string; id: string; children: React.ReactNode; wide?: boolean }) {
  return <div className={`fld ${wide ? "wide" : ""}`}><label htmlFor={id}>{label}</label>{children}</div>;
}

export function Alert({ kind = "bad", children }: { kind?: "bad" | "ok" | "warn"; children: React.ReactNode }) {
  return <div className={`alert ${kind}`} role={kind === "bad" ? "alert" : "status"}>{children}</div>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
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

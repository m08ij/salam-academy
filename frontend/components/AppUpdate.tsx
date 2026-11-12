"use client";
import { useEffect, useState } from "react";
import Icon from "@/components/icons";
import { useI18n } from "@/lib/i18n";
import { checkUpdate, installUpdate, type Release } from "@/lib/native";

/** Inside the Android app only: offers a newer APK when one is published. Dismissal is remembered per version. */
export default function AppUpdate() {
  const { L, lang } = useI18n();
  const [rel, setRel] = useState<Release | null>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    checkUpdate().then((u) => {
      if (!u) return;
      let dismissed = "";
      try { dismissed = localStorage.getItem("salam-update-dismissed") || ""; } catch {}
      if (dismissed !== String(u.release.versionCode)) setRel(u.release);
    });
  }, []);

  if (!rel) return null;
  const notes = (lang === "ar" ? rel.notes?.ar : rel.notes?.en) ?? [];
  return (
    <div className="update" role="status">
      <span className="update-ic"><Icon name="sparkle" /></span>
      <div className="update-t">
        <b>{L([`تحديث جديد للتطبيق ${rel.versionName}`, `App update ${rel.versionName}`])}</b>
        {msg ? <span className="small">{msg}</span> : notes.length > 0 && <span className="small">{notes.join(" · ")}</span>}
        {pct !== null && <div className="bar"><i style={{ width: `${pct}%` }} /></div>}
      </div>
      <div className="row" style={{ gap: 6 }}>
        <button type="button" className="btn pri sm" disabled={pct !== null && pct < 100} onClick={async () => {
          setMsg(null); setPct(0);
          const r = await installUpdate(rel, setPct);
          if (r === "permission") { setPct(null); setMsg(L(["اسمح بتثبيت التطبيقات من هذا المصدر، ثم اضغط «تحديث» مجددًا.", "Allow installs from this source, then tap Update again."])); }
          else if (r === "failed") { setPct(null); setMsg(L(["تعذّر التنزيل. تحقق من الاتصال وحاول مجددًا.", "Download failed. Check your connection and try again."])); }
        }}>{L(["تحديث", "Update"])}</button>
        <button type="button" className="iconbtn" aria-label={L(["لاحقًا", "Later"])} onClick={() => {
          try { localStorage.setItem("salam-update-dismissed", String(rel.versionCode)); } catch {}
          setRel(null);
        }}><Icon name="close" /></button>
      </div>
    </div>
  );
}

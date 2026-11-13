"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "@/components/icons";
import LessonBody from "@/components/LessonBody";
import { num, useI18n } from "@/lib/i18n";

/** Splits a lesson into short pages (~220 words, never breaking a block) and shows them one at a time. */
function pages(text: string, budget = 220): string[] {
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const out: string[][] = [[]];
  let words = 0;
  for (const b of blocks) {
    const w = b.split(/\s+/).length;
    if (words > 0 && words + w > budget) { out.push([]); words = 0; }
    out[out.length - 1].push(b);
    words += w;
  }
  return out.filter((p) => p.length).map((p) => p.join("\n\n"));
}

/** Reads text aloud with the best available voice for the page language (Arabic neural voices first), sentence by sentence. */
function Listen({ text }: { text: string }) {
  const { L, lang } = useI18n();
  const [on, setOn] = useState(false);
  const [rate, setRate] = useState(0.95);
  const [ok, setOk] = useState(false);
  useEffect(() => { setOk(typeof window !== "undefined" && "speechSynthesis" in window); return () => { try { speechSynthesis.cancel(); } catch {} }; }, []);
  useEffect(() => { if (on) { speechSynthesis.cancel(); setOn(false); } }, [text]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!ok) return null;
  const voice = () => {
    const vs = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith(lang));
    const score = (v: SpeechSynthesisVoice) => (/natural|neural|online|premium|enhanced/i.test(v.name) ? 4 : 0) + (/google|microsoft/i.test(v.name) ? 2 : 0) + (/sa|eg|ae/i.test(v.lang) ? 1 : 0);
    return vs.sort((a, b) => score(b) - score(a))[0];
  };
  const play = () => {
    speechSynthesis.cancel();
    const clean = text.replace(/[#*_>|]/g, " ").replace(/^\s*[-•]\s+/gm, "");
    const parts = clean.split(/(?<=[.!؟?،:\n])\s+/).map((s) => s.trim()).filter((s) => s.length > 1);
    const v = voice();
    parts.forEach((p, k) => {
      const u = new SpeechSynthesisUtterance(p);
      u.lang = v?.lang || (lang === "ar" ? "ar-SA" : "en-US"); if (v) u.voice = v; u.rate = rate;
      if (k === parts.length - 1) u.onend = () => setOn(false);
      speechSynthesis.speak(u);
    });
    setOn(true);
  };
  return (
    <span className="listen">
      <button type="button" className={`btn sm ${on ? "pri" : "ghost"}`} onClick={() => (on ? (speechSynthesis.cancel(), setOn(false)) : play())}>{on ? "■ " + L(["إيقاف", "Stop"]) : "🔊 " + L(["استمع", "Listen"])}</button>
      <select className="inp sm" value={rate} aria-label={L(["سرعة القراءة", "Speed"])} onChange={(e) => setRate(Number(e.target.value))}>
        {[0.8, 0.95, 1.1, 1.25].map((r) => <option key={r} value={r}>{r}×</option>)}
      </select>
    </span>
  );
}

export default function Reader({ text, title, onFinished }: { text: string; title: string; onFinished?: () => void }) {
  const { L, lang } = useI18n();
  const list = useMemo(() => pages(text), [text]);
  const [i, setI] = useState(0);
  const [all, setAll] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  const last = i >= list.length - 1;

  useEffect(() => { setI(0); }, [text]);
  useEffect(() => { if (last) onFinished?.(); }, [last, onFinished]);
  useEffect(() => {
    if (all) return;
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea")) return;
      const fwd = lang === "ar" ? "ArrowLeft" : "ArrowRight", back = lang === "ar" ? "ArrowRight" : "ArrowLeft";
      if (e.key === fwd) go(i + 1);
      if (e.key === back) go(i - 1);
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  });
  const go = (n: number) => {
    if (n < 0 || n >= list.length) return;
    setI(n);
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="reader" ref={top}>
      <div className="reader-top">
        <span className="tiny faint">{all ? L(["الدرس كاملًا", "Full lesson"]) : L([`صفحة ${num(i + 1, lang)} من ${num(list.length, lang)}`, `Page ${i + 1} of ${list.length}`])}</span>
        <Listen text={all ? text : list[i]} />
        <button type="button" className="btn ghost sm" onClick={() => { setAll((v) => !v); onFinished?.(); }}>{all ? L(["عرض صفحة صفحة", "Page by page"]) : L(["عرض الدرس كاملًا", "Show full lesson"])}</button>
      </div>
      {!all && <div className="reader-bar" aria-hidden><i style={{ width: `${((i + 1) / list.length) * 100}%` }} /></div>}
      <article className={`reader-page ${i === 0 || all ? "first" : ""}`} key={all ? "all" : i} aria-label={title}>
        <LessonBody text={all ? text : list[i]} />
      </article>
      {!all && list.length > 1 && (
        <div className="reader-nav">
          <button type="button" className="btn" disabled={i === 0} onClick={() => go(i - 1)}><Icon name="arrow" className="ico" />{L(["السابق", "Back"])}</button>
          <div className="reader-dots">{list.map((_, k) => <button key={k} type="button" aria-label={`${k + 1}`} aria-current={k === i} onClick={() => go(k)} />)}</div>
          {last ? <span className="pill ok">✓ {L(["انتهت القراءة", "Finished reading"])}</span>
            : <button type="button" className="btn pri" onClick={() => go(i + 1)}>{L(["التالي", "Next"])}<Icon name="arrow" className="ico flip" /></button>}
        </div>
      )}
    </div>
  );
}

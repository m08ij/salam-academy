"use client";
import { Fragment, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/icons";
import { ApiError, get, post } from "@/lib/api";
import { num, useI18n } from "@/lib/i18n";

type Src = { label: string; title: string; source: string; ref: string };
type Msg = { role: "user" | "bot"; text: string; sources?: Src[]; excerpts?: { label: string; title: string; text: string }[]; note?: "fallback" | "error" };
type Status = { available: boolean; configured: boolean; for_learners: boolean; daily_limit: number; used_today: number };

/** Renders "[الدرس 3]" / "[Book p. 42]" citations inside an answer as small chips, and "- " lines as a list. */
function Answer({ text }: { text: string }) {
  const cite = (line: string) => line.split(/(\[[^\]\n]{2,40}\])/g).map((p, i) =>
    /^\[[^\]]+\]$/.test(p) ? <span key={i} className="cite">{p.slice(1, -1)}</span> : <Fragment key={i}>{p.replace(/\*\*/g, "")}</Fragment>);
  const blocks = text.split(/\n{2,}/).map((b) => b.split("\n").filter((l) => l.trim()));
  return (
    <>{blocks.map((lines, i) => lines.every((l) => /^\s*[-•*]\s+/.test(l))
      ? <ul key={i}>{lines.map((l, k) => <li key={k}>{cite(l.replace(/^\s*[-•*]\s+/, ""))}</li>)}</ul>
      : <p key={i}>{lines.map((l, k) => <Fragment key={k}>{k > 0 && <br />}{cite(l)}</Fragment>)}</p>)}</>
  );
}

/**
 * Course assistant for the Identity course: a launcher and a chat window (floating card on desktop, full screen on phones).
 * Rendered in a portal so page-level entrance animations never touch it. Hidden when not available to this user.
 */
export default function CourseAssistant({ context }: { context?: string }) {
  const { L, lang, err } = useI18n();
  const [st, setSt] = useState<Status | null>(null);
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [mounted, setMounted] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setMounted(true); get<Status>("/assistant/status").then(setSt).catch(() => setSt(null)); }, []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, busy]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", k);
    setTimeout(() => input.current?.focus(), 250);
    return () => document.removeEventListener("keydown", k);
  });
  if (!mounted || !st?.available) return null;
  const left = Math.max(0, st.daily_limit - st.used_today);

  function close() {
    setClosing(true);
    setTimeout(() => { setOpen(false); setClosing(false); }, 180);
  }

  const ask = async (question: string) => {
    const text = question.trim();
    if (text.length < 3 || busy || left === 0) return;
    setQ(""); setBusy(true);
    setMsgs((m) => [...m, { role: "user", text }]);
    try {
      const history = msgs.filter((m) => !m.note).slice(-6).map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text.slice(0, 500) }));
      const r = await post<any>("/assistant/ask", { question: text, lang, history });
      setMsgs((m) => [...m, { role: "bot", text: r.answer, sources: r.sources, excerpts: r.excerpts, note: r.fallback ? "fallback" : undefined }]);
      setSt((s) => (s ? { ...s, used_today: s.used_today + 1 } : s));
    } catch (x) {
      const limited = x instanceof ApiError && x.status === 429;
      setMsgs((m) => [...m, { role: "bot", text: limited ? L(["وصلت للحد اليومي من الأسئلة. يمكنك المتابعة غدًا، أو سؤال مدربك.", "You've reached today's question limit. Continue tomorrow, or ask your trainer."]) : err(x), note: "error" }]);
    } finally { setBusy(false); }
  };

  const starters = [
    context ? L([`لخّص لي أهم أفكار «${context}»`, `Summarise the key ideas of “${context}”`]) : L(["ما المقصود بالهوية في الدورة؟", "What does the course mean by identity?"]),
    L(["ما الفرق بين الهوية والعلامة الشخصية؟", "What's the difference between identity and personal brand?"]),
    L(["كيف أصمم لوحة الرؤية؟", "How do I design my vision board?"]),
  ];

  const win = (
    <div className={`aiw-layer ${closing ? "closing" : ""}`}>
      <div className="aiw-scrim" onClick={close} />
      <section className="aiw" role="dialog" aria-modal="true" aria-label={L(["مساعد الدورة", "Course assistant"])}>
        <header className="aiw-head">
          <span className="aiw-avatar"><Icon name="sparkle" /></span>
          <div className="aiw-title">
            <b>{L(["مساعد الدورة", "Course assistant"])}</b>
            <span><i className="dot" />{st.for_learners ? L(["يجيب من دروس الدورة وكتابها", "Answers from the course lessons & book"]) : L(["وضع الاختبار للفريق", "Team testing mode"])}</span>
          </div>
          <button type="button" className="aiw-x" onClick={close} aria-label={L(["إغلاق", "Close"])}><Icon name="close" /></button>
        </header>

        <div className="aiw-body">
          {msgs.length === 0 && (
            <div className="aiw-hello">
              <span className="aiw-hello-ic"><Icon name="sparkle" /></span>
              <h3>{L(["أهلًا، كيف أساعدك؟", "Hi, how can I help?"])}</h3>
              <p>{L(["اسألني عن أي فكرة في دورة «هويتي المتكاملة وعلامتي الشخصية»، وسأجيبك من الدروس والكتاب مع ذكر المصدر.", "Ask me about any idea in the course and I'll answer from the lessons and the book, citing the source."])}</p>
              <div className="aiw-starters">
                {starters.map((s) => <button key={s} type="button" onClick={() => ask(s)}><span>{s}</span><Icon name="arrow" className="ico flip" /></button>)}
              </div>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={`aiw-msg ${m.role} ${m.note || ""}`}>
              {m.role === "bot" && <span className="aiw-mini"><Icon name="sparkle" /></span>}
              <div className="aiw-bubble">
                {m.role === "bot" ? <Answer text={m.text} /> : <p>{m.text}</p>}
                {m.excerpts?.map((e, k) => <blockquote key={k}><b>{e.label}{e.title ? ` · ${e.title}` : ""}</b>{e.text}…</blockquote>)}
                {!!m.sources?.length && <div className="aiw-src"><span>{L(["المصادر", "Sources"])}</span>{m.sources.slice(0, 5).map((s) => <span key={s.label} className="cite" title={s.title}>{s.label}</span>)}</div>}
              </div>
            </div>
          ))}
          {busy && <div className="aiw-msg bot"><span className="aiw-mini"><Icon name="sparkle" /></span><div className="aiw-bubble"><span className="ai-dots"><i /><i /><i /></span></div></div>}
          <div ref={end} />
        </div>

        <form className="aiw-input" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
          <div className="aiw-field">
            <textarea ref={input} rows={1} maxLength={600} value={q} placeholder={left ? L(["اكتب سؤالك عن الدورة…", "Ask about the course…"]) : L(["انتهت أسئلة اليوم", "No questions left today"])}
              disabled={left === 0} onChange={(e) => { setQ(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(120, e.target.scrollHeight) + "px"; }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(q); } }} aria-label={L(["سؤالك", "Your question"])} />
            <button className="aiw-send" type="submit" disabled={busy || q.trim().length < 3 || left === 0} aria-label={L(["أرسل", "Send"])}><Icon name="arrow" className="ico flip" /></button>
          </div>
          <span className="aiw-meta">{L(["للأسئلة الشخصية أو خارج المنهج اسأل مدربك", "For personal or off-course questions, ask your trainer"])} · {L(["المتبقي اليوم", "Left today"])} {num(left, lang)}</span>
        </form>
      </section>
    </div>
  );

  return (
    <>
      {!open && createPortal(
        <button type="button" className="ai-fab" onClick={() => setOpen(true)} aria-label={L(["مساعد الدورة", "Course assistant"])}>
          <Icon name="sparkle" /><span>{L(["اسأل المساعد", "Ask the assistant"])}</span>
        </button>, document.body)}
      {open && createPortal(win, document.body)}
    </>
  );
}

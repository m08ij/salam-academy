"use client";
import { Fragment, useEffect, useRef, useState } from "react";
import Icon from "@/components/icons";
import { Drawer } from "@/components/ui";
import { ApiError, get, post } from "@/lib/api";
import { num, useI18n } from "@/lib/i18n";

type Src = { label: string; title: string; source: string; ref: string };
type Msg = { role: "user" | "bot"; text: string; sources?: Src[]; excerpts?: { label: string; title: string; text: string }[]; note?: string };
type Status = { available: boolean; configured: boolean; for_learners: boolean; daily_limit: number; used_today: number };

/** Renders "[الدرس 3]" / "[Book p. 42]" citations inside an answer as small chips. */
function Cited({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]\n]{2,40}\])/g);
  return <>{parts.map((p, i) => /^\[[^\]]+\]$/.test(p) ? <span key={i} className="cite">{p.slice(1, -1)}</span> : <Fragment key={i}>{p}</Fragment>)}</>;
}

/** Course assistant for the Identity course: a launcher button and a chat panel. Hidden when not available to this user. */
export default function CourseAssistant({ context }: { context?: string }) {
  const { L, lang, err } = useI18n();
  const [st, setSt] = useState<Status | null>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { get<Status>("/assistant/status").then(setSt).catch(() => setSt(null)); }, []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, busy]);
  if (!st?.available) return null;
  const left = Math.max(0, st.daily_limit - st.used_today);

  const ask = async (question: string) => {
    const text = question.trim();
    if (text.length < 3 || busy) return;
    setQ(""); setBusy(true);
    setMsgs((m) => [...m, { role: "user", text }]);
    try {
      const r = await post<any>("/assistant/ask", { question: text, lang });
      setMsgs((m) => [...m, { role: "bot", text: r.answer, sources: r.sources, excerpts: r.excerpts, note: r.fallback ? "fallback" : undefined }]);
      setSt((s) => (s ? { ...s, used_today: s.used_today + 1 } : s));
    } catch (x) {
      const limited = x instanceof ApiError && x.status === 429;
      setMsgs((m) => [...m, { role: "bot", text: limited ? L(["وصلت للحد اليومي من الأسئلة. يمكنك المتابعة غدًا، أو سؤال مدربك.", "You've reached today's question limit. Continue tomorrow, or ask your trainer."]) : err(x), note: "error" }]);
    } finally { setBusy(false); }
  };

  const starters = [
    context ? L([`اشرح لي أهم أفكار «${context}» باختصار`, `Summarise the key ideas of “${context}”`]) : null,
    L(["ما الفرق بين الهوية والعلامة الشخصية؟", "What is the difference between identity and personal brand?"]),
    L(["كيف أصمم لوحة الرؤية؟", "How do I design my vision board?"]),
  ].filter(Boolean) as string[];

  return (
    <>
      <button type="button" className="ai-fab" onClick={() => setOpen(true)} aria-label={L(["مساعد الدورة", "Course assistant"])}>
        <Icon name="sparkle" /><span>{L(["اسأل المساعد", "Ask the assistant"])}</span>
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} title={L(["مساعد الدورة", "Course assistant"])}>
        <div className="ai-chat">
          <p className="tiny faint">{L(["يجيب فقط من دروس الدورة وكتابها، ويذكر المصدر. للأسئلة الشخصية أو خارج المنهج اسأل مدربك.", "Answers only from the course lessons and book, with sources. For personal or off-course questions, ask your trainer."])}
            {!st.for_learners && <b> · {L(["وضع الاختبار للفريق", "Team testing mode"])}</b>}</p>
          {msgs.length === 0 && <div className="ai-starters">{starters.map((s) => <button key={s} type="button" className="chip" onClick={() => ask(s)}>{s}</button>)}</div>}
          {msgs.map((m, i) => (
            <div key={i} className={`ai-msg ${m.role} ${m.note || ""}`}>
              <div className="pre"><Cited text={m.text} /></div>
              {m.excerpts?.map((e, k) => <blockquote key={k}><b>{e.label}{e.title ? ` · ${e.title}` : ""}</b>{e.text}…</blockquote>)}
              {!!m.sources?.length && <div className="ai-src"><span className="tiny faint">{L(["المصادر:", "Sources:"])}</span>{m.sources.slice(0, 5).map((s) => <span key={s.label} className="cite" title={s.title}>{s.label}</span>)}</div>}
            </div>
          ))}
          {busy && <div className="ai-msg bot"><span className="ai-dots"><i /><i /><i /></span></div>}
          <div ref={end} />
        </div>
        <form className="ai-input" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
          <textarea className="inp" rows={2} maxLength={600} value={q} placeholder={L(["اكتب سؤالك عن الدورة…", "Ask about the course…"])} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(q); } }} aria-label={L(["سؤالك", "Your question"])} />
          <div className="row between">
            <span className="tiny faint">{L(["المتبقي اليوم", "Left today"])}: {num(left, lang)}</span>
            <button className="btn pri" type="submit" disabled={busy || q.trim().length < 3 || left === 0}><Icon name="arrow" className="ico flip" />{L(["أرسل", "Send"])}</button>
          </div>
        </form>
      </Drawer>
    </>
  );
}

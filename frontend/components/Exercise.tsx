"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

/** Interactive worksheets for the practical sections (360 feedback, vision board). Saved inside the section's reflection. */
const KINDS: { match: RegExp; key: string; title: [string, string]; fields: [string, string][] }[] = [
  { match: /360|من أنت/, key: "360", title: ["تمرين التقييم 360", "360° feedback exercise"],
    fields: [["كيف أرى نفسي؟", "How do I see myself?"], ["كيف تراني أسرتي؟", "How does my family see me?"], ["كيف يراني زملائي أو أصدقائي؟", "How do colleagues/friends see me?"],
      ["نقاط القوة المشتركة", "Shared strengths"], ["فجوة أريد العمل عليها", "A gap I want to work on"]] },
  { match: /الرؤية|رؤية/, key: "vision", title: ["لوحة رؤيتي", "My vision board"],
    fields: [["رؤيتي في جملة", "My vision in one sentence"], ["الإيمان والروح", "Faith & spirit"], ["الأسرة والعلاقات", "Family & relationships"],
      ["العمل والعطاء", "Work & giving"], ["الصحة والذات", "Health & self"], ["خطوة أبدأ بها هذا الأسبوع", "A first step this week"]] },
];
const TAG = "⟦تمرين⟧";

export default function Exercise({ title, value, onSave }: { title: string; value: string; onSave: (v: string) => void }) {
  const { L } = useI18n();
  const kind = KINDS.find((k) => k.match.test(title));
  const parse = () => { try { const m = value.match(/⟦تمرين⟧(\{.*\})/s); return m ? JSON.parse(m[1]) : {}; } catch { return {}; } };
  const [d, setD] = useState<Record<string, string>>(parse);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setD(parse()); }, [title]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!kind) return null;
  const save = () => {
    const rest = value.replace(/\n*⟦تمرين⟧\{.*\}/s, "");
    onSave(`${rest}\n\n${TAG}${JSON.stringify(d)}`.trim());
    setSaved(true); setTimeout(() => setSaved(false), 1800);
  };
  return (
    <div className={`card exercise ex-${kind.key}`}>
      <h3>✍️ {L(kind.title)}</h3>
      <div className="ex-grid">
        {kind.fields.map((f, i) => (
          <label key={i} className="ex-cell"><span className="small"><b>{L(f)}</b></span>
            <textarea className="inp" rows={3} maxLength={600} value={d[i] || ""} onChange={(e) => setD({ ...d, [i]: e.target.value })} /></label>
        ))}
      </div>
      <button type="button" className="btn pri" onClick={save}>{saved ? "✓ " + L(["حُفظ", "Saved"]) : L(["احفظ التمرين", "Save exercise"])}</button>
    </div>
  );
}

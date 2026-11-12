"use client";
import Icon from "@/components/icons";

/**
 * Renders a lesson's plain-text body as structured reading:
 *  - "Title\n• Balance: …\n• Excess …: …\n• Deficit …: …"  → a value card with its three-part scale
 *  - "Title\n• item\n• item"                                 → a titled list
 *  - "Activity: …" / "نشاط: …"                               → a highlighted activity box
 *  - "Term: explanation" (short term)                         → a definition line
 *  - anything else                                            → a paragraph
 * Text is rendered as text (no HTML), so lesson content can never inject markup.
 */
const KIND: [RegExp, "b" | "t" | "l"][] = [[/^(الاتزان|Balance)/, "b"], [/^(الطغيان|Excess)/, "t"], [/^(الخسران|Deficit)/, "l"]];

function scaleKind(label: string) {
  for (const [re, k] of KIND) if (re.test(label.trim())) return k;
  return null;
}

function splitLabel(line: string): [string, string] | null {
  const m = line.match(/^([^:：]{2,48})[:：]\s*(.+)$/);
  return m ? [m[1].trim(), m[2].trim()] : null;
}

export default function LessonBody({ text }: { text: string }) {
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="lesson-body">
      {blocks.map((block, i) => {
        const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
        const head = lines[0];
        const bullets = lines.slice(1).filter((l) => l.startsWith("•")).map((l) => l.replace(/^•\s*/, ""));
        const isList = !head.startsWith("•") && bullets.length > 0 && bullets.length === lines.length - 1;
        const allBullets = lines.every((l) => l.startsWith("•"));

        // Value with its scale (balance / excess / deficit).
        if (isList || allBullets) {
          const items = allBullets ? lines.map((l) => l.replace(/^•\s*/, "")) : bullets;
          const parsed = items.map((it) => { const p = splitLabel(it); return p ? { label: p[0], body: p[1], kind: scaleKind(p[0]) } : { label: "", body: it, kind: null }; });
          const isScale = parsed.some((p) => p.kind);
          if (isScale) {
            return (
              <section key={i} className="lb-value">
                {!allBullets && <h4>{head}</h4>}
                <div className="lb-scale">
                  {parsed.map((p, k) => (
                    <div key={k} className={`lb-pan ${p.kind || ""}`}><b>{p.label}</b><span>{p.body}</span></div>
                  ))}
                </div>
              </section>
            );
          }
          return (
            <section key={i} className="lb-list">
              {!allBullets && <h4>{head}</h4>}
              <ul>{items.map((it, k) => <li key={k}>{it}</li>)}</ul>
            </section>
          );
        }

        // Activity callout.
        const lab = lines.length === 1 ? splitLabel(head) : null;
        if (lab && /^(نشاط|Activity)/.test(lab[0])) {
          return <aside key={i} className="lb-activity"><span className="lb-ic"><Icon name="sparkle" /></span><div><b>{lab[0]}</b><p>{lab[1]}</p></div></aside>;
        }
        // Short heading followed by a sentence on the next line(s).
        if (lines.length > 1 && head.length < 60 && !/[.:،]$/.test(head)) {
          return <section key={i} className="lb-list"><h4>{head}</h4>{lines.slice(1).map((l, k) => <p key={k}>{l}</p>)}</section>;
        }
        // Definition: "Term: explanation".
        if (lab) return <p key={i} className="lb-def"><b>{lab[0]}</b>{lab[1]}</p>;
        return <div key={i} className="lb-p">{lines.map((l, k) => <p key={k}>{l}</p>)}</div>;
      })}
    </div>
  );
}

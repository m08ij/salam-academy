"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import Reader from "@/components/Reader";
import { get } from "@/lib/api";
import { num, useI18n } from "@/lib/i18n";

/** Free sample: the welcome section of the Identity course, no account needed. */
export default function Preview() {
  const { L, lang } = useI18n();
  const [d, setD] = useState<any>(null);
  useEffect(() => { get("/public/preview").then(setD).catch(() => setD({})); }, []);
  return (
    <main className="wrap preview-page">
      <Link href="/" className="tiny faint">← {L(["الرئيسية", "Home"])}</Link>
      <span className="eyebrow">{L(["قسم مجاني من دورة «هويتي المتكاملة وعلامتي الشخصية»", "A free section of the Identity course"])}</span>
      <h1>{d?.title || "…"}</h1>
      <div className="card lesson-card">{d?.body ? <Reader text={d.body} title={d.title} /> : <div className="skel" style={{ height: 200 }} />}</div>
      <div className="card cta-card">
        <h3>{L(["أعجبك؟ تابع رحلتك", "Liked it? Continue"])}</h3>
        <p className="muted">{L([`${num(d?.sections || 23, lang)} قسمًا قصيرًا، بإشراف مدرب، ومساعد ذكي يجيبك من الدورة.`, "Short sections, a trainer, and an assistant that answers from the course."])}</p>
        <Link className="btn pri lg" href="/login">{L(["ابدأ الدورة", "Start the course"])}</Link>
      </div>
    </main>
  );
}

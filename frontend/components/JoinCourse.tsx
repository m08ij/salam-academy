"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Icon from "@/components/icons";
import { post } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

/** Invitation to join a self-enrolment course; a trainer is assigned automatically by the server. */
export default function JoinCourse({ program, onJoined }: { program: { id: string; title_ar: string; title_en: string; desc_ar: string; desc_en: string }; onJoined: () => void }) {
  const { L, err } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="join">
      <span className="join-blob" aria-hidden />
      <div className="join-copy">
        <span className="eyebrow">{L(["دورتك الأولى", "Your first course"])}</span>
        <h1>{L([program.title_ar, program.title_en])}</h1>
        <p>{L([program.desc_ar, program.desc_en])}</p>
        <ul className="join-points">
          <li><Icon name="book" />{L(["٢٣ قسمًا في أربعة أجزاء، بوتيرتك أنت", "23 sections in four parts, at your own pace"])}</li>
          <li><Icon name="trainer" />{L(["مدرب يُسند إليك تلقائيًا ويتابع تقدّمك", "A trainer is assigned to you and follows your progress"])}</li>
          <li><Icon name="sparkle" />{L(["مساعد ذكي يجيبك من الدروس والكتاب", "An AI assistant that answers from the lessons and book"])}</li>
        </ul>
        {error && <div className="alert bad small">{error}</div>}
        <button type="button" className="btn lg join-btn" disabled={busy} onClick={async () => {
          setBusy(true); setError(null);
          try { const r = await post<{ id: string }>("/learn/enrollments", { program_id: program.id }); onJoined(); router.push(`/learn/${r.id}`); }
          catch (x) { setError(err(x)); setBusy(false); }
        }}>{busy ? L(["جارٍ التسجيل…", "Joining…"]) : L(["ابدأ الدورة الآن", "Start the course now"])}<Icon name="arrow" className="ico flip" /></button>
      </div>
    </div>
  );
}

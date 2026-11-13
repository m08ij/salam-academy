"use client";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { widgetLang } from "./native";

export type Lang = "ar" | "en";
type Pair = [string, string];

const D: Record<string, Pair> = {
  brand: ["أكاديمية سلام", "Salam Academy"], tagline: ["منصة التعلّم القيمي", "Values-based learning"],
  signIn: ["تسجيل الدخول", "Sign in"], signOut: ["تسجيل الخروج", "Sign out"], email: ["البريد الإلكتروني", "E-mail"], password: ["كلمة المرور", "Password"],
  forgot: ["نسيت كلمة المرور؟", "Forgot your password?"], send: ["أرسل", "Send"], save: ["احفظ", "Save"], cancel: ["إلغاء", "Cancel"], close: ["إغلاق", "Close"],
  continue: ["متابعة", "Continue"], back: ["رجوع", "Back"], open: ["افتح", "Open"], delete: ["احذف", "Delete"], confirmAgain: ["اضغط مرة أخرى للتأكيد", "Press again to confirm"],
  loading: ["جارٍ التحميل…", "Loading…"], saved: ["حُفظ", "Saved"], none: ["—", "—"],
  mfaTitle: ["التحقق بخطوتين", "Two-step verification"], mfaCode: ["الرمز من تطبيق المصادقة", "Code from your authenticator app"], useRecovery: ["استخدم رمز استرداد", "Use a recovery code"], recoveryCode: ["رمز الاسترداد", "Recovery code"], useApp: ["استخدم تطبيق المصادقة", "Use the authenticator app"],
  newPassword: ["كلمة المرور الجديدة", "New password"], repeatPassword: ["أعد كتابة كلمة المرور", "Repeat the password"], currentPassword: ["كلمة المرور الحالية", "Current password"],
  pwHint: ["{n} أحرف على الأقل. يُفضّل عبارة من عدة كلمات يسهل تذكّرها ويصعب تخمينها.", "At least {n} characters. A passphrase of several words is easy to remember and hard to guess."],
  pwMismatch: ["كلمتا المرور غير متطابقتين.", "The passwords do not match."],
  resetTitle: ["تعيين كلمة مرور جديدة", "Set a new password"], inviteTitle: ["إنشاء كلمة المرور لحسابك", "Create your account password"],
  forgotTitle: ["استعادة الدخول", "Recover access"], forgotDone: ["إن كان البريد مسجّلًا فستصلك رسالة برابط صالح لمدة قصيرة.", "If this e-mail has an account, a short-lived link is on its way."],
  resetDone: ["تغيّرت كلمة المرور. سجّل الدخول من جديد.", "Your password was changed. Please sign in again."],
  inviteDone: ["تم إنشاء حسابك بنجاح. سجّل الدخول للبدء.", "Your account is ready. Sign in to get started."], language: ["اللغة", "Language"],
  nav_learn: ["دورتي", "My course"], nav_values: ["منظومة القيم", "Values system"], nav_gloss: ["قاموس الدورة", "Glossary"], nav_insights: ["أرقام الدورة", "Course numbers"], nav_plan: ["خطة نموّي", "My growth plan"],
  nav_trainer: ["متابعة المتدربين", "Trainee tracking"], nav_users: ["المستخدمون والأدوار", "Users & roles"], nav_enroll: ["الإسناد والتسجيل", "Enrollment & assignment"],
  nav_programs: ["البرامج والمستويات", "Programs & levels"], nav_cohorts: ["الدفعات والإعلانات", "Cohorts & announcements"], nav_audit: ["سجل التدقيق", "Audit log"], nav_settings: ["إعدادات التقييم", "Assessment settings"], nav_account: ["حسابي والأمان", "Account & security"],
  signInSub: ["أهلًا بعودتك. ادخل لمتابعة رحلتك.", "Welcome back. Sign in to continue your journey."], inviteOnly: ["الحسابات بدعوة من فريق الأكاديمية.", "Accounts are created by invitation from the academy team."],
  e_demo_mode: ["هذه نسخة عرض تجريبية؛ هذه الميزة تعمل بعد ربط الخادم.", "This is a preview build; this feature works once the server is connected."], demoBanner: ["نسخة عرض تجريبية — تسجيل الدخول والتعلّم يعملان بعد ربط الخادم.", "Preview build — sign-in and learning work once the server is connected."],
  e_trial_only: ["هذا البريد غير مسموح له بالدخول خلال الفترة التجريبية.", "This e-mail is not allowed to sign in during the trial period."],
  trialTitle: ["الفترة التجريبية", "Trial period"], trialNote: ["الدخول متاح حاليًا فقط لعناوين البريد المعتمدة من فريق سلام. إن لم يكن بريدك منها فتواصل مع إدارة الأكاديمية.", "Sign-in is currently open only to e-mail addresses approved by the Salam team. If yours is not one of them, contact the academy."],
  tab_learn: ["دورتي", "Course"], tab_values: ["القيم", "Values"], tab_plan: ["خطتي", "My plan"], tab_trainer: ["المتدربون", "Trainees"], tab_users: ["المستخدمون", "Users"], tab_programs: ["البرامج", "Programs"], tab_more: ["المزيد", "More"], mainNav: ["التنقل الرئيسي", "Main navigation"],
  role_owner: ["مالك المنصة", "Platform owner"], role_admin: ["مسؤول المنصة", "Platform admin"], role_developer: ["مطوّر المنصة", "Platform developer"], role_trainer: ["مدرب", "Trainer"], role_trainee: ["متدرب", "Trainee"],
  level: ["المستوى", "Level"], levels: ["المستويات", "Levels"], course: ["المقرر", "Course"], lesson: ["الدرس", "Lesson"], hours: ["ساعة", "h"], locked: ["مقفل", "Locked"], passed: ["مجتاز", "Passed"], current: ["الحالي", "Current"],
  graduated: ["خرّيج البرنامج", "Program graduate"], trainer: ["المدرب", "Trainer"], program: ["البرنامج", "Program"], cohort: ["الدفعة", "Cohort"], noTrainer: ["لم يُسنَد مدرب بعد", "No trainer assigned yet"],
  criteria: ["شروط الانتقال إلى المستوى التالي", "Criteria to move up"], c_lessons: ["إكمال دروس المستوى", "All level lessons done"], c_quiz: ["متوسط اختبارات المستوى", "Level quiz average"], c_eval: ["تقييم المدرب", "Trainer evaluation"], c_project: ["المشروع معتمد بالدرجة المطلوبة", "Project approved at the required grade"], c_final: ["العلامة النهائية", "Final mark"],
  required: ["المطلوب", "Required"], provisional: ["مبدئية حتى اكتمال التقييم", "provisional until fully assessed"], eligible: ["مؤهل للانتقال — بانتظار اعتماد المدرب", "Eligible — awaiting trainer approval"], inProgress: ["قيد الإنجاز", "In progress"],
  quizzes: ["الاختبارات", "Quizzes"], evaluation: ["تقييم المدرب", "Trainer evaluation"], project: ["المشروع", "Project"], final: ["العلامة النهائية", "Final mark"],
  p_none: ["لم يُسلَّم", "Not submitted"], p_pending: ["بانتظار تقييم المدرب", "Awaiting trainer review"], p_approved: ["معتمد", "Approved"], p_revise: ["يحتاج تعديلًا", "Needs revision"],
  projectTitle: ["عنوان المشروع", "Project title"], projectSummary: ["ملخص ما أنجزته وأدلة التطبيق", "Summary of your work and evidence"], projectLink: ["رابط الملف أو العرض (https، اختياري)", "Link to file or presentation (https, optional)"],
  submitProject: ["سلّم المشروع", "Submit project"], resubmit: ["أعد التسليم", "Resubmit"], trainerFeedback: ["ملاحظات المدرب", "Trainer feedback"], history: ["سجل الانتقالات", "Promotion history"], override: ["اعتماد استثنائي", "Override"],
  quiz: ["اختبار قصير", "Quick quiz"], checkAnswers: ["تحقّق من الإجابات", "Check answers"], needCorrect: ["تحتاج إجابات صحيحة على الأقل:", "Correct answers needed:"], complete: ["أكمل الدرس", "Complete lesson"], completed: ["مكتمل", "Completed"],
  reflection: ["تأمّل وتدوين", "Reflection"], reflectionHint: ["ماذا تعلّمت؟ وكيف ستطبّقه في علاقاتك الثلاث؟", "What did you learn, and how will you apply it in your three relationships?"],
  reflPrivate: ["تأملاتك خاصة بك؛ يمكنك مشاركتها مع مدربك من «حسابي والأمان».", "Your reflections are private; you can share them with your trainer from “Account & security”."], reflShared: ["تأملاتك مشاركة مع مدربك.", "Your reflections are shared with your trainer."],
  watch: ["شاهد المادة المرئية", "Watch the video"], nextLesson: ["الدرس التالي", "Next lesson"], prevLesson: ["الدرس السابق", "Previous lesson"], toJourney: ["مسيرتي", "My journey"],
  promote: ["اعتمد الانتقال", "Approve promotion"], graduate: ["اعتمد التخرّج", "Approve graduation"], reason: ["السبب (إلزامي، يُسجَّل في سجل التدقيق)", "Reason (required; recorded in the audit log)"],
  grade: ["الدرجة (من ١٠٠)", "Grade (out of 100)"], decision: ["القرار", "Decision"], note: ["ملاحظات", "Notes"], saveReview: ["احفظ تقييم المشروع", "Save project review"], saveEval: ["احفظ التقييم", "Save evaluation"],
  rubricHint: ["١ = يحتاج دعمًا كبيرًا · ٥ = متميز", "1 = needs strong support · 5 = outstanding"], notShared: ["لم يشاركها المتدرب؛ تبقى خاصة به.", "Not shared by the trainee; it stays private."],
  trainees: ["المتدربون", "Trainees"], mine: ["متدربيّ", "My trainees"], all: ["الكل", "All"], unassigned: ["بلا مدرب", "No trainer"], name: ["الاسم", "Name"], status: ["الحالة", "Status"], lastActive: ["آخر دخول", "Last sign-in"],
  invite: ["دعوة مستخدم", "Invite a user"], role: ["الدور", "Role"], suspend: ["أوقف", "Suspend"], activate: ["فعّل", "Activate"], forceReset: ["افرض تغيير كلمة المرور", "Force password reset"], resetMfa: ["أعد ضبط التحقق بخطوتين", "Reset two-step"], unlock: ["فك القفل", "Unlock"], resend: ["أعد إرسال الدعوة", "Resend invite"],
  s_active: ["نشط", "Active"], s_invited: ["مدعو", "Invited"], s_suspended: ["موقوف", "Suspended"], s_pending: ["بانتظار التأكيد", "Pending"],
  security: ["الأمان", "Security"], privacy: ["الخصوصية", "Privacy"], sessions: ["الجلسات النشطة", "Active sessions"], thisDevice: ["هذا الجهاز", "This device"], revoke: ["أنهِ", "Revoke"], revokeOthers: ["أنهِ كل الجلسات الأخرى", "Sign out all other sessions"],
  changePassword: ["تغيير كلمة المرور", "Change password"], enableMfa: ["فعّل التحقق بخطوتين", "Turn on two-step verification"], mfaOn: ["التحقق بخطوتين مفعّل", "Two-step verification is on"], mfaOff: ["التحقق بخطوتين غير مفعّل", "Two-step verification is off"],
  scanQr: ["امسح الرمز بتطبيق مصادقة (مثل Google Authenticator أو Microsoft Authenticator أو 1Password)، ثم أدخل الرمز المكوّن من ٦ أرقام.", "Scan the code with an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…), then enter the 6-digit code."],
  manualKey: ["أو أدخل هذا المفتاح يدويًا", "Or enter this key manually"], recoveryCodes: ["رموز الاسترداد", "Recovery codes"],
  recoveryHint: ["احفظ هذه الرموز في مكان آمن الآن؛ لن تظهر مرة أخرى. كل رمز يعمل مرة واحدة إن فقدت هاتفك.", "Store these codes somewhere safe now; they will not be shown again. Each works once if you lose your phone."],
  regenCodes: ["أنشئ رموز استرداد جديدة", "Generate new recovery codes"], disableMfa: ["أوقف التحقق بخطوتين", "Turn off two-step verification"], mfaRequiredStaff: ["التحقق بخطوتين إلزامي لأعضاء فريق المنصة.", "Two-step verification is mandatory for the platform team."],
  mfaSetupForced: ["دورك يتطلب تفعيل التحقق بخطوتين قبل المتابعة.", "Your role requires two-step verification before you continue."], pwChangeForced: ["يجب تغيير كلمة المرور قبل المتابعة.", "You must change your password before continuing."],
  shareRefl: ["شارك تأملاتي مع مدربي", "Share my reflections with my trainer"], sharePlan: ["شارك خطة نموي مع مدربي", "Share my growth plan with my trainer"],
  exportData: ["نزّل نسخة من بياناتي", "Download a copy of my data"], deleteAccount: ["احذف حسابي وبياناتي", "Delete my account and data"], deleteHint: ["يُمسح محتواك الشخصي نهائيًا ويُجهَّل حسابك؛ تبقى قرارات التدريب سجلًا مجهول الهوية.", "Your personal content is erased and your account anonymised; training decisions remain as anonymous records."],
  rel1: ["العلاقة بالله ﷻ", "Relationship with Allah"], rel2: ["العلاقة بالنفس", "Relationship with Self"], rel3: ["العلاقة بالآخرين", "Relationship with Others"], groups: ["مجموعات الأسماء الحسنى", "Groups of the Beautiful Names"],
  balance: ["الاتزان", "Balance"], excess: ["الطغيان (تفعيل سلبي)", "Excess (negative activation)"], deficit: ["الخسران (تعطيل)", "Deficit (deactivation)"], behaviors: ["السلوكيات", "Behaviors"], addToPlan: ["أضف إلى خطتي", "Add to my plan"], inPlan: ["في خطتي", "In my plan"], search: ["ابحث…", "Search…"],
  announcements: ["الإعلانات", "Announcements"], noData: ["لا توجد بيانات بعد.", "Nothing here yet."], forbidden: ["هذه الصفحة ليست ضمن صلاحيات دورك.", "This page is outside your role’s permissions."],
  e_invalid_credentials: ["البريد أو كلمة المرور غير صحيحة. بعد عدة محاولات خاطئة يُقفل الحساب مؤقتًا.", "Wrong e-mail or password. After several failed attempts the account is locked for a while."],
  e_rate_limited: ["محاولات كثيرة. انتظر قليلًا ثم حاول مجددًا.", "Too many attempts. Wait a moment and try again."], e_invalid_code: ["الرمز غير صحيح أو مستخدم من قبل.", "The code is wrong or already used."],
  e_invalid_token: ["الرابط غير صالح أو منتهي الصلاحية. اطلب رابطًا جديدًا.", "The link is invalid or expired. Request a new one."], e_csrf: ["انتهت صلاحية الصفحة. حدّثها وحاول مجددًا.", "This page expired. Refresh and try again."],
  e_level_locked: ["هذا المستوى مقفل حتى يعتمد مدربك انتقالك.", "This level is locked until your trainer approves your promotion."], e_quiz_not_passed: ["اجتز الاختبار أولًا.", "Pass the quiz first."],
  e_not_eligible: ["لم تُستوفَ شروط الانتقال بعد.", "The promotion criteria are not met yet."], e_forbidden: ["لا تملك صلاحية هذا الإجراء.", "You are not allowed to do this."], e_role_not_assignable: ["لا تملك صلاحية منح هذا الدور.", "You cannot grant this role."],
  e_admin_requires_owner: ["إدارة المسؤولين من صلاحية مالك المنصة فقط.", "Only the platform owner can manage admins."], e_cannot_modify_self: ["لا يمكنك تعديل دورك أو حالتك بنفسك.", "You cannot change your own role or status."], e_email_exists: ["هذا البريد مسجّل من قبل.", "This e-mail already has an account."],
  e_validation_error: ["تحقق من الحقول المدخلة.", "Check the fields you entered."], e_no_submission: ["لم يُسلَّم مشروع بعد.", "No project has been submitted yet."], e_server_error: ["حدث خطأ غير متوقع.", "Something went wrong."], e_unauthenticated: ["انتهت الجلسة. سجّل الدخول من جديد.", "Your session ended. Please sign in again."],
  w_too_short: ["قصيرة جدًا", "too short"], w_too_long: ["طويلة جدًا", "too long"], w_too_common: ["شائعة وسهلة التخمين", "common and easy to guess"], w_repeated_chars: ["فيها تكرار متتالٍ لحرف", "has a character repeated in a row"],
  w_contains_personal_info: ["تحتوي على اسمك أو بريدك", "contains your name or e-mail"], w_breached: ["ظهرت في تسريبات بيانات معروفة", "appeared in known data breaches"], w_same_as_current: ["مطابقة للحالية", "same as the current one"],
};

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: string) => string; L: (p?: (string | null | undefined)[] | null) => string; err: (e: any) => string }>(null as any);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangS] = useState<Lang>("ar");
  useEffect(() => {
    try { const s = localStorage.getItem("salam-lang"); if (s === "ar" || s === "en") setLangS(s); } catch {}
  }, []);
  // Layout effect so the direction flips inside the language view transition (see setLang).
  useLayoutEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    widgetLang(lang);
  }, [lang]);
  const setLang = useCallback((l: Lang) => {
    const apply = () => { setLangS(l); try { localStorage.setItem("salam-lang", l); } catch {} };
    const doc = document as any, html = document.documentElement;
    if (html.lang === l || !doc.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { apply(); return; }
    // The page slides out and back in along the new reading direction.
    html.classList.add("vt-lang", l === "en" ? "to-en" : "to-ar");
    const vt = doc.startViewTransition(() => flushSync(apply));
    vt.finished.finally(() => html.classList.remove("vt-lang", "to-en", "to-ar"));
  }, []);
  const v = useMemo(() => {
    const i = lang === "ar" ? 0 : 1;
    const t = (k: string) => (D[k] ? D[k][i] : k);
    const L = (p?: (string | null | undefined)[] | null) => (p ? (p[i] || p[1 - i] || "") : "");
    const err = (e: any) => {
      const code = e?.code || "server_error";
      if (code === "weak_password" && Array.isArray(e?.detail?.errors)) return (lang === "ar" ? "كلمة المرور مرفوضة: " : "Password rejected: ") + e.detail.errors.map((x: string) => t("w_" + x)).join(lang === "ar" ? "، " : ", ");
      return D["e_" + code] ? D["e_" + code][i] : t("e_server_error");
    };
    return { lang, setLang, t, L, err };
  }, [lang, setLang]);
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
export const num = (n: number | null | undefined, lang: Lang) => (n == null ? "—" : new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US", { maximumFractionDigits: 1 }).format(n));
export const date = (iso: string | null | undefined, lang: Lang) => (iso ? new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-GB", { dateStyle: "medium" }).format(new Date(iso + (iso.endsWith("Z") ? "" : "Z"))) : "—");

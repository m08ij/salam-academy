# أكاديمية سلام — النسخة الإنتاجية · Salam Academy (production edition)

منصة تعلّم ثنائية اللغة (العربية والإنجليزية) لمشروع سلام: حسابات بكلمات مرور خاصة بالمنصة، وتحقق بخطوتين، وأدوار وصلاحيات مطبّقة على الخادم، وبرامج متعددة المستويات بشروط انتقال واعتماد مدرب.

A bilingual (Arabic/English) learning platform for the Salam project: platform-owned accounts with passwords, two-step verification, server-enforced roles, and multi-level programs with promotion criteria and trainer approval.

---

## المكوّنات · Components

| | |
|---|---|
| `backend/` | FastAPI · SQLAlchemy 2 · Alembic · PostgreSQL 16 · Argon2id · TOTP |
| `frontend/` | Next.js 14 (App Router) · TypeScript · RTL/LTR · self-hosted fonts |
| `docker-compose.yml` | db + api + web (web published on 127.0.0.1:3000 behind your TLS proxy) |

المتصفح يتعامل مع أصل واحد فقط (الواجهة)، والواجهة تمرّر `/api/*` إلى الخادم داخليًا؛ لذلك الكوكيز من الطرف الأول و`SameSite` يعمل كما ينبغي.
The browser only talks to one origin (the web app), which proxies `/api/*` to the API on the internal network — cookies stay first-party.

## التشغيل · Running

```bash
cp .env.example .env            # املأ القيم · fill in the values
docker compose run --rm api python -m app.cli gen-key      # → SALAM_MFA_ENCRYPTION_KEY
docker compose up -d --build
docker compose exec api python -m app.cli seed              # منظومة القيم + برنامج «أفضل نسخة من نفسك» بثلاثة مستويات
docker compose exec -it api python -m app.cli create-owner --email you@example.org --name "اسمك"
```

ثم ضع أمامها وكيلًا عكسيًا بشهادة TLS (nginx / Caddy / Traefik) يوجّه النطاق إلى `127.0.0.1:3000`. يجب أن يطابق `SALAM_APP_URL` العنوان الذي يكتبه المستخدمون تمامًا.
Put a TLS reverse proxy in front, forwarding your domain to `127.0.0.1:3000`. `SALAM_APP_URL` must exactly match the public address.

أول دخول للمالك يفرض تفعيل التحقق بخطوتين. بعدها: «المستخدمون والأدوار» ← دعوة المدربين والمتدربين؛ «الإسناد والتسجيل» ← إسناد كل متدرب إلى برنامج ومدرب ودفعة.
The owner's first sign-in forces two-step setup. Then invite trainers and trainees, and assign each trainee to a program, trainer and cohort.

### التطوير المحلي · Local development

```bash
cd backend && pip install -r requirements.txt -r requirements-dev.txt
export SALAM_ENVIRONMENT=development SALAM_COOKIE_SECURE=false SALAM_APP_URL=http://localhost:3000 \
       SALAM_DATABASE_URL=sqlite:///./dev.db SALAM_MFA_ENCRYPTION_KEY=$(python -m app.cli gen-key)
alembic upgrade head && python -m app.cli seed && python -m app.cli create-owner --email you@example.org --name "Dev"
uvicorn app.main:app --reload
cd ../frontend && npm ci && API_ORIGIN=http://127.0.0.1:8000 npm run dev
pytest                                   # 16 اختبارًا · 16 tests (SQLite)
SALAM_TEST_DATABASE_URL=postgresql+psycopg://… pytest   # على PostgreSQL · on PostgreSQL
```

في وضع التطوير ومن دون SMTP تظهر روابط الدعوة للمسؤول في الواجهة؛ لا يحدث ذلك في الإنتاج أبدًا.
In development without SMTP, invite links are shown to the admin in the UI; never in production.

---

## الأدوار والصلاحيات · Roles & permissions (enforced in `app/permissions.py`)

| الصلاحية · Permission | مالك Owner | مسؤول Admin | مطوّر Developer | مدرب Trainer | متدرب Trainee |
|---|:-:|:-:|:-:|:-:|:-:|
| التعلّم والاختبارات والمشاريع · Learn, quizzes, projects | 👁 | 👁 | 👁 | 👁 | ✓ |
| متابعة المتدربين المسندين وتقييمهم واعتماد انتقالهم · Track, evaluate & promote assigned trainees | ✓ | ✓ | — | ✓ | — |
| رؤية كل المتدربين · See all trainees | ✓ | ✓ | — | — | — |
| دعوة المستخدمين والإسناد · Invite users & assign | ✓ | ✓ | — | — | — |
| تغيير الأدوار · Change roles | ✓ | ✓ (دون المسؤول) | — | — | — |
| منح/سحب دور المسؤول · Grant/revoke admin | ✓ | — | — | — | — |
| الاعتماد الاستثنائي (بسبب مكتوب) · Override promotion (with reason) | ✓ | ✓ | — | — | — |
| بناء البرامج والمستويات والمقررات · Build programs/levels/courses | ✓ | ✓ | ✓ | — | — |
| معايير التقييم وسلّم التقديرات · Rubric & grade scale | ✓ | — | ✓ | — | — |
| سجل التدقيق والتصدير · Audit log & export | ✓ | ✓ | ✓ | — | — |

قواعد ثابتة: لا أحد يغيّر دوره أو حالته بنفسه؛ لا يُعدَّل المالك عبر الواجهة؛ تغيير الدور ينهي جلسات الشخص فتسري الصلاحية الجديدة عند دخوله التالي؛ المدرب لا يرى إلا متدربيه (وطلب غيرهم يعيد 404 لا 403 حتى لا يكشف وجودهم).
Fixed rules: nobody changes their own role/status; the owner cannot be modified through the API; a role change revokes that person's sessions; trainers only see their own trainees (others answer 404, not 403).

## المستويات والانتقال · Levels & promotion (`app/services/progress.py`)

كل برنامج ← مستويات ← مقررات ← دروس ← أسئلة. شروط الانتقال من أي مستوى (قابلة للضبط لكل مستوى):
Program → levels → courses → lessons → questions. Promotion out of a level requires (configurable per level):

1. إكمال كل دروس المستوى — وإكمال درس فيه اختبار يتطلب اجتيازه (٣ إجابات صحيحة أو كل الأسئلة إن كانت أقل). **التصحيح على الخادم؛ الإجابات الصحيحة لا تُرسَل إلى المتصفح.**
2. متوسط اختبارات المستوى ≥ الحد الأدنى.
3. تقييم المدرب على معايير المنصة (١–٥) ≥ الحد الأدنى.
4. مشروع المستوى مسلَّم ومعتمد من المدرب بدرجة ≥ الحد الأدنى.
5. العلامة النهائية المرجّحة (افتراضيًا ٤٠٪ اختبارات · ٣٠٪ تقييم · ٣٠٪ مشروع) ≥ الحد الأدنى، مع تقدير من سلّم التقديرات.

لا يتقدّم المتدرب إلا باعتماد مدربه بعد استيفاء الشروط، أو باعتماد استثنائي من المسؤول بسبب مكتوب يُسجَّل في سجل التدقيق. المستويات الأعلى مقفلة على الخادم (`403 level_locked`). اعتماد آخر مستوى = تخرّج.
Trainees advance only when their trainer approves after all criteria are met, or by an admin override with a written, audited reason. Higher levels are locked server-side. Approving the last level graduates the trainee.

---

## الأمان والخصوصية · Security & privacy

انظر `SECURITY.md` للتفاصيل. أبرزها · Highlights:

- **كلمات المرور:** Argon2id (m=64MiB, t=3, p=2) مع إعادة التجزئة تلقائيًا عند تغيّر المعايير؛ سياسة على نهج NIST SP 800-63B (١٢ حرفًا على الأقل، قائمة كلمات ضعيفة، منع الاسم/البريد، اختياريًا فحص التسريبات عبر k-anonymity). لا يرى أحد كلمات المرور، ولا تُرسَل بالبريد أبدًا.
- **الحسابات:** دعوات بروابط أحادية الاستخدام (تُخزَّن مجزّأة، صالحة ٧٢ ساعة)؛ استعادة كلمة المرور برابط ٣٠ دقيقة لا يكشف وجود الحساب؛ قفل مؤقت بعد ٥ محاولات خاطئة؛ حدود معدّل لكل IP وكل بريد.
- **التحقق بخطوتين:** TOTP بأسرار مشفّرة (Fernet)، ومنع إعادة استخدام الرمز، و١٠ رموز استرداد أحادية الاستخدام؛ **إلزامي لكل فريق المنصة**.
- **الجلسات:** معرّف عشوائي ٢٥٦ بت في كوكي `HttpOnly; Secure; SameSite=Lax`، مخزَّن مجزّأً؛ انتهاء بعد ٣٠ دقيقة خمول و١٢ ساعة كحد أقصى؛ تدوير المعرّف بعد التحقق؛ إنهاء كل الجلسات عند تغيير/استعادة كلمة المرور؛ قائمة جلسات يمكن إنهاؤها.
- **CSRF:** رمز مربوط بالجلسة في ترويسة `X-CSRF-Token` + فحص `Origin` لكل طلب يغيّر الحالة.
- **الخصوصية:** تأملات المتدرب وخطة نموه لا يراها المدرب إلا إذا شاركها المتدرب؛ تنزيل البيانات الشخصية؛ حذف الحساب (مسح المحتوى الشخصي وتجهيل الهوية).
- **التدقيق:** كل حدث أمني وتدريبي (دخول، فشل، قفل، أدوار، إسناد، تقييم، انتقال، استثناء، تصدير…) في سجل إلحاقي.

## الصيانة · Operations

- النسخ الاحتياطي: `pg_dump` لقاعدة البيانات + احفظ `SALAM_MFA_ENCRYPTION_KEY` منفصلًا (فقدانه يلزم إعادة ضبط التحقق بخطوتين للجميع).
- تنظيف دوري: `python -m app.cli prune` (يوميًا عبر cron).
- البريد: اضبط SMTP بـ SPF/DKIM/DMARC لنطاقك حتى تصل الدعوات وروابط الاستعادة.
- الترقية: `docker compose up -d --build` يطبّق الترحيلات تلقائيًا.

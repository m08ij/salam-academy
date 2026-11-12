"""Loads the Salam values catalog and the default three-level program «أفضل نسخة من نفسك» from salam_payload.json.
Idempotent: the catalog is replaced; the program is created only if its slug does not exist yet."""
import json
import random
from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..models import CatBehavior, CatGroup, CatName, CatValue, Course, Lesson, Level, Program, Question

PAYLOAD = Path(__file__).with_name("salam_payload.json")
REL_AR = {1: "العلاقة بالله ﷻ", 2: "العلاقة بالنفس", 3: "العلاقة بالآخرين"}
REL_EN = {1: "Relationship with Allah", 2: "Relationship with Self", 3: "Relationship with Others"}
_AR_DIGITS = str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")


def _ar(n) -> str:
    """Arabic-Indic digits, matching the hand-written numbers in the Arabic lesson text."""
    return str(n).translate(_AR_DIGITS)


EMO = [45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55]


def load() -> dict:
    return json.loads(PAYLOAD.read_text(encoding="utf-8"))


def seed_catalog(db: Session, D: dict) -> None:
    for m in (CatBehavior, CatValue, CatName, CatGroup):
        db.execute(delete(m))
    db.flush()
    for g in D["groups"]:
        db.add(CatGroup(id=g["id"], position=g["o"], title_ar=g["t"][0], title_en=g["t"][1], desc_ar=g["d"][0], desc_en=g["d"][1], color=g["col"], skills=g["sk"]))
    db.flush()
    owner = {}
    for g in D["groups"]:
        for n in g["names"]:
            if n and n not in owner:
                owner[n] = g["id"]
    for nid, (ar, en) in D["names"].items():
        db.add(CatName(id=int(nid), title_ar=ar, title_en=en, group_id=owner.get(int(nid))))
    for v in D["values"]:
        db.add(CatValue(id=v["id"], relation=v["r"], family=v["f"], title_ar=v["t"][0], title_en=v["t"][1], scale={"balance": v["b"], "excess": v["x"], "deficit": v["l"]}))
    db.flush()
    for b in D["beh"]:
        db.add(CatBehavior(id=b[0], value_id=b[1], name_id=b[2], group_id=b[3], text_ar=b[4], text_en=b[5] or "", unofficial_en=bool(b[6])))
    db.flush()


# ---------------- lesson content ----------------
def _scale_text(v: dict, lang: int) -> str:
    b, x, l_ = v["b"][lang], v["x"][lang], v["l"][lang]
    if lang == 0:
        return f"• الاتزان: {b}\n• الطغيان (تفعيل سلبي): {x}\n• الخسران (تعطيل): {l_}"
    return f"• Balance: {b}\n• Excess (negative activation): {x}\n• Deficit (deactivation): {l_}"


def _has_scale(v: dict) -> bool:
    return bool((v["b"][0] or v["b"][1]) and (v["x"][0] or v["x"][1]))


def bodies(D: dict, lesson: dict) -> tuple[str, str]:
    V = {v["id"]: v for v in D["values"]}
    G = {g["id"]: g for g in D["groups"]}
    beh = D["beh"]
    fw = D["fw"]
    k = lesson["k"]
    if k == "group":
        g = G[lesson["g"]]
        names = [D["names"][str(n)] for n in g["names"] if n]
        rows = [b for b in beh if b[3] == g["id"]]
        counts: dict = {}
        for b in rows:
            counts[b[1]] = counts.get(b[1], 0) + 1
        top = [V[v] for v, _ in sorted(counts.items(), key=lambda x: -x[1])[:6]]
        ar = [g["d"][0], "", "الأسماء الحسنى في المجموعة: " + "، ".join(n[0] for n in names), "", "مهارات الذكاء العاطفي المستلهمة: " + "، ".join(g["sk"][0]), "", "القيم الأكثر ارتباطًا بالمجموعة:"]
        en = [g["d"][1], "", "The Beautiful Names in this group: " + ", ".join(n[1] for n in names), "", "Emotional-intelligence skills drawn from them: " + ", ".join(g["sk"][1]), "", "Values most tied to this group:"]
        for v in top:
            ar.append(f"\n{v['t'][0]} ({REL_AR[v['r']]})")
            en.append(f"\n{v['t'][1]} ({REL_EN[v['r']]})")
            if _has_scale(v):
                ar.append(_scale_text(v, 0))
                en.append(_scale_text(v, 1))
        ar.append("\nتطبيقات في العلاقات الثلاث:")
        en.append("\nApplications in the three relationships:")
        for r in (1, 2, 3):
            ex = [b for b in rows if V[b[1]]["r"] == r][:3]
            if ex:
                ar.append(f"{REL_AR[r]}:\n" + "\n".join("• " + b[4] for b in ex))
                en.append(f"{REL_EN[r]}:\n" + "\n".join("• " + (b[5] or b[4]) for b in ex))
        ar.append("\nنشاط: اختر ثلاث سلوكيات من هذه المجموعة وأضفها إلى خطة نموك، ثم دوّن كيف ستطبقها هذا الأسبوع.")
        en.append("\nActivity: pick three behaviors from this group, add them to your growth plan, and write how you will apply them this week.")
        return "\n".join(ar), "\n".join(en)
    cs = fw["concepts"]
    if k == "intro":
        ar = "«سلام» برنامج صحة نفسية وتنمية ذات مبني على القيم؛ يعتمد على الإيمان بالله ﷻ وبأسمائه الحسنى، وعلى أحدث الأبحاث في علم النفس الإيجابي والذكاء العاطفي.\n\n" + \
             f"تتكون المنظومة من ٣ علاقات، و١٢ مجموعة للأسماء الحسنى، و{_ar(D['stats']['names'])} معنى من الأسماء الحسنى، و{_ar(D['stats']['values'])} قيمة بموازينها، و{_ar(D['stats']['beh'])} سلوكًا.\n\n" + "\n\n".join(f"{c[0]}: {c[2]}" for c in cs)
        en = "Salam is a values-based mental-health and self-development program built on faith in Allah and His Beautiful Names and on research in positive psychology and emotional intelligence.\n\n" + \
             f"The system has 3 relationships, 12 groups of the Names, {D['stats']['names']} meanings of the Names, {D['stats']['values']} values with scales and {D['stats']['beh']} behaviors.\n\n" + "\n\n".join(f"{c[1]}: {c[3]}" for c in cs)
        return ar, en
    if k == "emotions":
        ar = ["المشاعر حاجات إنسانية تؤثر في قراراتنا وعلاقاتنا. لكل شعور ميزان: اتزان، وطغيان، وخسران."]
        en = ["Emotions are human needs that shape our decisions and relationships. Each emotion has a scale: balance, excess and deficit."]
        for vid in EMO[:6]:
            v = V[vid]
            ar.append(f"\n{v['t'][0]}\n{_scale_text(v, 0)}")
            en.append(f"\n{v['t'][1]}\n{_scale_text(v, 1)}")
        return "\n".join(ar), "\n".join(en)
    if k == "game":
        return ("لعبة «أنت قائد العالم»: تخيّل أنك تقود العالم وأجب عن الأسئلة الكبرى: لماذا هناك شر؟ هل الإنسان مخيّر؟ لماذا هناك موت؟ اربط إجاباتك بمجموعات الأسماء الحسنى، ودوّن تأملك.",
                "“You Are the World Leader”: imagine you lead the world and answer the big questions — why is there evil, do humans have free will, why is there death? Connect your answers to the groups of the Names and write your reflection.")
    if k == "belief":
        c = cs[4] if len(cs) > 4 else cs[-1]
        return (f"{c[2]}\n\nسلسلة التغيير: الأسماء الحسنى ← قناعات سليمة ← أفكار سليمة ← مشاعر إيجابية ← سلوك إيجابي.",
                f"{c[3]}\n\nThe chain of change: the Beautiful Names → sound convictions → sound thoughts → positive emotions → positive behavior.")
    if k == "identity":
        c = cs[1]
        return (f"{c[2]}\n\nنشاط: اختر خمس قيم تمثّل هويتك واكتب لكل قيمة كيف تبدو في حالة الاتزان.", f"{c[3]}\n\nActivity: choose five values that define you and describe how each looks in balance.")
    if k == "goals":
        return ("حدّد هدفًا كبيرًا في كل علاقة من العلاقات الثلاث، واربطه بمؤشر قياس وموعد.", "Set one major goal in each of the three relationships, each with a measure and a due date.")
    if k == "relations":
        c = cs[5] if len(cs) > 5 else cs[-1]
        return (f"العلاقات الثلاث: بالله ﷻ، وبالنفس، وبالآخرين، وتكاملها.\n\n{c[2]}\n\n«مَنْ عَمِلَ صَالِحًا مِّن ذَكَرٍ أَوْ أُنثَىٰ وَهُوَ مُؤْمِنٌ فَلَنُحْيِيَنَّهُ حَيَاةً طَيِّبَةً» — النحل ٩٧",
                f"The three relationships — with Allah, with oneself and with others — and how they fit together.\n\n{c[3]}")
    if k == "closing":
        ar = "تلخيص ما تعلمته من المجموعات الاثنتي عشرة، وإعادة صياغة أهدافك ورسالتك في الحياة.\n\nخطوات اتخاذ القرار وحل الأزمات:\n" + "\n".join(f"{i}. {p[0]}" for i, p in enumerate(fw["plan"], 1))
        en = "Summarize the twelve groups and rewrite your life goals and mission.\n\nDecision and crisis steps:\n" + "\n".join(f"{i}. {p[1]}" for i, p in enumerate(fw["plan"], 1))
        return ar, en
    return lesson["t"][0], lesson["t"][1]


def questions(D: dict, lesson: dict) -> list[dict]:
    rnd = random.Random(f"salam:{lesson['id']}")
    V = {v["id"]: v for v in D["values"]}
    G = {g["id"]: g for g in D["groups"]}
    N = D["names"]
    out: list[dict] = []

    def mk(q, correct, wrong):
        opts = [correct] + wrong[:3]
        rnd.shuffle(opts)
        out.append({"q_ar": q[0], "q_en": q[1], "options": [list(o) for o in opts], "correct": opts.index(correct)})

    def scale_q(v):
        if not _has_scale(v):
            return
        other = rnd.choice([x for x in D["values"] if x["id"] != v["id"] and _has_scale(x)])
        mk((f"ما «الطغيان» في قيمة «{v['t'][0]}»؟", f"What is the excess of “{v['t'][1]}”?"), tuple(v["x"]), [tuple(v["l"]), tuple(v["b"]), tuple(other["x"])])

    k = lesson["k"]
    if k == "group":
        g = G[lesson["g"]]
        own = [n for n in g["names"] if n]
        others = sorted({n for x in D["groups"] if x["id"] != g["id"] for n in x["names"] if n and n not in own})
        n = rnd.choice(own)
        mk((f"أي هذه الأسماء من مجموعة «{g['t'][0]}»؟", f"Which Name belongs to “{g['t'][1]}”?"), tuple(N[str(n)]), [tuple(N[str(x)]) for x in rnd.sample(others, 3)])
        rows = [b for b in D["beh"] if b[3] == g["id"]]
        if rows:
            b = rnd.choice(rows)
            wrong = rnd.sample(sorted({x[2] for x in D["beh"] if x[2] != b[2]}), 3)
            mk((f"هذا السلوك مستلهم من أي اسم؟ «{b[4]}»", f"Which Name inspires: “{b[5] or b[4]}”?"), tuple(N[str(b[2])]), [tuple(N[str(x)]) for x in wrong])
        sk_ar, sk_en = g["sk"]
        i = rnd.randrange(len(sk_ar))
        pool = [(a, e) for x in D["groups"] if x["id"] != g["id"] for a, e in zip(*x["sk"], strict=False) if a not in sk_ar]
        mk((f"أي مهارة ذكاء عاطفي ترتبط بمجموعة «{g['t'][0]}»؟", f"Which EQ skill belongs to “{g['t'][1]}”?"), (sk_ar[i], sk_en[i]), rnd.sample(pool, 3))
        cand = [V[x] for x in g["vx"] if x in V and _has_scale(V[x])] or [x for x in D["values"] if _has_scale(x)]
        scale_q(rnd.choice(cand))
    elif k == "intro":
        mk(("كم عدد العلاقات التي تقوم عليها منظومة سلام؟", "How many relationships does Salam’s system rest on?"), ("٣", "3"), [("٢", "2"), ("٤", "4"), ("١٢", "12")])
        mk(("طرفا ميزان القيمة هما:", "The two ends of a value’s scale are:"), ("الطغيان والخسران", "Excess and deficit"), [("الحب والكره", "Love and hate"), ("الثواب والعقاب", "Reward and punishment"), ("العقل والعاطفة", "Reason and emotion")])
        mk(("كم مجموعة تُصنّف فيها الأسماء الحسنى وفق سلام؟", "Into how many groups does Salam classify the Names?"), ("١٢", "12"), [("٩", "9"), ("٧", "7"), ("٩٩", "99")])
        mk(("ما الترتيب الصحيح لمسار اشتقاق القيم؟", "What is the right derivation order?"), ("الاسم ← السلوكيات ← المهارات ← القيم", "Name → behaviors → skills → values"),
           [("القيم ← المهارات ← الاسم ← السلوكيات", "Values → skills → Name → behaviors"), ("المهارات ← القيم ← السلوكيات ← الاسم", "Skills → values → behaviors → Name"), ("السلوكيات ← الاسم ← القيم ← المهارات", "Behaviors → Name → values → skills")])
    elif k == "emotions":
        for vid in rnd.sample(EMO, 4):
            scale_q(V[vid])
    elif k == "belief":
        mk(("ما أول حلقة في سلسلة التغيير وفق سلام؟", "What is the first link in Salam’s chain of change?"), ("الأسماء الحسنى", "The Beautiful Names"), [("السلوك", "Behavior"), ("المشاعر", "Emotions"), ("الأفكار", "Thoughts")])
        mk(("ما الذي يقوّي الإيمان في دورة الإيمان والعمل الصالح؟", "What strengthens faith in the cycle?"), ("ممارسة السلوكيات الأخلاقية", "Practicing ethical behaviors"), [("حفظ التعريفات", "Memorizing definitions"), ("تجنّب المشاعر", "Avoiding emotions"), ("الاعتماد على الآخرين", "Depending on others")])
        mk(("مهارات الذكاء العاطفي في منهج سلام هي:", "In Salam, EQ skills are:"), ("قيم في حالة عمل", "Values in action"), [("صفات فطرية لا تتغير", "Fixed innate traits"), ("معلومات نظرية", "Theory only"), ("أساليب إقناع", "Persuasion tactics")])
    elif k == "identity":
        mk(("تُشبَّه منظومة القيم في الهوية بـ:", "In identity, the value system is likened to:"), ("نظام التشغيل", "An operating system"), [("الواجهة", "A user interface"), ("الذاكرة المؤقتة", "Temporary memory"), ("الزينة", "Decoration")])
        mk(("إذا رأيت ظلمًا فالقيمة التي تُفعَّل هي:", "Facing injustice, the value to activate is:"), ("العدل والحق", "Justice and truth"), [("الخيال", "Imagination"), ("التغافل", "Detachment"), ("النسيان", "Forgetting")])
        mk(("إذا اعتذر لك شخص فالقيمة المناسبة:", "When someone apologizes, the fitting value is:"), ("التسامح", "Forgiveness"), [("الحزم", "Decisiveness"), ("الهيبة", "Prestige"), ("التنافس", "Competitiveness")])
    elif k == "relations":
        for v in rnd.sample(D["values"], 4):
            wrong = [(REL_AR[r], REL_EN[r]) for r in (1, 2, 3) if r != v["r"]] + [("لا تنتمي لأي علاقة", "None")]
            mk((f"إلى أي علاقة تنتمي قيمة «{v['t'][0]}»؟", f"Which relationship does “{v['t'][1]}” belong to?"), (REL_AR[v["r"]], REL_EN[v["r"]]), wrong)
    return out


PROGRAM = {
    "slug": "best-version",
    "levels": [
        {"t": ("المستوى الأول: العالم الداخلي", "Level 1: The inner world"), "module": 0, "crit": (70, 3.5, 70, 70),
         "courses": [(("مقرر ١: سلام والمشاعر والأسئلة الكبرى", "Course 1: Salam, emotions & the big questions"), ["s-intro", "s-emo", "s-game"]),
                     (("مقرر ٢: المعتقدات والهوية والأهداف", "Course 2: Beliefs, identity & goals"), ["s-belief", "s-id", "s-goals"])],
         "project": (("خطة النمو الشخصي", "Personal growth plan"), ("خطة نمو مكتملة بمراحلها الخمس في العلاقات الثلاث، مبنية على تقييمك الذاتي، مع أدلة تطبيق لمدة أسبوعين.", "A complete five-step growth plan across the three relationships, based on your self-assessment, with two weeks of evidence."))},
        {"t": ("المستوى الثاني: مهارات الذكاء العاطفي عبر الأسماء الحسنى", "Level 2: EQ skills through the Beautiful Names"), "module": 1, "crit": (75, 3.5, 75, 75),
         "courses": [(("مقرر ٣: المجموعات ١–٦", "Course 3: Groups 1–6"), "groups:0:6"), (("مقرر ٤: المجموعات ٧–١٢", "Course 4: Groups 7–12"), "groups:6:12")],
         "project": (("مشروع تطبيقي على ثلاث مجموعات", "Applied project on three groups"), ("اختر ثلاث مجموعات وطبّق سلوكياتها أربعة أسابيع، مع سجل متابعة أسبوعي وقياس قبل وبعد.", "Pick three groups and apply their behaviors for four weeks, with a weekly log and before/after measurement."))},
        {"t": ("المستوى الثالث: الحياة الطيبة", "Level 3: The good life"), "module": 2, "crit": (80, 4, 80, 80),
         "courses": [(("مقرر ٥: العلاقات الثلاث والتركيب الختامي", "Course 5: The three relationships & synthesis"), ["s-rel", "s-close"])],
         "project": (("المبادرة القيمية الختامية", "Capstone values initiative"), ("مبادرة قيمية تخدم الأسرة أو المؤسسة أو المجتمع، بخطة تنفيذ ومؤشرات أثر وعرض للنتائج.", "A values initiative serving a family, organization or community, with an implementation plan, impact indicators and results."))},
    ],
}


def seed_program(db: Session, D: dict, active: bool = True) -> Program | None:
    if db.scalar(select(Program).where(Program.slug == PROGRAM["slug"])):
        return None
    lessons = {ls["id"]: ls for m in D["path"] for ls in m["lessons"]}
    order = [g["id"] for g in sorted(D["groups"], key=lambda g: g["o"])]
    best = D["programs"][0]
    p = Program(slug=PROGRAM["slug"], title_ar=best["t"][0], title_en=best["t"][1], desc_ar=best["d"][0], desc_en=best["d"][1], active=active)
    for i, lv in enumerate(PROGRAM["levels"], 1):
        mod = D["path"][lv["module"]]
        q, e, pr, f = lv["crit"]
        level = Level(position=i, title_ar=lv["t"][0], title_en=lv["t"][1], desc_ar=mod["d"][0], desc_en=mod["d"][1], min_quiz=q, min_eval=e, min_project=pr, min_final=f,
                      project_title_ar=lv["project"][0][0], project_title_en=lv["project"][0][1], project_brief_ar=lv["project"][1][0], project_brief_en=lv["project"][1][1])
        for j, (ct, ids) in enumerate(lv["courses"], 1):
            if isinstance(ids, str):
                _, a, b = ids.split(":")
                ids = [f"g{g}" for g in order[int(a):int(b)]]
            course = Course(position=j, title_ar=ct[0], title_en=ct[1])
            for k_, lid in enumerate(ids, 1):
                src = lessons[lid]
                bar, ben = bodies(D, src)
                ls = Lesson(position=k_, title_ar=src["t"][0], title_en=src["t"][1], hours=src["h"], body_ar=bar, body_en=ben, group_ref=src.get("g"))
                ls.questions = [Question(position=qi, **qq) for qi, qq in enumerate(questions(D, src), 1)]
                course.lessons.append(ls)
            level.courses.append(course)
        p.levels.append(level)
    db.add(p)
    db.flush()
    return p


def run(db: Session) -> None:
    D = load()
    seed_catalog(db, D)
    seed_program(db, D)
    db.commit()

"""Retrieval over course knowledge (lesson sections + book pages) for the assistant.

Lexical BM25 with Arabic normalisation: no embedding service, no extra cost, works with any chat model.
"""
import math
import re
import threading
from collections import Counter

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import KnowledgeChunk

_DIAC = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۭـ]")  # harakat, Quranic marks, tatweel
_TOKEN = re.compile(r"[\w؀-ۿ]+", re.UNICODE)
# Very common words that carry no meaning for search.
_STOP = set("""
في من على الى إلى عن مع هذا هذه ذلك تلك التي الذي الذين اللذين ما ماذا لماذا كيف هل او أو ثم قد لا لم لن ان إن أن كان كانت يكون تكون هو هي هم هن انت أنت انا أنا نحن كل بعض اي أي غير بين عند حتى اذا إذا لكن بل و ف ب ل ك
the a an and or of to in on for with is are was were be been it this that these those what how why do does can you your i we they he she
""".split())
# Light Arabic prefix/suffix stripping (conservative: keeps words at least 3 letters long).
_PREFIXES = ("وال", "بال", "كال", "فال", "لل", "ال", "و", "ف", "ب", "ل")
_SUFFIXES = ("هما", "كما", "ات", "ون", "ين", "ان", "ها", "هم", "كم", "نا", "ية", "ه", "ي", "ة")


def normalize(text: str) -> str:
    t = _DIAC.sub("", text)
    t = re.sub("[إأآٱ]", "ا", t)
    t = t.replace("ى", "ي").replace("ؤ", "و").replace("ئ", "ي")
    return t.lower()


def _stem(w: str) -> str:
    for p in _PREFIXES:
        if w.startswith(p) and len(w) - len(p) >= 3:
            w = w[len(p):]
            break
    for s in _SUFFIXES:
        if w.endswith(s) and len(w) - len(s) >= 3:
            w = w[: -len(s)]
            break
    return w


def tokens(text: str) -> list[str]:
    return [_stem(w) for w in _TOKEN.findall(normalize(text)) if w not in _STOP and len(w) > 1]


def _split_words(text: str, size: int = 220, overlap: int = 40) -> list[str]:
    words = text.split()
    if len(words) <= size:
        return [text.strip()] if text.strip() else []
    out, i = [], 0
    while i < len(words):
        out.append(" ".join(words[i:i + size]))
        i += size - overlap
    return out


def chunk_lessons(lessons: list[tuple[int, str, str]]) -> list[tuple[str, int, str, str]]:
    """(source, ref, title, text) per ~220-word passage, keeping paragraphs together where possible."""
    out = []
    for n, title, body in lessons:
        buf: list[str] = []
        for para in [p.strip() for p in body.split("\n\n") if p.strip()]:
            if buf and len(" ".join(buf).split()) + len(para.split()) > 220:
                out += [("lesson", n, title, piece) for piece in _split_words("\n".join(buf))]
                buf = []
            buf.append(para)
        if buf:
            out += [("lesson", n, title, piece) for piece in _split_words("\n".join(buf))]
    return out


def chunk_pages(pages: list[tuple[int, str]]) -> list[tuple[str, int, str, str]]:
    out = []
    for page, text in pages:
        clean = re.sub(r"[ \t]+", " ", text).strip()
        if len(clean.split()) < 12:  # covers, blank and index pages
            continue
        out += [("book", page, "", piece) for piece in _split_words(clean, 260, 40)]
    return out


class _Index:
    def __init__(self, rows: list[KnowledgeChunk]):
        self.rows = rows
        self.docs = [Counter(tokens(f"{r.title} {r.text}")) for r in rows]
        self.lens = [sum(d.values()) for d in self.docs]
        self.avg = (sum(self.lens) / len(self.lens)) if self.lens else 1
        df: Counter = Counter()
        for d in self.docs:
            df.update(d.keys())
        n = len(rows)
        self.idf = {t: math.log(1 + (n - c + 0.5) / (c + 0.5)) for t, c in df.items()}

    def search(self, query: str, k: int = 5, k1: float = 1.4, b: float = 0.75) -> list[tuple[float, KnowledgeChunk]]:
        q = [t for t in tokens(query) if t in self.idf]
        if not q:
            return []
        scored = []
        for i, d in enumerate(self.docs):
            s = 0.0
            for t in q:
                f = d.get(t, 0)
                if f:
                    s += self.idf[t] * f * (k1 + 1) / (f + k1 * (1 - b + b * self.lens[i] / self.avg))
            if s > 0:
                scored.append((s, self.rows[i]))
        scored.sort(key=lambda x: -x[0])
        return scored[:k]


_cache: dict[str, _Index] = {}
_lock = threading.Lock()


def invalidate(slug: str) -> None:
    with _lock:
        _cache.pop(slug, None)


def search(db: Session, slug: str, query: str, k: int = 5) -> list[tuple[float, KnowledgeChunk]]:
    with _lock:
        idx = _cache.get(slug)
        if idx is None:
            rows = db.scalars(select(KnowledgeChunk).where(KnowledgeChunk.program_slug == slug).order_by(KnowledgeChunk.id)).all()
            for r in rows:
                db.expunge(r)  # cached across requests
            idx = _cache[slug] = _Index(list(rows))
    return idx.search(query, k)

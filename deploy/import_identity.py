"""Builds the Identity course bundle from the source files and uploads it to a running site.

The course files stay on your computer (they are never committed):
  python deploy/import_identity.py --src "C:/…/drive-download…" --url https://salam-academy-pzyd.onrender.com --email owner@example.org
The password is read from SALAM_IMPORT_PASSWORD or asked for. The account needs the "programs" permission (owner/admin/developer).
Requires: pdftotext (Poppler; bundled with Git for Windows) for the book.
"""
import argparse
import getpass
import json
import os
import re
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

import httpx

SCRIPT = "سكريبت دورة هويتي وعلامتي الشخصية بدون ملاحظات.docx"
EXAM = "اختبار دورة الهوية.docx"
BOOK = "كتاب هويتي المتكاملة وعلامتي الشخصية - ويب.pdf"
DROP_COLORS = {"0070C0", "00B050"}  # editor/graphics instructions in the script (see the colour key at its top)


def _unescape(s):
    return s.replace("&quot;", '"').replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&apos;", "'")


def _paragraphs(path):
    x = zipfile.ZipFile(path).read("word/document.xml").decode("utf8")
    for p in re.findall(r"<w:p[ >].*?</w:p>", x, re.S):
        runs = []
        for r in re.findall(r"<w:r[ >].*?</w:r>", p, re.S):
            t = "".join(re.findall(r"<w:t[^>]*>([^<]*)</w:t>", r))
            if t:
                col = (re.search(r'<w:color w:val="(\w+)"', r) or [None, ""])[1].upper()
                hl = (re.search(r'<w:highlight w:val="(\w+)"', r) or [None, ""])[1]
                bold = bool(re.search(r"<w:b/>|<w:b [^>]*/>", r))
                runs.append((t, col, hl, bold))
        yield runs


def lessons(path):
    out, cur, started = [], None, False
    for runs in _paragraphs(path):
        raw = _unescape("".join(t for t, *_ in runs)).strip()
        if not raw:
            continue
        if raw.startswith("====="):
            started = True
            continue
        if not started:
            continue
        if cur is not None and cur.get("open"):  # heading split over two paragraphs
            cur["title"] += " – " + raw.strip(" ()")
            cur["open"] = False
            continue
        m = re.match(r"^\(\(\(+\s*(\d+)\s*[-–]\s*(.+?)\s*$", raw)
        if m:
            title = m.group(2)
            cur = {"n": int(m.group(1)), "title": re.sub(r"\s+", " ", title).strip(" )"), "paras": [], "open": not title.rstrip().endswith(")))")}
            out.append(cur)
            continue
        if cur is None:
            continue
        if all(col == "00B0F0" for t, col, hl, _ in runs if t.strip()) and "(((" in raw:  # interview question
            cur["paras"].append(("q", re.sub(r"[()]+", "", raw).strip()))
            continue
        kept = _unescape("".join(t for t, col, hl, _ in runs if col not in DROP_COLORS and not (col == "00B0F0" and hl == "yellow")))
        kept = re.sub(r"\(\(\(.*?\)\)\)+", "", kept)
        kept = re.sub(r"\(\(\(.*$", "", kept)
        kept = re.sub(r"\s+", " ", kept).strip()
        if not kept or re.fullmatch(r"[\d.\s]+|المقاطع|عنوان فاصل", kept):
            continue
        if re.search(r"[a-zA-Z]{3,}", kept) and not re.search(r"[\u0600-\u06FF]", kept):
            continue
        cur["paras"].append(("p", kept))
    result = []
    for ls in out:
        blocks, head, items = [], None, []

        def flush():
            nonlocal head, items
            if items:
                blocks.append(((head + "\n") if head else "") + "\n".join("• " + i for i in items))
            elif head:
                blocks.append(head)
            head, items = None, []

        for kind, t in ls["paras"]:
            if kind == "q":
                flush()
                head = t if t.endswith("؟") else t + "؟"
                continue
            if len(t) < 70 and not re.search(r"[.!؟?]$", t) and (head or items):
                items.append(t)
                continue
            flush()
            if t.endswith(":"):
                head = t
            else:
                blocks.append(t)
        flush()
        result.append({"n": ls["n"], "title": ls["title"], "body": "\n\n".join(blocks)})
    return result


def exam(path):
    qs, cur, started = [], None, False
    for runs in _paragraphs(path):
        raw = _unescape("".join(t for t, *_ in runs)).strip()
        if not raw:
            continue
        if raw.startswith("==="):
            started = True
            continue
        if not started:
            continue
        marked = any(hl or b or (col and col not in ("000000", "AUTO")) for t, col, hl, b in runs if t.strip())
        if re.search(r"[:：؟?]\s*$", raw) and not marked:
            cur = {"q": raw, "options": [], "correct": None}
            qs.append(cur)
        elif cur is not None:
            if marked and cur["correct"] is None:
                cur["correct"] = len(cur["options"])
            cur["options"].append(raw)
    bad = [q["q"] for q in qs if q["correct"] is None or len(q["options"]) < 2]
    if bad:
        sys.exit(f"Exam questions without a marked answer: {bad}")
    return qs


def book(path):
    with tempfile.TemporaryDirectory() as d:
        out = Path(d) / "book.txt"
        subprocess.run(["pdftotext", "-enc", "UTF-8", str(path), str(out)], check=True)
        pages = out.read_text(encoding="utf8").split("\f")
    res = []
    for i, p in enumerate(pages, 1):
        p = re.sub(r"[\u0640\u200e\u200f\u202a-\u202e\u2066-\u2069]", "", p)  # elongation and direction marks
        lines = [ln.strip() for ln in p.split("\n")]
        lines = [ln for ln in lines if ln and ln != "هويتي المتكاملة وعلامتي الشخصية" and not re.fullmatch(r"\d{1,3}", ln)]
        text = re.sub(r"[ \t]{2,}", " ", "\n".join(lines)).strip()
        if text:
            res.append({"page": i, "text": text})
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True, help="folder with the course .docx/.pdf files")
    ap.add_argument("--url", required=True, help="site address, e.g. https://salam-academy-pzyd.onrender.com")
    ap.add_argument("--email", required=True)
    ap.add_argument("--dry", action="store_true", help="only build and summarise the bundle")
    a = ap.parse_args()
    src = Path(a.src)
    bundle = {"lessons": lessons(src / SCRIPT), "exam": exam(src / EXAM), "book": book(src / BOOK)}
    print(f"bundle: {len(bundle['lessons'])} lessons, {len(bundle['exam'])} exam questions, {len(bundle['book'])} book pages")
    if a.dry:
        return
    pw = os.environ.get("SALAM_IMPORT_PASSWORD") or getpass.getpass("Password: ")
    base = a.url.rstrip("/")
    with httpx.Client(base_url=base, headers={"Origin": base}, timeout=120, follow_redirects=True) as c:
        r = c.post("/api/auth/login", json={"email": a.email, "password": pw})
        if r.status_code != 200:
            sys.exit(f"sign-in failed: {r.status_code} {r.text[:200]}")
        csrf = c.cookies.get("salam_csrf")
        r = c.post("/api/admin/content/identity", json=bundle, headers={"X-CSRF-Token": csrf or ""})
        print(r.status_code, r.text[:400])
        c.post("/api/auth/logout", headers={"X-CSRF-Token": csrf or ""})
        if r.status_code != 200:
            sys.exit(1)


if __name__ == "__main__":
    main()

"""Launcher icons and splash screens from the Salam logo (frontend/public/logo.png).

Run:  python mobile/tools/make-icons.py
Replace the logo with a high-resolution version (ideally an SVG export ≥ 512 px) and re-run for sharper icons.
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
LOGO = Image.open(ROOT / "frontend/public/logo.png").convert("RGBA")
RES = ROOT / "mobile/android/app/src/main/res"
BG = (255, 255, 255, 255)
SPLASH_BG = (245, 247, 246, 255)

DENS = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}


def fit(img: Image.Image, box_w: int, box_h: int) -> Image.Image:
    s = min(box_w / img.width, box_h / img.height)
    return img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)


def centered(canvas_w: int, canvas_h: int, bg, logo_frac: float) -> Image.Image:
    c = Image.new("RGBA", (canvas_w, canvas_h), bg)
    lg = fit(LOGO, int(canvas_w * logo_frac), int(canvas_h * logo_frac))
    c.alpha_composite(lg, ((canvas_w - lg.width) // 2, (canvas_h - lg.height) // 2))
    return c


def rounded(img: Image.Image, radius_frac: float) -> Image.Image:
    from PIL import ImageDraw
    m = Image.new("L", img.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, img.width - 1, img.height - 1), radius=int(img.width * radius_frac), fill=255)
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.paste(img, (0, 0), m)
    return out


for d, k in DENS.items():
    folder = RES / f"mipmap-{d}"
    folder.mkdir(parents=True, exist_ok=True)
    legacy = int(48 * k)
    rounded(centered(legacy, legacy, BG, 0.72), 0.22).save(folder / "ic_launcher.png")
    circ = centered(legacy, legacy, BG, 0.66)
    rounded(circ, 0.5).save(folder / "ic_launcher_round.png")
    fg = int(108 * k)  # adaptive icon: 108dp canvas, keep the logo inside the 66dp safe zone
    centered(fg, fg, (0, 0, 0, 0), 0.56).save(folder / "ic_launcher_foreground.png")

# Splash screens Capacitor generated (portrait/landscape per density): same size, Salam logo centred.
count = 0
for p in RES.glob("drawable*/splash.png"):
    w, h = Image.open(p).size
    centered(w, h, SPLASH_BG, 0.28 if w < h else 0.22).convert("RGB").save(p)
    count += 1

(RES / "values/ic_launcher_background.xml").write_text(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#FFFFFF</color>\n</resources>\n', encoding="utf-8")
print(f"icons: {len(DENS)} densities, splash: {count} files")

"""Generate the Google Play feature graphic (1024x500) for SkinScript."""
from PIL import Image, ImageDraw, ImageFont
import os

W, H = 1024, 500
BRAND = (44, 62, 63)      # #2c3e3f
GOLD = (176, 134, 43)     # #b0862b (readable gold on light)
GRAY = (91, 102, 112)     # #5b6670
ROOT = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(ROOT)

def font(size, bold=True):
    candidates = ([
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial Black.ttf",
    ] if bold else [
        "/System/Library/Fonts/Supplemental/Arial.ttf",
    ]) + ["/System/Library/Fonts/HelveticaNeue.ttc"]
    for p in candidates:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()

# ── Background: subtle light vertical gradient ──
top, bot = (247, 248, 248), (233, 239, 239)
bg = Image.new("RGB", (1, H))
for y in range(H):
    t = y / (H - 1)
    bg.putpixel((0, y), tuple(round(top[i] + (bot[i] - top[i]) * t) for i in range(3)))
img = bg.resize((W, H))
d = ImageDraw.Draw(img)

# ── Logo (left), with a soft shadow ──
logo = Image.open(os.path.join(APP, "public", "pwa-512.png")).convert("RGBA")
LS = 360
logo = logo.resize((LS, LS), Image.LANCZOS)
lx, ly = 72, (H - LS) // 2
# soft shadow
shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
sd = ImageDraw.Draw(shadow)
sd.ellipse([lx + 20, ly + 28, lx + LS + 20, ly + LS + 28], fill=(30, 40, 41, 70))
try:
    from PIL import ImageFilter
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
except Exception:
    pass
img.paste(shadow, (0, 0), shadow)
img.paste(logo, (lx, ly), logo)

# ── Text block (right) ──
tx = 476
avail = W - tx - 44  # keep a right margin so nothing clips

title = "SkinScript"
sub = "Dermatology Board Prep"
cap = "12,000+ MCQs · 6 exam banks · mock exams"

def fit(s, start, bold, maxw):
    """Largest font size <= start whose text width fits maxw."""
    for size in range(start, 12, -1):
        f = font(size, bold=bold)
        b = d.textbbox((0, 0), s, font=f)
        if (b[2] - b[0]) <= maxw:
            return f
    return font(12, bold=bold)

title_f = fit(title, 84, True, avail)
sub_f = fit(sub, 38, True, avail)
cap_f = fit(cap, 27, False, avail)

def th(f, s):
    b = d.textbbox((0, 0), s, font=f)
    return b[3] - b[1], b[1]

h1, o1 = th(title_f, title)
h2, o2 = th(sub_f, sub)
h3, o3 = th(cap_f, cap)
gap1, gap2 = 22, 20
block = h1 + gap1 + h2 + gap2 + h3
y = (H - block) // 2

d.text((tx, y - o1), title, font=title_f, fill=BRAND)
# gold accent bar under the title
d.rounded_rectangle([tx + 3, y + h1 + 2, tx + 150, y + h1 + 9], radius=4, fill=GOLD)
y2 = y + h1 + gap1
d.text((tx, y2 - o2), sub, font=sub_f, fill=GOLD)
y3 = y2 + h2 + gap2
d.text((tx, y3 - o3), cap, font=cap_f, fill=GRAY)

out = os.path.join(ROOT, "feature-graphic-1024x500.png")
img.save(out, "PNG")
print("wrote", out, img.size)

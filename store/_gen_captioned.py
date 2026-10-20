"""Add marketing captions to the clean App Store screenshots (1320x2868)."""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

W, H = 1320, 2868
BRAND = (44, 62, 63)
GOLD = (201, 168, 76)
WHITE = (255, 255, 255)
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "appstore")

CAPTIONS = {
    "appstore-6.9-01-home.png":        ("captioned-6.9-01-home.png",        "6 board banks · 12,000+ questions"),
    "appstore-6.9-02-modes.png":       ("captioned-6.9-02-modes.png",       "Study your way: tutor, timed, mock exams"),
    "appstore-6.9-03-question.png":    ("captioned-6.9-03-question.png",    "Thousands of exam-style MCQs"),
    "appstore-6.9-04-explanation.png": ("captioned-6.9-04-explanation.png", "Clear explanations + an AI tutor"),
}

def font(size):
    for p in ["/System/Library/Fonts/Supplemental/Arial Bold.ttf",
              "/System/Library/Fonts/HelveticaNeue.ttc"]:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()

def wrap(draw, text, fnt, maxw):
    lines, cur = [], ""
    for w in text.split():
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=fnt) <= maxw:
            cur = t
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines

for src, (dst, cap) in CAPTIONS.items():
    shot = Image.open(os.path.join(D, src)).convert("RGB")
    canvas = Image.new("RGB", (W, H), BRAND)
    draw = ImageDraw.Draw(canvas)

    # ── caption (top band) ──
    fnt = font(70)
    maxw = W - 150
    lines = wrap(draw, cap, fnt, maxw)
    while len(lines) > 2 and fnt.size > 44:
        fnt = font(fnt.size - 4)
        lines = wrap(draw, cap, fnt, maxw)
    line_h = fnt.size + 16
    block = line_h * len(lines)
    top_band = 440
    y = max(60, (top_band - block) // 2)
    for ln in lines:
        w = draw.textlength(ln, font=fnt)
        draw.text(((W - w) // 2, y), ln, font=fnt, fill=WHITE)
        y += line_h
    draw.rounded_rectangle([(W - 130) // 2, y + 8, (W + 130) // 2, y + 17], radius=5, fill=GOLD)

    # ── framed screenshot below, aspect preserved ──
    ratio = shot.height / shot.width
    sx_margin = 100
    sw = W - 2 * sx_margin
    sh = round(sw * ratio)
    avail_h = H - top_band - 60
    if sh > avail_h:
        sh = avail_h
        sw = round(sh / ratio)
    shot_r = shot.resize((sw, sh), Image.LANCZOS)
    sx = (W - sw) // 2
    sy = top_band + 10
    radius = 56
    mask = Image.new("L", (sw, sh), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, sw, sh], radius=radius, fill=255)

    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle([sx, sy + 18, sx + sw, sy + sh + 18], radius=radius, fill=(0, 0, 0, 110))
    shadow = shadow.filter(ImageFilter.GaussianBlur(26))
    canvas.paste(shadow, (0, 0), shadow)
    canvas.paste(shot_r, (sx, sy), mask)

    canvas.save(os.path.join(D, dst), "PNG")
    print("wrote", dst, canvas.size)

"""Builds Lexa's App Store art from real app captures.

Outputs (in store-screenshots/final):
  iphone/NN.png   1206x2622  (6.3" iPhone, Apple's required size)
  ipad/NN.png     2064x2752  (13" iPad)
  header.png      3840x1646  (product page header)
  search.png      3840x2560  (search results asset)

Run: python3 store-screenshots/make_store_art.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent
FONTS = ROOT.parent / "apps/mobile/assets/fonts"
OUT = ROOT / "final"

CREAM = (250, 248, 243)
INK = (31, 30, 29)
ACCENT = (193, 95, 60)
ACCENT_DEEP = (150, 62, 34)
PILL_BG = (246, 222, 210)

# Real captures. iPhone shots are the 6.9" originals; iPad shots are 13".
SHOTS = [
    ("ask", "PLAIN-LANGUAGE ANSWERS", "Know your rights,\nin minutes."),
    ("document", "DOCUMENT READER", "Spot risky clauses\nbefore you sign."),
    ("home", "YOUR DAY", "Every deadline,\nin one place."),
    ("matter", "MATTERS", "Stay on top of\nevery next step."),
]
IPHONE_SRC = {"home": "01-home", "ask": "02-ask", "document": "03-document", "matter": "04-matter"}


def font(name, size):
    return ImageFont.truetype(str(FONTS / f"{name}.ttf"), size)


def glow_background(size, base, glow, centre, radius, blur):
    w, h = size
    bg = Image.new("RGB", size, base)
    mask = Image.new("L", size, 0)
    cx, cy = centre
    ImageDraw.Draw(mask).ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(blur))
    return Image.composite(Image.new("RGB", size, glow), bg, mask)


def rounded(img, r):
    m = Image.new("L", img.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, img.width - 1, img.height - 1), r, fill=255)
    out = img.convert("RGBA")
    out.putalpha(m)
    return out


def phone(screen_path, height):
    """An iPhone with a black bezel, titanium rim and side buttons."""
    s = Image.open(screen_path).convert("RGB")
    sw = round(s.width * height / s.height)
    s = s.resize((sw, height), Image.LANCZOS)
    bezel = round(height * 0.018)
    rim = max(3, round(height * 0.004))
    r_screen = round(sw * 0.13)
    w, h = sw + 2 * (bezel + rim), height + 2 * (bezel + rim)
    pad = round(height * 0.01)
    dev = Image.new("RGBA", (w + 2 * pad, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(dev)
    # side buttons
    bw = pad + rim
    for y0, y1 in [(0.20, 0.24), (0.29, 0.36), (0.38, 0.45)]:
        d.rounded_rectangle((pad - bw + rim, h * y0, pad + rim * 2, h * y1), bw, fill=(70, 68, 66, 255))
    d.rounded_rectangle((w + pad - rim * 2, h * 0.30, w + pad + bw - rim, h * 0.40), bw, fill=(70, 68, 66, 255))
    d.rounded_rectangle((pad, 0, pad + w - 1, h - 1), r_screen + bezel + rim, fill=(92, 90, 87, 255))
    d.rounded_rectangle((pad + rim, rim, pad + w - 1 - rim, h - 1 - rim), r_screen + bezel, fill=(12, 12, 12, 255))
    dev.alpha_composite(rounded(s, r_screen), (pad + rim + bezel, rim + bezel))
    return dev


def ipad(screen_path, width):
    s = Image.open(screen_path).convert("RGB")
    sh = round(s.height * width / s.width)
    s = s.resize((width, sh), Image.LANCZOS)
    bezel = round(width * 0.028)
    rim = max(3, round(width * 0.004))
    r = round(width * 0.035)
    w, h = width + 2 * (bezel + rim), sh + 2 * (bezel + rim)
    dev = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(dev)
    d.rounded_rectangle((0, 0, w - 1, h - 1), r + bezel + rim, fill=(92, 90, 87, 255))
    d.rounded_rectangle((rim, rim, w - 1 - rim, h - 1 - rim), r + bezel, fill=(12, 12, 12, 255))
    dev.alpha_composite(rounded(s, r), (rim + bezel, rim + bezel))
    return dev


def shadow_paste(canvas, dev, x, y, blur, opacity=0.30, offset=0.02):
    a = dev.split()[3].point(lambda v: int(v * opacity))
    sh = Image.new("RGBA", dev.size, (70, 30, 12, 255))
    sh.putalpha(a)
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    layer.alpha_composite(sh, (int(x), int(y + dev.height * offset)))
    canvas.alpha_composite(layer.filter(ImageFilter.GaussianBlur(blur)))
    canvas.alpha_composite(dev, (int(x), int(y)))


def pill(draw, cx, y, text, size):
    f = font("Inter-Bold", size)
    tw = draw.textlength(text, font=f)
    px, py = size * 0.75, size * 0.42
    box = (cx - tw / 2 - px, y, cx + tw / 2 + px, y + size + 2 * py)
    draw.rounded_rectangle(box, (box[3] - box[1]) / 2, fill=PILL_BG)
    draw.text((cx, y + py + size * 0.5), text, font=f, fill=ACCENT, anchor="mm")
    return box[3]


def headline(draw, cx, y, text, size, fill=INK, align="center", anchor="ma"):
    f = font("Inter-SemiBold", size)
    draw.multiline_text((cx, y), text, font=f, fill=fill, anchor=anchor, align=align, spacing=size * 0.16)


def screenshot(size, device, caption):
    w, h = size
    label, title = caption
    bg = glow_background(size, CREAM, (247, 226, 212), (w * 0.95, -h * 0.02), w * 0.55, w * 0.22)
    canvas = bg.convert("RGBA")
    d = ImageDraw.Draw(canvas)
    unit = w / 1206 if w < 1500 else w / 2064 * 1.15
    bottom = pill(d, w / 2, h * 0.05, label, round(30 * unit))
    headline(d, w / 2, bottom + 36 * unit, title, round(92 * unit))
    top = h - device.height - h * 0.045
    x = (w - device.width) / 2
    shadow_paste(canvas, device, x, top, 50 * unit)
    return canvas.convert("RGB")


def main():
    (OUT / "iphone").mkdir(parents=True, exist_ok=True)
    (OUT / "ipad").mkdir(parents=True, exist_ok=True)

    for i, (key, label, title) in enumerate(SHOTS, 1):
        dev = phone(ROOT / f"iphone-6.9/{IPHONE_SRC[key]}.png", 1880)
        screenshot((1206, 2622), dev, (label, title)).save(OUT / f"iphone/{i:02}-{key}.png", optimize=True)

        tab = ipad(ROOT / f"ipad-13/{IPHONE_SRC[key]}.png", 1400)
        screenshot((2064, 2752), tab, (label, title)).save(OUT / f"ipad/{i:02}-{key}.png", optimize=True)

    # Header: three phones on the brand colour, key content centred.
    W, H = 3840, 1646
    bg = glow_background((W, H), ACCENT_DEEP, (214, 120, 84), (W / 2, H * 0.55), 1150, 380)
    canvas = bg.convert("RGBA")
    ring = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(ring).ellipse((W / 2 - 700, H / 2 - 560, W / 2 + 700, H / 2 + 840), outline=(255, 255, 255, 34), width=6)
    canvas.alpha_composite(ring)
    left = phone(ROOT / "iphone-6.9/02-ask.png", 1300)
    right = phone(ROOT / "iphone-6.9/04-matter.png", 1300)
    centre = phone(ROOT / "iphone-6.9/03-document.png", 1560)
    shadow_paste(canvas, left, W / 2 - 1080 - left.width / 2, 300, 60, 0.45)
    shadow_paste(canvas, right, W / 2 + 1080 - right.width / 2, 300, 60, 0.45)
    shadow_paste(canvas, centre, W / 2 - centre.width / 2, 170, 70, 0.5)
    canvas.convert("RGB").save(OUT / "header.png", optimize=True)

    # Search results: headline left, two phones right, all inside the safe area.
    W, H = 3840, 2560
    bg = glow_background((W, H), ACCENT_DEEP, (214, 120, 84), (W * 0.68, H * 0.5), 1300, 420)
    canvas = bg.convert("RGBA")
    d = ImageDraw.Draw(canvas)
    f_pill = font("Inter-Bold", 54)
    text = "LEGAL HELP, IN PLAIN LANGUAGE"
    tw = d.textlength(text, font=f_pill)
    d.rounded_rectangle((330, 760, 330 + tw + 90, 760 + 108), 54, fill=(214, 128, 94))
    d.text((375, 814), text, font=f_pill, fill=(255, 255, 255), anchor="lm")
    headline(d, 330, 930, "Know your rights,\nin minutes.", 150, fill=(255, 255, 255), align="left", anchor="la")
    d.text((334, 1400), "Answers, document reviews and\ndeadlines for where you live.", font=font("Inter-Medium", 62), fill=(255, 236, 226), spacing=16)
    back = phone(ROOT / "iphone-6.9/03-document.png", 1900)
    front = phone(ROOT / "iphone-6.9/02-ask.png", 2080)
    shadow_paste(canvas, back, 3170 - back.width / 2, 330, 70, 0.45)
    shadow_paste(canvas, front, 2540 - front.width / 2, 260, 80, 0.5)
    canvas.convert("RGB").save(OUT / "search.png", optimize=True)


if __name__ == "__main__":
    main()

"""
Builds an Abu & Beyond dish roundel: clay ring, bone field, the dish name
curved along the top in Anton, "1722 M" at the foot, 01 markers either side,
and the ABU BEYOND tag.

The food illustration is generated; everything else is drawn here, because
31 AI-rendered dish names would include garbled ones and nobody would catch
them all. This way the type is exact and identical across the set.
"""
import math
import os
from PIL import Image, ImageDraw, ImageFont

SCRATCH = "/tmp/claude-0/-home-claude/3699c430-b8e4-5e93-9405-245f9a263db2/scratchpad"
ANTON = f"{SCRATCH}/fonts/Anton.ttf"

CLAY = (255, 77, 20)
BONE = (243, 239, 230)
INK = (20, 20, 20)
WHITE = (255, 255, 255)

SIZE = 1024          # working resolution, downsampled at the end
RING = 46            # ring thickness
PAD = 10             # transparent margin outside the ring


def _fit(draw, text, font_path, max_w, start, min_size=28):
    """Largest Anton size whose text fits max_w."""
    size = start
    while size > min_size:
        f = ImageFont.truetype(font_path, size)
        if draw.textlength(text, font=f) <= max_w:
            return f
        size -= 2
    return ImageFont.truetype(font_path, min_size)


def _arc_text(base, text, font, radius, centre, colour, top=True, spacing=1.0):
    """Draws text along a circle, one glyph at a time."""
    cx, cy = centre
    widths = [base.textlength(ch, font=font) if hasattr(base, "textlength") else 0 for ch in text]
    d = ImageDraw.Draw(Image.new("RGBA", (10, 10)))
    widths = [d.textlength(ch, font=font) for ch in text]
    total = sum(widths) * spacing
    # Angle the whole string subtends at the centre.
    sweep = total / radius
    angle = -math.pi / 2 - sweep / 2 if top else math.pi / 2 + sweep / 2

    for ch, w in zip(text, widths):
        step = (w * spacing) / radius
        a = angle + step / 2 if top else angle - step / 2
        glyph = Image.new("RGBA", (int(w) + 60, font.size + 60), (0, 0, 0, 0))
        ImageDraw.Draw(glyph).text((30, 30), ch, font=font, fill=colour)
        rot = -math.degrees(a) - 90 if top else -math.degrees(a) + 90
        glyph = glyph.rotate(rot, resample=Image.BICUBIC, expand=True)
        gx = cx + radius * math.cos(a) - glyph.width / 2
        gy = cy + radius * math.sin(a) - glyph.height / 2
        base.alpha_composite(glyph, (int(gx), int(gy)))
        angle = angle + step if top else angle - step


def roundel(name: str, food: Image.Image | None, out_path: str, out_size: int = 512):
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx = cy = SIZE / 2
    r_out = SIZE / 2 - PAD

    # Ring and field.
    d.ellipse([PAD, PAD, SIZE - PAD, SIZE - PAD], fill=CLAY)
    d.ellipse([PAD + RING, PAD + RING, SIZE - PAD - RING, SIZE - PAD - RING], fill=BONE)

    # The food, centred and slightly low to leave room for the name.
    if food is not None:
        # Scale to fill the box in both directions. thumbnail() only ever
        # shrinks, so a small generated cutout stayed postage-stamp sized in
        # the middle of the roundel.
        box = int(SIZE * 0.60)
        f = food.convert("RGBA")
        k = min(box / f.width, box / f.height)
        f = f.resize((max(1, int(f.width * k)), max(1, int(f.height * k))), Image.LANCZOS)
        img.alpha_composite(f, (int(cx - f.width / 2), int(cy - f.height / 2 + SIZE * 0.04)))

    # Dish name, curved along the top. Two lines would fight the circle, so
    # long names simply set smaller.
    label = name.upper()
    name_font = _fit(d, label, ANTON, SIZE * 1.02, 128, min_size=40)
    _arc_text(img, label, name_font, r_out - RING - name_font.size * 0.62, (cx, cy), INK, top=True)

    # Altitude at the foot — the same mark the rest of the brand carries.
    alt_font = ImageFont.truetype(ANTON, 50)
    alt = "1722 M"
    d.text((cx - d.textlength(alt, font=alt_font) / 2, SIZE - PAD - RING - 86), alt, font=alt_font, fill=INK)

    # 01 either side, at the waist.
    m_font = ImageFont.truetype(ANTON, 40)
    for side in (-1, 1):
        mx = cx + side * (r_out - RING - 48)
        d.text((mx - d.textlength("01", font=m_font) / 2, cy - 26), "01", font=m_font, fill=INK)

    # The clay tag, lower right of the illustration.
    tag_font = ImageFont.truetype(ANTON, 34)
    t1, t2 = "ABU", "BEYOND"
    tw = max(d.textlength(t1, font=tag_font), d.textlength(t2, font=tag_font)) + 34
    th = tag_font.size * 2 + 30
    tx, ty = cx + SIZE * 0.14, cy + SIZE * 0.17
    d.rounded_rectangle([tx, ty, tx + tw, ty + th], radius=14, fill=CLAY)
    for i, line in enumerate((t1, t2)):
        d.text((tx + tw / 2 - d.textlength(line, font=tag_font) / 2, ty + 11 + i * (tag_font.size + 4)),
               line, font=tag_font, fill=WHITE)

    img = img.resize((out_size, out_size), Image.LANCZOS)
    if os.path.dirname(out_path):
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
    img.save(out_path)
    return out_path


if __name__ == "__main__":
    roundel("Laffa Roll", None, f"{SCRATCH}/art/_frame-test.png")
    print("wrote frame test")

# Dish roundels

Per-dish menu art in the Abu & Beyond sticker style: clay ring, bone field,
the dish name curved in Anton, `1722 M` at the foot, the `01` marks and the
ABU BEYOND tag.

## Why it is split in two

The food is generated; **everything else is drawn here**. One AI pass that
also renders the dish name would garble some of thirty-one — "Falafel Hummus
Platter with Fresh Pita" is not a phrase a image model sets reliably — and a
garbled one would ship because nobody checks all thirty-one. Drawing the type
locally makes it exact and identical across the set, and it uses the real
Anton rather than something that looks like it.

Deliberately **illustration, not photography**. A photorealistic image of a
dish nobody cooked is a promise about what arrives in the box; a drawing
isn't. Real photos replace these as the kitchen shoots them.

## Running it

Anton is not vendored — fetch and convert it once:

```bash
npm pack @fontsource/anton && tar xzf fontsource-anton-*.tgz
pip install --break-system-packages fonttools brotli
python3 -c "
from fontTools.ttLib import TTFont
f = TTFont('package/files/anton-latin-400-normal.woff2'); f.flavor = None
f.save('fonts/Anton.ttf')"
```

Then, per dish: generate the illustration with no text on a plain flat
background, save it as `raw/<slug>.png`, and composite:

```python
from cutout import cutout
from roundel import roundel
roundel("Margherita Pizza", cutout("raw/margherita-pizza.png"),
        "../../public/brand/stickers/dishes/margherita-pizza.png")
```

Finally shrink — a 256px, 128-colour PNG is indistinguishable at the 72px the
menu renders it at, and about a third of the bytes:

```python
from PIL import Image
im = Image.open(path).convert("RGBA").resize((256, 256), Image.LANCZOS)
a = im.getchannel("A")
p = im.convert("RGB").quantize(colors=128, dither=Image.NONE).convert("RGBA")
p.putalpha(a); p.save(path, optimize=True)
```

Add the slug to `STICKER` in `src/components/store/menu-screen.tsx`. The
lookup already prefers a dish's own slug over its category, so a dish without
one keeps the category sticker and nothing looks half-finished.

## The generation prompt

Keep it identical but for the subject, or the set stops matching:

> A flat hand-drawn screen-printed illustration of **\<subject\>**. Bold
> confident black ink outlines, flat colour fill, slightly imperfect vintage
> sticker feel. Limited palette of orange-red, soft yellow, cream, muted
> green and black ink. Absolutely no text, no letters, no numbers, no logo,
> no border, no frame, no circle. Single centred object on a plain flat cream
> background. No photorealism, no gradients, no drop shadows.

## State

All 31 dishes in `db/seed/menu_items.csv` have one. A new dish needs a new
illustration, a composite and a line in `STICKER`; until it has one it falls
back to its category sticker, so the menu never looks half-finished.

# Brand update — 8 November 2026

**The logo changed. Every brand asset in the app must be replaced.**

Read this before touching any UI that shows the logo. If you have an older
copy of the brand kit, discard it — do not mix versions.

---

## What changed

1. **The ridge is now hand-drawn and lopsided.** It was two neat symmetrical
   triangles. It is now an irregular line with small wobbles and **one tall
   peak on the left** (Guru Shikhar, 1722 m). Everything right of the
   ampersand stays low. Never redraw it as triangles or a smooth curve.
2. **The ampersand is set in Jost Bold**, smaller than before, tilted 12°
   anticlockwise, sitting in the break in the ridge. Acid yellow on the clay
   patch; clay orange on the acid reverse.
3. **The patch is wider** — 1.4:1 (560 × 400 in the source), was close to
   square. Lockups sized for the old square patch will need re-fitting.
4. **The ink footer bar stays** — "THE GLOBAL KITCHEN" in bone across the base.

Nothing else moved. Colours, type, icons, voice and photography rules are
unchanged.

---

## What the app has to do

### Replace the PNGs in `public/brand/`

The app deliberately uses PNGs, not SVG, because the Anton lettering would
fall back to system fonts. That rule still holds. Pull fresh exports of:

```
patch-primary.png
patch-primary-tilted.png
patch-mono-white.png
patch-mono-ink-outline.png
patch-acid-reverse.png      (new — acid background, clay ampersand)
ampersand-seal-acid.png
ampersand-glyph-clay.png
wordmark-ink.png
favicon-16 / 32 / 48 / 64 / 180 / 192 / 512.png, favicon.ico
```

All of these are in the brand kit under `01-logo/png/` and
`01-logo/favicon/` at 1024 and 2048 px, transparent.

### Do **not** add Jost to the app

Jost Bold exists only inside the logo artwork. Because the logos ship as
PNGs, the app never needs to load Jost. Do not add it to the font stack, do
not use it for UI text. The app's fonts stay Anton (display) and Inter (UI).

### Check these spots for the wider patch

- Header lockup on the storefront
- Splash / welcome card (`components/store/welcome.tsx`)
- The first-visit leopard animation — the leopard pounces onto the patch and
  sits on top of it. The patch is wider and the ridge peak is now on the
  left, so the pounce landing point and the sit position need re-checking
  against the new artwork.
- Order confirmed header band
- Kitchen Display header
- Admin sidebar mark
- PWA manifest icons and the favicon set
- Any OG / share images with the logo baked in

### Minimum size went up

Patch is now **26 mm wide in print, 140 px on screen** (was smaller). Below
that use `ampersand-seal` or the A&B monogram. The footer type is what sets
the floor.

---

## Unchanged, for the avoidance of doubt

- All colour tokens in `ui-context.md` are correct and unchanged.
- Anton for display, Inter for UI — unchanged.
- The 28 brand icons are unchanged.
- Sticker sheet, leopard and bear character poses are unchanged.
- Voice lines and photography spec are unchanged.

---

## Source of truth

`abu-and-beyond-brand-kit/03-brand-brief/brand-brief.md` in this project,
locked 8 November 2026. Section 3 has the full logo rules. The vector
masters are in `abu-and-beyond-brand-kit/01-logo/svg/`.

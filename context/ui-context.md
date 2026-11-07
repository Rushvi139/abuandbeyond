# UI Context

Source of truth for brand: `brand/brand-brief.md` (locked Oct 2026). Never
redraw the logo; use the files in `public/brand/`.

## Theme

Loud, warm and direct — a global kitchen in the Aravalli hills, not fine
dining. Two surfaces:

- **Storefront** (customers, mobile-first): Bone paper background, Ink type,
  Hot clay for the call to action and the cart bar, Acid for small stickers
  and badges. Big Anton headlines, short cheeky lines from the brand voice.
  A night mode uses Night ink background, Bone type, Acid as the only bright.
- **Staff apps** (`/kitchen`, `/rider`, `/admin`): functional and dense.
  Kitchen Display is dark (Night ink) with huge type, readable from 2 m.
  Admin is light (Bone / white surfaces), Ink type, Clay only for primary
  actions.

Rule from the brief: one background colour, one type colour, one accent per
view. No gradients, no drop shadows on the logo, no cartoon illustration.

## Colors

All components use these tokens. No hardcoded hex in components.

| Role               | CSS Variable        | Value     |
| ------------------ | ------------------- | --------- |
| Page background    | `--bg-base`         | `#F3EFE6` (Bone) |
| Surface            | `--bg-surface`      | `#FFFFFF` |
| Dark background    | `--bg-night`        | `#10161C` (Night ink) |
| Primary text       | `--text-primary`    | `#141414` (Ink) |
| Muted text         | `--text-muted`      | `#5C5A55` |
| Reversed text      | `--text-reversed`   | `#F3EFE6` (Bone) |
| Primary accent     | `--accent-primary`  | `#FF4D14` (Hot clay) |
| Highlight          | `--accent-acid`     | `#FFD400` (Acid) |
| Place / hills      | `--accent-hill`     | `#1F3A33` (Hill green) |
| Kraft              | `--accent-kraft`    | `#D9C39C` |
| Border             | `--border-default`  | `#141414` at 12% |
| Error              | `--state-error`     | `#C0402A` (Clay red) |
| Success            | `--state-success`   | `#1F7A4D` |
| Veg marker         | `--veg`             | `#1F7A4D` |
| Non-veg marker     | `--nonveg`          | `#C0402A` |

Avoid: Hot clay type on Acid (or reverse), Hill green on Ink, Gold anywhere
in the app (hamper only).

## Typography

| Role       | Font                          | Variable         |
| ---------- | ----------------------------- | ---------------- |
| Headlines  | Anton (Google Fonts), all caps, tight tracking, max 2 lines | `--font-display` |
| UI text    | Inter (stand-in for Helvetica Neue / Arial) | `--font-sans` |
| Numbers / KOT | Inter tabular figures      | `--font-sans`    |

No italics, no light weights, no serif. Small label lines may be caps with
wide tracking.

## Border Radius

| Context           | Class        |
| ----------------- | ------------ |
| Inline / small UI | `rounded-md` |
| Cards / panels    | `rounded-xl` |
| Modals / sheets   | `rounded-2xl` |
| Stickers / chips  | `rounded-full` |

## Component Library

shadcn/ui on top of Tailwind. Components live in `src/components/ui/`
(generated, protected). App components in `src/components/<area>/`.

## Design source

The canvas "Abu & Beyond — Order App Screens"
(https://claude.ai/artifact/PEHFrxiae7wzud6DM8cvTi) holds the
approved screens: Menu, Item options sheet, Checkout, Order confirmed,
WhatsApp messages, Reviews wall, Review + share. Match it.

## Layout Patterns

- Storefront: single column, max-w-md centred on desktop; sticky category
  tabs at top; sticky Hot clay cart bar at bottom.
- Item card: name, veg/non-veg marker, cuisine sticker chip
  (ABU & ITALY etc.), price, add button.
- Checkout: one scrolling page (cart, delivery form, bill) with a sticky Pay button; no separate cart page.
- Order confirmed: Clay header band with Anton "ORDER #1042 IS IN.", vertical
  status stepper (done = green check, current = clay dot with acid ring).
- Reviews wall: Night ink background, Acid accents, 3-column media grid
  (9:13 tiles, play badge on videos), review cards, sticky Acid CTA.
- Review form: big star buttons (56 px), tag chips, upload tile, consent
  checkbox, sticky Clay submit.
- Kitchen Display: full-screen dark grid of KOT cards, oldest first; card
  header colour by age (normal / 10 min amber / 20 min Clay red).
- Admin: left sidebar nav, top bar, content area with tables and filters.

## Food photos

Each menu item has an optional photo (`menu_items.image_path`). With a photo
the card shows it (1:1 on the list, 4:3 hero in the options sheet); without
one it falls back to the coloured cuisine-sticker tile in the designs.
Photoshoot spec: 1:1 square, at least 1200 × 1200 px, the brand's "drop"
style (food falling into the box, straight-on camera, one hard light, plain
brand-colour backdrop, no props, no faces). Serve as WebP via Next/Image.

## Icons

Lucide React for UI (stroke icons, `h-4 w-4` inline, `h-5 w-5` buttons).
Brand icons (bhalu, leopard, paw, ridge, Guru Shikhar, food icons) are in
`public/brand/icons/` and used only as decoration on the storefront.

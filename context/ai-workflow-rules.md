# AI Workflow Rules

## Approach

Build this project incrementally using a spec-driven workflow. The files in
`context/` define what to build (`project-overview.md`), how it is built
(`architecture.md`, `code-standards.md`, `ui-context.md`) and where we are
(`progress-tracker.md`). Always implement against these specs — do not infer
or invent behaviour from scratch. Start every session by reading
`progress-tracker.md`.

## Scoping Rules

- Work on one feature unit at a time (one row of "Next Up").
- Prefer small, verifiable increments over large speculative changes.
- Do not combine unrelated system boundaries in a single implementation step.

## When to Split Work

Split an implementation step if it combines:

- Customer-facing UI and staff/admin UI
- Payments (Razorpay) and messaging (WhatsApp) changes
- A schema migration and the features that use it (migrate first, then build)
- Behaviour not clearly defined in the context files

If a change cannot be verified end to end quickly, the scope is too broad —
split it.

## Handling Missing Requirements

- Do not invent product behaviour not defined in the context files.
- If a requirement is ambiguous, resolve it in the relevant context file
  before implementing.
- If a requirement is missing, add it as an open question in
  `progress-tracker.md` before continuing.
- Prices, recipes and margins come from `supabase/seed/`; do not make up menu
  data.

## Protected Files

Do not modify the following unless explicitly instructed:

- `src/components/ui/*` — generated shadcn/ui components
- `src/lib/db/types.ts` — generated Supabase types
- Applied files in `supabase/migrations/` (add a new migration instead)
- `public/brand/*` — locked logo and brand assets (never redraw the logo)
- `brand/brand-brief.md`

## Secrets and Money

- Never commit `.env*` files with real values; only `.env.example`.
- Use Razorpay **test mode** keys until the owner says go live.
- Never print, log or echo secret values.
- Any change that can charge, refund or message a real customer needs the
  owner's explicit go-ahead.

## Keeping Docs in Sync

Update the relevant context file whenever implementation changes:

- System architecture or boundaries → `architecture.md`
- Storage model / schema decisions → `architecture.md` + a migration
- Code conventions or standards → `code-standards.md`
- Feature scope → `project-overview.md`
- UI tokens or patterns → `ui-context.md`

## Before Moving to the Next Unit

1. The current unit works end to end within its defined scope
2. No invariant defined in `architecture.md` was violated
3. `progress-tracker.md` reflects the completed work
4. `npm run build`, `npm run lint` and `npm test` pass

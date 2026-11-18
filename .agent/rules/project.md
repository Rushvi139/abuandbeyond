# Abu & Beyond — read before any work

This repo's working rules live in `CLAUDE.md` at the root. Read it first, every
session, and follow it exactly — especially the Hard rules (payments only via
`settleOrder`/`markPaid`, order status only via `transition.ts`, stock only via
`stock_movements`, money in integer paise, never commit secrets).

Then read, in order:
1. `context/progress-tracker.md` — what's done, what's next, open questions
2. `context/ai-workflow-rules.md`
3. `context/project-overview.md`
4. `context/architecture.md`
5. `context/code-standards.md`
6. `context/ui-context.md`

Before calling a unit done: `npm run build`, `npm run lint`, `npm test` pass,
update `context/progress-tracker.md`, then commit.

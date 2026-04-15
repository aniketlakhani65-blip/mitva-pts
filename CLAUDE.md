# Mitva PTS — Guidance for Claude Code

This is a Next.js 14 (App Router) production-tracking system for a jewellery
manufacturer. Real karigars and sales staff will use it daily. Correctness and
data integrity matter more than velocity.

## Project shape

- **Framework:** Next.js 14 App Router, React Server Components, Server Actions
- **Language:** TypeScript (strict)
- **DB / ORM:** Prisma → PostgreSQL (SQLite in dev is fine)
- **Auth:** NextAuth v4, Credentials provider, JWT sessions
- **Styling:** Tailwind with a custom `brand` palette
- **Validation:** Zod — schemas live next to the server action that uses them

## Non-negotiable invariants

1. **StageHistory is append-only in spirit.** Every state change to an order
   must produce or close a `StageHistory` row inside a single Prisma
   `$transaction`, plus an `AuditLog` entry. Never mutate an order's stage
   without closing/opening StageHistory rows.
2. **Atomic transitions.** `createOrder`, `startStage`, `completeAndAdvance`,
   `sendToRework`, `holdStage`, `resumeStage` all run inside `$transaction`.
   Don't split them.
3. **Denormalised `Order.currentStageId`** must stay in sync with the open
   StageHistory row. If you add a new transition path, update both.
4. **Role gates.** Server actions check role via `getServerSession` and return
   an error rather than throwing for unauthorised users. Keep that pattern.
5. **`revalidatePath` after every mutation** so the dashboard + queues reflect
   reality immediately.

## Tests — keep them green

Playwright E2E lives in `tests/`. Critical flows covered:
- `login.spec.ts` — auth gate
- `create-order.spec.ts` — order wizard end-to-end + validation
- `stage-transition.spec.ts` — mobile start → complete & advance (Pixel 7)
- `dashboard.spec.ts` — KPI + by-stage grid smoke

### Rules for Claude Code

- **Run `npm run test` after any change** that touches a route, server action,
  schema, or component named in those specs. Don't declare a feature done
  until tests pass.
- **Never weaken a failing test to make it pass.** If a test fails, either
  the code is wrong or the test is genuinely out of date — fix the real
  cause. Changing `expect(...).toBeVisible()` to `.not.toBeVisible()` or
  deleting an assertion is not an acceptable fix.
- **If you rename UI text** (button labels, headings, toast messages), update
  the matching `getByRole`/`getByText` queries in the specs in the same
  change. The specs use case-insensitive regex on purpose — prefer loosening
  a query over rewriting test logic.
- **When you add a new critical flow**, add one or two specs for it. "Critical"
  = any write path users depend on (new stage actions, dispatch, rework
  targets, payments).
- **Seed state assumptions.** Tests assume the seed has been run and
  `admin@mitva.local / admin123` exists, along with at least one customer and
  one karigar per department. If you change the seed, update tests that
  depend on those invariants.
- **Server actions mutate shared state.** `playwright.config.ts` runs serially
  (`fullyParallel: false`, `workers: 1`) on purpose. Don't flip these to
  "speed things up".

## Conventions

- Zod schemas: one file per feature, co-located with the action
  (`feature/schema.ts` + `feature/actions.ts`)
- Server actions return `{ ok: true, ... }` or `{ ok: false, error, fieldErrors? }`
- Decimal fields: always round/quantize before writing — never store raw
  user-entered strings
- Job numbers: format `YYMM-NNNN`, generated via `nextJobNo()` inside the
  same transaction that creates the order
- Mobile-first screens (`/stage-update/*`) use large touch targets; don't
  regress these to desktop-style forms

## When in doubt

Prefer reading `schema.prisma` and the existing server actions in
`src/app/orders/new/actions.ts` and `src/app/stage-update/[orderId]/actions.ts`
to infer the pattern before inventing a new one.

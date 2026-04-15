# Prisma Schema — Jewellery Production Tracking System

## Quick start

```bash
# 1. Install dependencies
npm install prisma @prisma/client bcryptjs
npm install -D ts-node typescript @types/node @types/bcryptjs

# 2. Set DATABASE_URL in .env
# For Postgres:
#   DATABASE_URL="postgresql://user:pass@localhost:5432/mitva"
# For local SQLite (also change provider in schema.prisma to "sqlite"):
#   DATABASE_URL="file:./dev.db"

# 3. Add to package.json
#   "prisma": { "seed": "ts-node prisma/seed.ts" }

# 4. Create and apply migration
npx prisma migrate dev --name init

# 5. Seed
npx prisma db seed

# 6. Open Studio to browse data
npx prisma studio
```

## Login credentials (seed data)

| Role | Email | Password |
|------|-------|----------|
| Admin / Owner | admin@mitva.local | admin123 |
| Sales | sales@mitva.local | sales123 |
| Department Head | production@mitva.local | prod123 |
| QC | qc@mitva.local | qc123 |

**Change these before production deployment.**

## What the seed creates

- 4 users (one per key role)
- 11 manufacturing stages (Booking → Dispatch)
- 9 karigars across departments
- 4 customers (wholesale, retail, end-customer)
- 4 orders showcasing different lifecycle states:
  - `2604-0001` — active, currently in Final Polish
  - `2604-0002` — rush order, just entered CAD
  - `2603-0087` — fully dispatched
  - `2603-0095` — VIP, **overdue**, stuck in Setting

## Notes on the schema design

- **StageHistory is the backbone.** Every stage transition creates a row — this gives you audit trail, aging reports, karigar productivity, and metal loss per stage "for free" from a single table.
- **`Order.currentStageId`** is denormalised for fast dashboard queries. Keep it in sync when closing/opening a stage (wrap in a transaction).
- **Stones are stored as JSON** (`OrderItem.stonesJson`, `StageHistory.stonesIssued/stonesReturned`). This keeps the schema simple for v1. If you need per-stone tracking later, promote to a proper `Stone` table.
- **Decimal types** use 3 decimals for weight (milligrams) and 2 for money.
- **Rework** is modelled as a self-referential FK on StageHistory (`reworkFromId`) — so you can ask "how many times has this order been reworked from Setting back to Filing?".
- **`publicSlug`** on Order drives the customer-facing tracking page — keep it secret-ish (cuid) and never expose internal IDs externally.

# Mitva PTS — Jewellery Production Tracking System

Next.js 14 (App Router) + Tailwind + Prisma + NextAuth (Credentials).

## Setup

```bash
# 1. Install deps
npm install

# 2. Copy env and edit values
cp .env.example .env
# Generate NEXTAUTH_SECRET:  openssl rand -base64 32
# Set DATABASE_URL to your Postgres (or SQLite for local dev — see prisma/README.md)

# 3. Apply migrations + seed
npx prisma migrate dev --name init
npm run db:seed

# 4. Run dev server
npm run dev
```

Open <http://localhost:3000> and sign in with `admin@mitva.local` / `admin123`.

## Project structure

```
.
├── prisma/
│   ├── schema.prisma      ← the schema (do NOT regenerate)
│   ├── seed.ts            ← demo data
│   └── README.md
├── src/
│   ├── app/
│   │   ├── api/auth/[...nextauth]/route.ts
│   │   ├── api/health/route.ts
│   │   ├── login/page.tsx
│   │   ├── layout.tsx
│   │   ├── providers.tsx
│   │   ├── page.tsx       ← dashboard
│   │   └── globals.css
│   ├── components/
│   │   └── SignOutButton.tsx
│   ├── lib/
│   │   ├── auth.ts        ← NextAuth config
│   │   └── prisma.ts      ← shared Prisma client
│   ├── types/next-auth.d.ts
│   └── middleware.ts      ← protects all routes except /login and /track/*
├── next.config.mjs
├── tailwind.config.ts
├── postcss.config.mjs
├── tsconfig.json
└── package.json
```

## What's wired up

- **Prisma client** — shared singleton at `src/lib/prisma.ts` (avoids hot-reload leaks).
- **NextAuth** — Credentials provider reading `User` table, JWT session, role on `session.user.role`.
- **Middleware** — everything behind auth except `/login`, `/track/*`, and `/api/auth/*`.
- **Dashboard** (`/`) — reads live stats via the Prisma client (live orders, overdue, dispatched, count per stage).
- **Health endpoint** — `/api/health` returns counts so you can verify the DB wiring.

## Build next

1. `/orders` — list & filter
2. `/orders/new` — order creation wizard
3. `/orders/[id]` — detail with stage timeline
4. `/stage-update/[orderId]` — mobile-first stage transition form (scan QR to land here)
5. `/track/[slug]` — public customer page (no auth)
6. Reports hub

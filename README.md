# 🍊 Flavourly OS

**WhatsApp-native customer retention & loyalty operating system for Southern African SMEs.**

*Fill your empty chairs. Turn walk-ins into regulars.*

Built for car washes, restaurants, barbers, salons, cafés, and retail stores — the one app every South African already has (WhatsApp) becomes a digital stamp card, predictive rewards engine, and automated marketing channel.

---

## ✨ Features

### Tenant (Business Owner) Dashboard
- **🏠 Dashboard** — Printable QR code (opens WhatsApp with `JOIN`), real-time activity feed, headline stats, WhatsApp connect banner
- **👥 Customers CRM** — Searchable table with churn-risk badges (🟢/🟡/🔴), loyalty ledger, manual point adjustments, filters (All/Active/At-Risk/VIP/New)
- **📣 Promos** — Goal-first campaign builder (Fill Quiet Hours / Bring Back Lost / Reward VIPs), template gallery with `{{customer_name}}` variables, Reality-Check ROI calculator, batched WhatsApp sends
- **📊 Insights** — Smart advisor with rule-based coaching (no charts, just plain-English advice), winning campaigns, needs-improvement analysis, weekly recommendations
- **⚙️ Settings** — Business profile, WhatsApp connection (Evolution API QR flow), PayFast subscription billing

### Customer-Facing (WhatsApp, no app download)
- Keyword handlers: `JOIN` / `BALANCE` / `REDEEM` / `STOP`
- Geo-claim rewards (location-unlocked, 500m Haversine check)
- Dynamic currency per industry (Points / Stamps / Washes / Visits / Cuts)

### Super Admin (Founder)
- **🎯 Prospect CRM** — CSV upload with column mapping, bulk WhatsApp invites, ghost tenant generation
- **📡 Platform Broadcasts** — Industry-filtered broadcasts to all active tenants
- **🔗 Webhook Events Log** — Real-time Evolution API event stream

---

## 🛠 Tech Stack

- **Framework:** Next.js 16 (App Router) + TypeScript 5
- **Styling:** Tailwind CSS 4 + shadcn/ui (New York)
- **Database:** Prisma ORM (SQLite for dev, Postgres/Supabase for production)
- **Auth:** NextAuth.js v4 (credentials provider, JWT sessions)
- **Realtime:** Socket.io mini-service (port 3033)
- **AI/Media:** z-ai-web-dev-sdk
- **Payments:** PayFast (sandbox-ready)
- **WhatsApp:** Evolution API

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ / Bun
- A Supabase project (for production) or just SQLite (for dev)

### Install & Run

```bash
# 1. Install dependencies
bun install

# 2. Copy env vars and fill in your values
cp .env.example .env
# Edit .env with your secrets

# 3. Set up the database
bun run db:push        # Create tables
bunx bun prisma/seed.ts      # Seed demo data (Mike's Car Wash + 40 customers)
bunx bun prisma/seed-auth.ts # Seed auth users (see demo credentials below)

# 4. Start the dev server
bun run dev
# App runs on http://localhost:3000

# 5. (Optional) Start the realtime WebSocket service
cd mini-services/realtime-service
bun install
bun run dev
# Realtime service runs on port 3033
```

### Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Tenant Owner (Mike's Car Wash) | `mike@mikescarwash.co.za` | `demo1234` |
| Super Admin (Founder) | `admin@flavourly.os` | `demo1234` |

---

## 📁 Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes (18 endpoints)
│   │   ├── auth/                 # NextAuth + signup
│   │   ├── tenant/               # Tenant profile
│   │   ├── customers/            # CRM
│   │   ├── campaigns/            # Promos
│   │   ├── insights/             # Smart advisor
│   │   ├── whatsapp/             # Evolution API connect/status
│   │   ├── webhooks/             # Evolution API receiver + simulator
│   │   ├── prospects/            # Super Admin prospect CRM
│   │   ├── broadcasts/           # Platform broadcasts
│   │   ├── claim/[token]/        # Public claim flow
│   │   ├── geo-claim/[id]/       # Geo-locked rewards
│   │   └── billing/              # PayFast checkout + ITN
│   ├── page.tsx                  # Main SPA (single user-visible route)
│   ├── layout.tsx                # Root layout (Inter font, providers)
│   ├── error.tsx                 # Route-level error boundary
│   └── loading.tsx               # Branded loading state
├── components/
│   ├── flavourly/
│   │   ├── shell.tsx             # Navbar + sidebar + footer
│   │   ├── primitives.tsx        # StatCard, StatusBadge, CoachAdviceBox, etc.
│   │   ├── error-boundary.tsx    # App-level error boundary
│   │   ├── realtime-activity-feed.tsx
│   │   ├── views/                # All dashboard views
│   │   └── overlays/             # Claim, geo-claim, auth, legal overlays
│   └── ui/                       # shadcn/ui components
├── lib/
│   ├── auth.ts                   # NextAuth config
│   ├── db.ts                     # Prisma client
│   ├── store.ts                  # Zustand view state
│   ├── tenant-context.ts         # Session-aware tenant resolution
│   ├── flavourly.ts              # Domain helpers (churn, haversine, etc.)
│   ├── middleware.ts             # Rate limiting + zod validation
│   └── validation.ts             # Zod schemas for all API inputs
└── types/
    └── next-auth.d.ts            # NextAuth type augmentation

mini-services/
└── realtime-service/             # Socket.io mini-service (port 3033)

prisma/
├── schema.prisma                 # Full database schema
├── seed.ts                       # Demo data seeder
└── seed-auth.ts                  # Auth user seeder
```

---

## 🔐 Security

- **Auth:** NextAuth credentials provider with bcrypt password hashing
- **Validation:** Zod schemas on every API input
- **Rate limiting:** Per-IP in-memory limiter (4 tiers: 10–120 req/min)
- **Data isolation:** Session-aware tenant resolution (each tenant sees only their data)
- **Error handling:** App + route-level error boundaries

---

## 📜 Legal

- **Privacy Policy** (POPIA-compliant) — accessible from the footer
- **Terms of Service** — accessible from the footer

> Both are boilerplate. Have them reviewed by a SA-qualified lawyer before go-live.

---

## 🇿🇦 Built for Southern African SMEs

POPIA compliant · Opt out any time with `STOP` · PayFast billing · WhatsApp-native

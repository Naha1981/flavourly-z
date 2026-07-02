# Task 2-c — Super Admin Views (prospects, broadcasts, webhooks)

**Agent:** full-stack-developer
**Scope:** Build three React client components for the dark-themed Super Admin area of Flavourly OS.

## Files Created
- `src/components/flavourly/views/admin-prospects.tsx` — Prospect CRM + 4-step Upload Leads wizard.
- `src/components/flavourly/views/admin-broadcasts.tsx` — Platform broadcast composer + history.
- `src/components/flavourly/views/admin-webhooks.tsx` — Real-time webhook events log.

## Notes for Downstream Agents
- All three components are `"use client"` named exports with no props. They fetch their own data via `/api/prospects`, `/api/broadcasts`, `/api/webhooks`.
- They rely on `useFlavourly().openPublic("claim", {token})` from `@/lib/store` to launch the claim overlay.
- Dark theme handled via semantic tokens (`bg-card`, `text-foreground`, `bg-background`, `bg-muted`, `text-muted-foreground`). Brand orange (`bg-brand text-white hover:bg-brand-dark`) used for primary CTAs.
- Custom inline status badges are used for prospect statuses and webhook event statuses/status, so we never accidentally use the `info`/blue tokens (per "NEVER indigo/blue" rule).
- Lint: 0 errors / 0 warnings in my three files. The 3 remaining lint errors are in `page.tsx`, `shell.tsx`, `dashboard-view.tsx` (out of scope — pre-existing, owned by Lead).
- Page currently 500s because downstream agents' modules (`settings-view`, `customers-view`, `promos-view`, `insights-view`, `claim-overlay`, `geo-claim-overlay`) don't exist yet. My files compile cleanly.

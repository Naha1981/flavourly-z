# Task 4-a — API hardening (zod validation + in-memory rate limiting)

Task ID: 4-a
Agent: full-stack-developer
Task: Add zod validation + rate limiting to all API routes (except auth/**, auth/signup, claim/[token]).

Work Log:
- Read /home/z/my-project/worklog.md to absorb the project spec (Next.js 16 + Prisma/SQLite + Tailwind v4 SPA, all API routes documented under Stage 0).
- Listed /home/z/my-project/src/app/api/ to enumerate every route file. Confirmed the 3 skip-listed files exist (auth/[...nextauth], auth/signup, claim/[token]).
- Created src/lib/middleware.ts:
  * rateLimit(req, opts?) — per-IP in-memory Map<string,{count,resetAt}>. Default windowMs=60_000 / max=60. Uses x-forwarded-for (first IP) → x-real-ip → "unknown". Returns null on pass, NextResponse 429 + Retry-After header on limit exceed. Cleans stale entries once Map exceeds 10k entries (lazy GC).
  * validateBody(body, schema) — zod safeParse wrapper returning discriminated union {success:true,data} | {success:false,error:NextResponse 400 with flatten() details}.
  * validateQuery(searchParams, schema) — same shape but converts URLSearchParams → Record<string,string> before parsing.
- Created src/lib/validation.ts with all spec schemas: tenantPatchSchema, customerCreateSchema, customerAdjustSchema, customersQuerySchema, campaignCreateSchema, whatsappConnectSchema, webhookSimulateSchema, prospectIngestSchema, prospectInviteSchema, broadcastCreateSchema, geoClaimVerifySchema, billingCheckoutSchema, billingItnSchema. Followed the spec exactly (enums, ranges, regex for brandColor/^#[0-9a-fA-F]{6}$/, refine for non-zero pointsChange).
- Modified every listed route additively — for each exported handler:
  1. Added imports: `import { rateLimit, validateBody } from "@/lib/middleware"` + relevant schemas from `@/lib/validation`.
  2. First line of every handler: `const limited = rateLimit(req, {...}); if (limited) return limited;`
  3. For POST/PATCH with JSON body: `const body = await req.json().catch(() => ({})); const parsed = validateBody(body, schema); if (!parsed.success) return parsed.error;` then referenced parsed.data.* downstream.
  4. For GET handlers with query params (only /api/customers was non-trivial): added validateQuery. Other GETs with simple integer `limit` params left as-is (lint-friendly, no schema needed).
- Rate-limit tier per spec:
  * GET routes: default 60/min (no opts)
  * POST/PATCH writes: 30/min (customers POST/PATCH, customer adjust, whatsapp status POST, webhooks simulate, prospects ingest, geo-claim demo)
  * Sensitive: 10/min (campaigns POST, campaigns/[id] POST, whatsapp/connect, prospects/invite, broadcasts POST, billing/checkout)
  * Public/external: 120/min (webhooks POST receiver, geo-claim/[id] GET+POST, billing/itn POST)
- Behaviour-preserving refactors:
  * tenant PATCH: validated body → built data map from allowed keys via parsed.data (renamed local to data0 to avoid clash with prisma `data`).
  * customers GET: replaced searchParams destructuring with validateQuery; preserved filter/sort/q branching exactly.
  * customers POST: parsed.data.phoneNumber → normalizeZAPhone; parsed.data.name trimmed.
  * customers/[id] PATCH: removed manual Number.isFinite(delta)||delta===0 guard (schema's int().refine(n=>n!==0) enforces both).
  * campaigns POST: removed manual title/message/audience guard (schema requires all three).
  * prospects POST: removed manual rows.length check (schema's .min(1) enforces); kept normalizeZAPhone + per-row try/catch. snake_case fallback removed (schema guarantees camelCase).
  * prospects/invite POST: removed manual prospectIds.length check (schema's .min(1) enforces).
  * broadcasts POST: removed manual messageTemplate.trim() check (schema requires min 1).
  * billing/checkout POST: removed manual PLANS[plan] existence check (schema enum enforces).
  * billing/itn POST: removed manual m_payment_id check (schema requires min 1).
  * geo-claim/[id] POST: removed manual Number.isFinite guard (schema enforces lat/lng numeric ranges).
  * webhooks POST receiver: only rate-limited; payload shape is intentionally loose (Evolution API variants) so no body schema applied.
- Skipped (per task rules): auth/[...nextauth]/route.ts, auth/signup/route.ts, claim/[token]/route.ts (lead agent editing concurrently).
- Verified via dev server (curl):
  * GET /api/tenant → 200, GET /api/customers → 200
  * POST /api/customers with empty body → 400 + zod fieldErrors (phoneNumber required)
  * 65× GET /api/stats → 60× 200 then 5× 429 (rate limit working)
  * POST /api/broadcasts valid → 200 (sent:2, total:2)
  * POST /api/broadcasts invalid industryFilter → 400 + zod enum error
  * POST /api/billing/checkout plan=enterprise → 400 + zod enum error
  * POST /api/geo-claim/:id lat=100 → 400 + zod "Too big: expected <=90" error
  * 12× POST /api/broadcasts (max:10) → 10× 400 (validation) then 2× 429 (rate limit applied per-request, even on invalid bodies, since rate check runs first)
- Ran `bun run lint` — exit 0, zero errors/warnings.

Stage Summary:
- Files created (exactly 2):
  * /home/z/my-project/src/lib/middleware.ts — rateLimit + validateBody + validateQuery helpers
  * /home/z/my-project/src/lib/validation.ts — 13 zod schemas covering every API input
- Files modified (19 route handlers across 17 files; auth/** + claim/[token] skipped):
  * src/app/api/tenant/route.ts (GET + PATCH)
  * src/app/api/customers/route.ts (GET + POST)
  * src/app/api/customers/[id]/route.ts (GET + PATCH)
  * src/app/api/campaigns/route.ts (GET + POST)
  * src/app/api/campaigns/[id]/route.ts (POST)
  * src/app/api/insights/route.ts (GET)
  * src/app/api/stats/route.ts (GET)
  * src/app/api/activity/route.ts (GET)
  * src/app/api/whatsapp/connect/route.ts (POST)
  * src/app/api/whatsapp/status/route.ts (GET + POST)
  * src/app/api/webhooks/route.ts (GET + POST)
  * src/app/api/webhooks/simulate/route.ts (POST)
  * src/app/api/prospects/route.ts (GET + POST)
  * src/app/api/prospects/invite/route.ts (POST)
  * src/app/api/broadcasts/route.ts (GET + POST)
  * src/app/api/geo-claim/[id]/route.ts (GET + POST)
  * src/app/api/geo-claim/demo/route.ts (POST)
  * src/app/api/billing/checkout/route.ts (POST)
  * src/app/api/billing/itn/route.ts (POST)
- Key decisions:
  * Rate limiter is per-IP (not per-IP+route) — simplest useful behaviour for single-instance deploys; documented Redis swap path in code comment.
  * Rate limit ALWAYS runs first, even for invalid bodies — so abuse via repeated 400s still gets throttled at the route's tier.
  * Sensitive routes (campaigns, broadcasts, invites, checkout, whatsapp connect) capped at 10/min — blocks brute-force / spam.
  * Public external-callback routes (webhooks receiver, geo-claim, billing/itn) bumped to 120/min so PayFast/Evolution API bursts don't get dropped.
  * Removed redundant manual input guards inside handlers where the zod schema enforces the same constraint (kept the tenant PATCH allowed-keys filter since that's a security-relevant allowlist, not a validation check).
  * No changes to: prisma schema, business logic, response shapes, frontend, page.tsx, shell, or any non-API file.
- No tests written. No new dependencies installed (zod@4.0.2 already in package.json).

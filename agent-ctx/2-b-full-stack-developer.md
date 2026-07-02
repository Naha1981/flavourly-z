# Task 2-b — Promos + Insights views

Agent: full-stack-developer
Task: Build Promos campaign builder + Insights smart advisor view

## Files created
- `/home/z/my-project/src/components/flavourly/views/promos-view.tsx` — `PromosView` ("use client")
- `/home/z/my-project/src/components/flavourly/views/insights-view.tsx` — `InsightsView` ("use client")

## What was built

### promos-view.tsx
Two-panel (lg:grid-cols-2) layout:
- LEFT: 3-step builder Card with horizontal brand-colored Stepper
  - Step 1 Goal: 3 big GoalCards (🪑 quiet_hours / 🔁 winback / 👑 vip) with exact spec border classes
  - Step 2 Message: 4 SA-flavored template radio cards per goal (16 total), editable Textarea, VAR_CHIPS row, live green preview (vars substituted: tenant.name + tenant.currencyName + "Sarah")
  - Step 3 Audience & Send: 4 audience radios with live counts (4 parallel GETs to /api/customers?filter=), RealityCheckRoi box (estimatedRevenue = round(audienceCount*0.25)*120), Back/Send buttons; POST /api/campaigns on send → toast.success → reset to step 1 + reload
  - Subscription guard (unclaimed/cancelled → disabled + "Upgrade to send campaigns"); WhatsApp-unconnected guard
- RIGHT: past-promos list, each Card left-bordered by performanceTier (green/amber/gray), tier badge, audience badge, timeAgo, message snippet, big redemptionCount + green "✅ Est. R{revenue} in sales" + rate pill, 🔁 Run Again (POST /api/campaigns/:id). Empty state. max-h-[36rem] scroll-area-thin.

### insights-view.tsx
Four stacked sections from GET /api/insights (NO charts):
- A: gradient hero (from-brand to-pink-500) with 3 inline stat tiles + title-attr tooltips + footer "Based on redemptions × R100"
- B: Winning Campaigns (top 3) — green-bordered cards, 🏆 Top badge, Run Again
- C: Needs Improvement — amber-bordered cards, 📉 Needs Work badge, CoachAdviceBox with onTryBetter → setTenantView("promos") + toast. Client-side guard skips >15% rate
- D: Smart Recommendations — 3-card grid (bg-brand-light border-brand/20), brand-orange CTAs → setTenantView("promos"). No blue/info classes.

## Lint status
Both files: ZERO errors/warnings. Remaining lint errors are in pre-existing files (shell.tsx, dashboard-view.tsx, admin-prospects.tsx) — out of scope.

## Key decisions
- Audience counts fetched in parallel (not estimated); "all" reconciled against tenant.customerCount to defeat API take:200 cap
- "Try Better Version" + recommendation CTAs use store setTenantView("promos") per spec preference
- Title derived from goal (GOALS[].titleDerived) — no extra title input, keeps flow tight
- Trial users send freely; only unclaimed/cancelled + unconnected WhatsApp are blocking

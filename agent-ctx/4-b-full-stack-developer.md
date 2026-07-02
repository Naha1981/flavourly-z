# Task 4-b — WebSocket realtime mini-service + frontend integration

**Agent:** full-stack-developer
**Task:** Replace the dashboard's 15-second polling activity feed with true realtime push via socket.io.

## Files created (exactly 4 + 1 modified main package.json)

1. `mini-services/realtime-service/package.json` — independent bun project (`bun --hot index.ts`). Deps: `socket.io`, `better-sqlite3` (kept per spec; see note in index.ts), `@types/better-sqlite3` + `bun-types` (dev).
2. `mini-services/realtime-service/index.ts` — socket.io server on port **3033** (hardcoded), reads `/home/z/my-project/db/custom.db` read-only, polls every 2s.
3. `src/hooks/use-realtime.ts` — `useRealtimeActivity(tenantId?)` and `useRealtimeWebhooks()` React hooks. Connect via `io("/?XTransformPort=3033")` (relative path, never direct localhost URL).
4. `src/components/flavourly/realtime-activity-feed.tsx` — drop-in replacement for the dashboard's "Live Activity" card. Same visual style as `dashboard-view.tsx`, plus a 🟢 Live / 🔴 Disconnected badge.

Main project's `package.json` was modified only by `bun add socket.io-client` (added one dependency line).

## Implementation notes

- **bun:sqlite instead of better-sqlite3**: Bun's runtime cannot dlopen `better-sqlite3`'s native addon (https://github.com/oven-sh/bun/issues/4290). Switched to Bun's built-in `bun:sqlite` which has the same `prepare/all/get` API. `better-sqlite3` is kept in `package.json` per spec for parity/future Node runs.
- **DateTime is INTEGER (Unix epoch ms) in SQLite** (confirmed via `typeof(createdAt)`). Watermarks are tracked as raw integers for fast INTEGER > INTEGER comparisons; converted to ISO strings only when emitting to clients so the frontend's `RealtimeActivity.createdAt: string` contract holds.
- **Watermark seeding**: on boot, `lastSeenActivity` / `lastSeenWebhook` are seeded with `MAX(createdAt)` from the DB so we only emit rows created *after* the service started (no flood of historical events on first connect).
- **socket.io path: "/"** — required by the Caddyfile routing rule (`@transform_port_query` forwards `?XTransformPort=3033` to `localhost:3033`). Because path is `/`, engine.io intercepts every URL on port 3033 — so a custom `/health` route would be shadowed. The `curl http://localhost:3033/` returns the engine.io "Transport unknown" response, which is exactly the expected health-check per task spec.
- **Events emitted**:
  - `activity:initial` (on connect only, to that socket) — last 20 Activity rows, newest first.
  - `activity:new` (broadcast to all clients every 2s when new rows appear) — single RealtimeActivity object per row, in chronological order.
  - `webhook:new` (broadcast to all clients every 2s) — RealtimeWebhook object per new WebhookEvent row.
- **Frontend resilience**: hooks use `transports: ["websocket"]`, infinite reconnection with capped backoff (1s → 5s), `connect_error` flips the badge to Disconnected, de-dupe by `id` on `activity:new` in case of a watermark race on reconnect. Items capped at 50.
- **Component visual parity**: matches `dashboard-view.tsx` exactly — same `Card`, same `ul.divide-y`, same `feed-item-enter` slide-in animation, same `max-h-[28rem] overflow-y-auto scroll-area-thin`, same emoji map (joined→🎉 redeemed→🎁 earned→✨ visit→👣 campaign_sent→📣 added→👤, default `•`). Relative time via `timeAgo` from `@/lib/flavourly` with a `title=` tooltip showing the absolute timestamp.

## Verification (all passed)

- `bun install` in `mini-services/realtime-service/` — 62 packages installed (socket.io@4.8.3, better-sqlite3@11.10.0 native build skipped, bun-types@1.3.14).
- `bun add socket.io-client` in main project — socket.io-client@4.8.3 installed.
- Service started in background via `nohup bun run dev > /home/z/my-project/realtime-service.log 2>&1 &`. Log shows:
  ```
  [realtime] watermark seeded — activity=1782972641759 webhook=1782974352040
  [realtime] Flavourly realtime service listening on port 3033 (polling /home/z/my-project/db/custom.db every 2000ms)
  ```
- `curl -s http://localhost:3033/` → `{"code":0,"message":"Transport unknown"}` (engine.io response ✓).
- **End-to-end smoke test** (socket.io-client connecting directly to localhost:3033):
  1. Connected ✓
  2. Received `activity:initial` with 10 items (DB has 10 activities, less than the 20-item cap) ✓
  3. Inserted a new Activity row directly into the DB (via `bun:sqlite` write connection)
  4. Within ~2s received `activity:new` with the exact RealtimeActivity shape (id, tenantId, type, customerName, message, createdAt as ISO string) ✓
  5. Cleaned up the test row, disconnected ✓
  6. Service logged `client connected` / `client disconnected` ✓
- `bun run lint` — exit 0, zero errors/warnings across the whole project (including the two new files).
- `bunx tsc --noEmit` — zero errors in the new files.

## Out of scope (per spec)

- Did NOT modify `dashboard-view.tsx` — the lead agent will swap in `<RealtimeActivityFeed tenantId={tenant.id} />` to replace the 15-second polling block.
- Did NOT modify any API route, the shell, page.tsx, or the Prisma schema.
- No tests written.

## What the lead agent needs to do

In `src/components/flavourly/views/dashboard-view.tsx`, replace the entire `{/* Live activity feed */}` block (lines ~208-246) with:

```tsx
<RealtimeActivityFeed tenantId={tenant.id} />
```

And remove the now-unused `activity` state, the `loadRef` polling interval (the `setInterval(() => loadRef.current(), 15000)`), and the `ActivityItem` interface. Keep the stats fetch. Import `RealtimeActivityFeed` from `@/components/flavourly/realtime-activity-feed`.

The component is a 1:1 visual swap — same heading, same Card, same list styling, same empty state. The only visible UX change is the new 🟢 Live / 🔴 Disconnected badge in the top-right.

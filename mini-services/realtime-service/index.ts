// Flavourly OS — Realtime mini-service
// Socket.IO server on port 3033 (hardcoded — NOT from env).
// Polls the shared SQLite database (read-only) every 2s for new Activity + WebhookEvent rows
// and pushes them to all connected dashboard clients, replacing the 15-second polling loop.
//
// NOTE on the SQLite driver:
//   The task spec lists `better-sqlite3` as a dependency and that's what's in package.json.
//   However, Bun's runtime cannot load `better-sqlite3`'s native addon
//   (https://github.com/oven-sh/bun/issues/4290). We use Bun's built-in `bun:sqlite`
//   instead — same prepared-statement API (prepare/all/get), no native build step.
//   `better-sqlite3` is kept in package.json per spec for parity/future Node.js runs.

import { createServer } from "http";
import { Server } from "socket.io";
import { Database } from "bun:sqlite";

// ─── Hardcoded configuration ────────────────────────────────────────────────
const PORT = 3033; // NEVER read this from env — the gateway + frontend depend on it.
const DB_PATH = "/home/z/my-project/db/custom.db";
const POLL_INTERVAL_MS = 2000;
const INITIAL_BATCH_SIZE = 20;

// ─── Database (read-only) ───────────────────────────────────────────────────
const db = new Database(DB_PATH, { readonly: true });

// Prisma stores DateTime as INTEGER (Unix epoch ms) under SQLite — confirmed by
// `typeof(createdAt)` returning "integer". We keep the raw numeric value for
// watermark comparisons (INTEGER > INTEGER is fast and unambiguous in SQLite)
// and convert to an ISO string only when emitting to clients so the frontend's
// `RealtimeActivity.createdAt: string` contract holds.
interface ActivityRow {
  id: string;
  tenantId: string;
  type: string;
  customerId: string | null;
  customerName: string | null;
  message: string;
  meta: string | null;
  createdAt: number;
}

interface WebhookRow {
  id: string;
  tenantId: string | null;
  instanceName: string;
  eventType: string;
  phoneNumber: string | null;
  messageContent: string | null;
  status: string;
  rawPayload: string;
  createdAt: number;
}

// Shape we push to clients — exactly matches src/hooks/use-realtime.ts → RealtimeActivity
interface RealtimeActivity {
  id: string;
  tenantId: string;
  type: string;
  customerName: string | null;
  message: string;
  createdAt: string;
}

interface RealtimeWebhook {
  id: string;
  tenantId: string | null;
  instanceName: string;
  eventType: string;
  phoneNumber: string | null;
  messageContent: string | null;
  status: string;
  createdAt: string;
}

function toRealtimeActivity(r: ActivityRow): RealtimeActivity {
  return {
    id: r.id,
    tenantId: r.tenantId,
    type: r.type,
    customerName: r.customerName,
    message: r.message,
    createdAt: new Date(r.createdAt).toISOString(),
  };
}

function toRealtimeWebhook(r: WebhookRow): RealtimeWebhook {
  return {
    id: r.id,
    tenantId: r.tenantId,
    instanceName: r.instanceName,
    eventType: r.eventType,
    phoneNumber: r.phoneNumber,
    messageContent: r.messageContent,
    status: r.status,
    createdAt: new Date(r.createdAt).toISOString(),
  };
}

// ─── Last-seen watermarks ───────────────────────────────────────────────────
// Seed from current DB max so we only emit rows created AFTER the service starts.
function seedWatermark(table: "Activity" | "WebhookEvent"): number {
  try {
    const row = db
      .query(`SELECT MAX(createdAt) AS maxCreatedAt FROM ${table}`)
      .get() as { maxCreatedAt: number | null } | null;
    return row?.maxCreatedAt ?? 0;
  } catch (err) {
    console.error(`[realtime] failed to seed watermark for ${table}:`, err);
    return 0;
  }
}

let lastSeenActivity = seedWatermark("Activity");
let lastSeenWebhook = seedWatermark("WebhookEvent");

console.log(
  `[realtime] watermark seeded — activity=${lastSeenActivity} webhook=${lastSeenWebhook}`
);

// ─── Prepared statements (polled every 2s) ──────────────────────────────────
const stmtInitialActivity = db.prepare(
  `SELECT id, tenantId, type, customerId, customerName, message, meta, createdAt
   FROM Activity
   ORDER BY createdAt DESC
   LIMIT ?`
);

const stmtNewActivity = db.prepare(
  `SELECT id, tenantId, type, customerId, customerName, message, meta, createdAt
   FROM Activity
   WHERE createdAt > ?
   ORDER BY createdAt ASC
   LIMIT 100`
);

const stmtNewWebhook = db.prepare(
  `SELECT id, tenantId, instanceName, eventType, phoneNumber, messageContent, status, rawPayload, createdAt
   FROM WebhookEvent
   WHERE createdAt > ?
   ORDER BY createdAt ASC
   LIMIT 100`
);

// ─── HTTP + Socket.IO server ────────────────────────────────────────────────
// We pass an empty httpServer to socket.io. Because `path: "/"` is set (required
// by the Caddy gateway so /?XTransformPort=3033 forwards correctly), socket.io's
// engine.io handler intercepts every URL — so a custom /health route would be
// shadowed. The engine.io response on `GET /` ("Transport unknown" or the
// handshake payload) is the de-facto health check (per task spec).
const httpServer = createServer();

const io = new Server(httpServer, {
  // Path MUST be "/" — the Caddy gateway forwards /?XTransformPort=3033 here.
  path: "/",
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  pingInterval: 25000,
  pingTimeout: 60000,
});

io.on("connection", (socket) => {
  console.log(
    `[realtime] client connected id=${socket.id} total=${io.engine.clientsCount}`
  );

  // Send the last 20 activity items immediately so the feed isn't empty on load.
  try {
    const rows = stmtInitialActivity.all(INITIAL_BATCH_SIZE) as ActivityRow[];
    socket.emit("activity:initial", rows.map(toRealtimeActivity));
  } catch (err) {
    console.error("[realtime] failed to send activity:initial:", err);
  }

  socket.on("disconnect", (reason) => {
    console.log(
      `[realtime] client disconnected id=${socket.id} reason=${reason} total=${io.engine.clientsCount}`
    );
  });

  socket.on("error", (err) => {
    console.error(`[realtime] socket error id=${socket.id}:`, err);
  });
});

// ─── Polling loop: every 2s push any new rows to ALL clients ─────────────────
const pollTimer = setInterval(() => {
  // Activity
  try {
    const newRows = stmtNewActivity.all(lastSeenActivity) as ActivityRow[];
    if (newRows.length > 0) {
      for (const row of newRows) {
        io.emit("activity:new", toRealtimeActivity(row));
      }
      // Advance watermark to the last row's createdAt (rows come back ASC).
      lastSeenActivity = newRows[newRows.length - 1].createdAt;
    }
  } catch (err) {
    console.error("[realtime] activity poll error:", err);
  }

  // WebhookEvent
  try {
    const newRows = stmtNewWebhook.all(lastSeenWebhook) as WebhookRow[];
    if (newRows.length > 0) {
      for (const row of newRows) {
        io.emit("webhook:new", toRealtimeWebhook(row));
      }
      lastSeenWebhook = newRows[newRows.length - 1].createdAt;
    }
  } catch (err) {
    console.error("[realtime] webhook poll error:", err);
  }
}, POLL_INTERVAL_MS);

// ─── Boot ────────────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(
    `[realtime] Flavourly realtime service listening on port ${PORT} (polling ${DB_PATH} every ${POLL_INTERVAL_MS}ms)`
  );
});

// ─── Graceful shutdown ───────────────────────────────────────────────────────
let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[realtime] received ${signal}, shutting down…`);
  clearInterval(pollTimer);
  io.close(() => {
    console.log("[realtime] socket.io server closed");
    try {
      db.close();
      console.log("[realtime] database closed");
    } catch (err) {
      console.error("[realtime] error closing database:", err);
    }
    httpServer.close(() => {
      console.log("[realtime] http server closed");
      process.exit(0);
    });
  });
  // Force-exit after 5s if graceful close hangs.
  setTimeout(() => {
    console.error("[realtime] forced exit after timeout");
    process.exit(1);
  }, 5000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

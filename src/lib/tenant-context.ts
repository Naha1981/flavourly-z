import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Session-aware tenant resolution:
// 1. If a NextAuth session exists → use the session's tenantId.
// 2. If no session (demo / preview mode) → fall back to the first connected
//    trial/active tenant (Mike's Car Wash in the seed). This keeps the demo
//    working without forcing login. In production, add middleware to enforce
//    authentication and remove the fallback.
export async function getActiveTenant() {
  // Try session first
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.tenantId) {
      const tenant = await db.tenant.findUnique({
        where: { id: session.user.tenantId },
      });
      if (tenant && tenant.subscriptionStatus !== "unclaimed") {
        return tenant;
      }
    }
  } catch {
    // Session not available (e.g. during build) — fall through to demo
  }

  // Dev fallback: first connected tenant
  const tenant = await db.tenant.findFirst({
    where: {
      subscriptionStatus: { in: ["trial", "active", "paused"] },
      whatsappInstanceId: { not: null },
    },
    orderBy: { createdAt: "asc" },
  });
  return tenant;
}

export async function getActiveTenantStrict() {
  const t = await getActiveTenant();
  if (!t) throw new Error("No active tenant found");
  return t;
}

// Returns the current session's role (for super_admin checks) or null.
export async function getCurrentRole(): Promise<string | null> {
  try {
    const session = await getServerSession(authOptions);
    return session?.user?.role ?? null;
  } catch {
    return null;
  }
}

// R100 conservative basket size for revenue estimates (per PRD F-I01)
export const REVENUE_PER_REDEMPTION = 100;

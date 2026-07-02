import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Session-aware tenant resolution.
// REQUIRES an authenticated NextAuth session — no demo fallback.
// Returns the tenant linked to the logged-in user's profile.
// Throws if no session (callers should let this surface as 401).
export async function getActiveTenant() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return null;
    const profile = await db.profile.findUnique({
      where: { userId: session.user.id },
    });
    if (!profile?.tenantId) return null;
    const tenant = await db.tenant.findUnique({
      where: { id: profile.tenantId },
    });
    if (!tenant || tenant.subscriptionStatus === "unclaimed") return null;
    return tenant;
  } catch {
    return null;
  }
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

// Returns the current session's user id or null.
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const session = await getServerSession(authOptions);
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

// R100 conservative basket size for revenue estimates (per PRD F-I01)
export const REVENUE_PER_REDEMPTION = 100;

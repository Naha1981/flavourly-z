import { NextResponse } from "next/server";

// GET /api/health — diagnostic endpoint to check env vars + DB connection
export async function GET() {
  const checks: Record<string, string> = {};

  // Check env vars (mask sensitive ones)
  checks.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET ? "✅ Set" : "❌ Missing";
  checks.NEXTAUTH_URL = process.env.NEXTAUTH_URL || "❌ Missing";
  checks.VERCEL_URL = process.env.VERCEL_URL || "❌ Missing";
  checks.DATABASE_URL = process.env.DATABASE_URL ? "✅ Set" : "❌ Missing";
  checks.DIRECT_URL = process.env.DIRECT_URL ? "✅ Set" : "❌ Missing";
  checks.EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || "❌ Missing";
  checks.APP_URL = process.env.APP_URL || "(auto-detect)";

  // Check DB connection
  try {
    const { db } = await import("@/lib/db");
    const userCount = await db.user.count();
    checks.DATABASE_CONNECTION = `✅ Connected (${userCount} users)`;
  } catch (err) {
    checks.DATABASE_CONNECTION = `❌ ${(err as Error).message.slice(0, 100)}`;
  }

  const allGood = !Object.values(checks).some((v) => v.startsWith("❌"));

  return NextResponse.json({
    status: allGood ? "healthy" : "issues",
    checks,
    timestamp: new Date().toISOString(),
  });
}

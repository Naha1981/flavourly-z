import { NextRequest, NextResponse } from "next/server";
import { ZodSchema } from "zod";

// ─── In-memory rate limiter (per-IP) ─────────────────────────────────────────
// NOTE: This is a single-process limiter. In production with multiple instances,
// swap for Redis-based limiting. For now, sufficient for single-instance deploys.
const ipHits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  req: NextRequest,
  opts?: { windowMs?: number; max?: number }
): NextResponse | null {
  const windowMs = opts?.windowMs ?? 60_000;
  const max = opts?.max ?? 60;
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip")?.trim() ??
    "unknown";
  const now = Date.now();
  const hit = ipHits.get(ip);
  if (!hit || hit.resetAt < now) {
    ipHits.set(ip, { count: 1, resetAt: now + windowMs });
    // Periodically clean stale entries
    if (ipHits.size > 10_000) {
      for (const [k, v] of ipHits) if (v.resetAt < now) ipHits.delete(k);
    }
    return null;
  }
  hit.count++;
  if (hit.count > max) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((hit.resetAt - now) / 1000)) },
      }
    );
  }
  return null;
}

// ─── Body validation ─────────────────────────────────────────────────────────
export function validateBody<T>(
  body: unknown,
  schema: ZodSchema<T>
):
  | { success: true; data: T }
  | { success: false; error: NextResponse } {
  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      success: false,
      error: NextResponse.json(
        { error: "Invalid input", details: result.error.flatten() },
        { status: 400 }
      ),
    };
  }
  return { success: true, data: result.data };
}

// ─── Query param validation ──────────────────────────────────────────────────
export function validateQuery<T>(
  params: URLSearchParams,
  schema: ZodSchema<T>
):
  | { success: true; data: T }
  | { success: false; error: NextResponse } {
  const obj: Record<string, string> = {};
  params.forEach((v, k) => {
    obj[k] = v;
  });
  const result = schema.safeParse(obj);
  if (!result.success) {
    return {
      success: false,
      error: NextResponse.json(
        { error: "Invalid query parameters", details: result.error.flatten() },
        { status: 400 }
      ),
    };
  }
  return { success: true, data: result.data };
}

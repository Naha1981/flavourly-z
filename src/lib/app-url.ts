/**
 * Resolves the public app URL for webhook callbacks, claim links, etc.
 *
 * On Vercel: uses VERCEL_URL env var (automatically set by Vercel).
 * Locally: uses APP_URL from .env (defaults to localhost:3000).
 */
export function getAppUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL.replace(/\/$/, "");
  }
  return "http://localhost:3000";
}

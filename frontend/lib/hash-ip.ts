import { createHash } from "crypto";

/**
 * Extract client IP from request headers (e.g. x-forwarded-for on Vercel)
 * or fallback. Returns a value suitable for hashing.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

/**
 * One-way hash of IP for fairness: one vote per IP per poll.
 * Uses SHA-256; only the hash is stored.
 */
export function hashIp(ip: string): string {
  return createHash("sha256").update(ip, "utf8").digest("hex");
}

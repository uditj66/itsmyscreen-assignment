/**
 * In-memory rate limiter: blocks same IP from voting again within a window.
 * Resets on server restart. For production at scale, use a shared store (e.g. Redis).
 */
const voteWindowMs = 5000;
const lastVoteByIp = new Map<string, number>();

export function checkVoteRateLimit(ipHash: string): { allowed: boolean } {
  const now = Date.now();
  const last = lastVoteByIp.get(ipHash);
  if (last != null && now - last < voteWindowMs) {
    return { allowed: false };
  }
  return { allowed: true };
}

export function recordVote(ipHash: string): void {
  lastVoteByIp.set(ipHash, Date.now());
}

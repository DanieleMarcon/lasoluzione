const rateLimitMap = new Map<string, number>();

export type CooldownInput = {
  key: string;
  cooldownMs?: number;
};

export function assertCooldownOrThrow({ key, cooldownMs = 90_000 }: CooldownInput): void {
  const normalizedKey = key.trim().toLowerCase();
  if (!normalizedKey) {
    return;
  }

  const now = Date.now();
  const lastAttempt = rateLimitMap.get(normalizedKey);

  if (typeof lastAttempt === 'number') {
    const elapsed = now - lastAttempt;
    if (elapsed < cooldownMs) {
      const remainingMs = cooldownMs - elapsed;
      const retryAfter = Math.max(1, Math.ceil(remainingMs / 1000));
      const error = new Error(`rate_limited:${retryAfter}`) as Error & {
        status: number;
        retryAfter: number;
      };
      error.status = 429;
      error.retryAfter = retryAfter;
      throw error;
    }
  }

  rateLimitMap.set(normalizedKey, now);
}

export function _resetRateLimitFor(key: string | null | undefined): void {
  if (!key) return;
  const normalizedKey = key.trim().toLowerCase();
  if (!normalizedKey) return;
  rateLimitMap.delete(normalizedKey);
}

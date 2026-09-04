/**
 * Tiny process-local TTL cache for admin Firestore aggregations.
 * Survives across requests in the same Node/serverless instance only —
 * enough to stop double-loading when navigating Dashboard → Events → etc.
 */

type Entry<T> = { value: T; expiresAt: number };

const store = new Map<string, Entry<unknown>>();

export function ttlGet<T>(key: string): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    store.delete(key);
    return null;
  }
  return hit.value as T;
}

export function ttlSet<T>(key: string, value: T, ttlMs: number): void {
  store.set(key, { value, expiresAt: Date.now() + Math.max(0, ttlMs) });
}

export function ttlDelete(key: string): void {
  store.delete(key);
}

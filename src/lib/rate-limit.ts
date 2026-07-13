/**
 * Limitatore di tentativi in memoria.
 * ATTENZIONE: lo stato vive nel singolo processo. In dev è esatto; su Vercel, con più
 * istanze serverless, un attaccante distribuito può aggirarlo. È una barriera contro il
 * brute-force banale, NON una difesa completa: per quella serve uno store condiviso
 * (Upstash/Redis) — da valutare quando il sito avrà traffico vero.
 */
const attempts = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 15 * 60 * 1000; // 15 minuti
const MAX_ATTEMPTS = 8;

/** true = tentativo consentito; false = troppi tentativi falliti, blocca. */
export function allowAttempt(key: string): boolean {
  const now = Date.now();
  const e = attempts.get(key);
  if (!e || now > e.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (e.count >= MAX_ATTEMPTS) return false;
  e.count++;
  return true;
}

/** Login riuscito: azzera il contatore. */
export function resetAttempts(key: string): void {
  attempts.delete(key);
}

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

/** Cosa stiamo limitando. Le chiavi le compone il modulo: nessun chiamante deve
 *  costruire stringhe a mano, o due punti del codice possono divergere in silenzio. */
export type Limited = "login" | "reset";

const keyOf = (kind: Limited, id: string) => `${kind}:${id}`;

/** true = tentativo consentito; false = troppi tentativi falliti, blocca. */
export function allowAttempt(kind: Limited, id: string): boolean {
  const now = Date.now();
  const key = keyOf(kind, id);
  const e = attempts.get(key);
  if (!e || now > e.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (e.count >= MAX_ATTEMPTS) return false;
  e.count++;
  return true;
}

/**
 * Quanti minuti mancano allo sblocco; 0 se non è bloccato. Non incrementa il contatore:
 * serve solo a dire la verità all'utente, che altrimenti si sentirebbe rispondere
 * "password sbagliata" mentre in realtà è in attesa.
 */
export function blockedForMinutes(kind: Limited, id: string): number {
  const e = attempts.get(keyOf(kind, id));
  if (!e || Date.now() > e.resetAt || e.count < MAX_ATTEMPTS) return 0;
  return Math.max(1, Math.ceil((e.resetAt - Date.now()) / 60_000));
}

/** Tentativo riuscito: azzera il contatore. */
export function resetAttempts(kind: Limited, id: string): void {
  attempts.delete(keyOf(kind, id));
}

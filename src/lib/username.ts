/**
 * Normalizzazione dell'username: una sola definizione.
 * Era ricopiata a mano in auth.ts e tre volte in auth-actions.ts. Se una copia
 * divergesse, la chiave con cui il limitatore CONTA i tentativi e quella con cui
 * li LEGGE smetterebbero di coincidere — e la protezione svanirebbe in silenzio,
 * senza un errore che lo segnali.
 */
export function normalizeUsername(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase();
}

import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt) as (
  password: string, salt: Buffer, keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

// scrypt (RFC 7914) dalla stdlib: nessuna dipendenza esterna.
// N=2^15 → ~100ms per hash su hardware tipico: abbastanza lento da rendere costoso il brute-force.
const PARAMS = { N: 32768, r: 8, p: 1 };
const KEYLEN = 64;

// scrypt richiede 128*N*r byte (qui ~33 MB) ma il default di Node è 32 MB: senza alzare
// maxmem esplicitamente, scrypt() lancia ERR_CRYPTO_INVALID_SCRYPT_PARAMS.
const maxmemFor = (N: number, r: number) => 256 * N * r;

/** Restituisce "scrypt$N$r$p$salt$hash" (hex): i parametri sono nell'hash, così potrai alzarli senza invalidare le password già salvate. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const { N, r, p } = PARAMS;
  const hash = await scryptAsync(password.normalize("NFKC"), salt, KEYLEN,
                                 { ...PARAMS, maxmem: maxmemFor(N, r) });
  return `scrypt$${N}$${r}$${p}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltHex, hashHex] = parts;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scryptAsync(password.normalize("NFKC"), salt, expected.length, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: maxmemFor(Number(n), Number(r)),
  });
  // confronto a tempo costante: non far trapelare quanto dell'hash combacia
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

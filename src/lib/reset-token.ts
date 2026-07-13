import { createHash, randomBytes } from "crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "@/db";
import { passwordResetTokens } from "@/db/schema";

const TTL_MS = 60 * 60 * 1000; // 1 ora

/** SHA-256 è sufficiente: il token è già 32 byte casuali, non una password indovinabile. */
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** Crea un token monouso. Restituisce il token IN CHIARO: esiste solo qui e nell'email. */
export async function createResetToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId)); // uno alla volta
  await db.insert(passwordResetTokens).values({
    tokenHash: hash(token),
    userId,
    expires: new Date(Date.now() + TTL_MS),
  });
  return token;
}

/** Restituisce lo userId se il token è valido e non scaduto, altrimenti null. */
export async function consumeResetToken(token: string): Promise<string | null> {
  const h = hash(token);
  const [row] = await db.select().from(passwordResetTokens)
    .where(and(eq(passwordResetTokens.tokenHash, h), gt(passwordResetTokens.expires, new Date())));
  if (!row) return null;
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, h)); // monouso
  return row.userId;
}

/** Verifica senza consumare: serve a mostrare il form solo se il link è ancora buono. */
export async function isResetTokenValid(token: string): Promise<boolean> {
  const [row] = await db.select({ userId: passwordResetTokens.userId }).from(passwordResetTokens)
    .where(and(eq(passwordResetTokens.tokenHash, hash(token)),
               gt(passwordResetTokens.expires, new Date())));
  return Boolean(row);
}

export async function purgeExpiredTokens(): Promise<void> {
  await db.delete(passwordResetTokens).where(lt(passwordResetTokens.expires, new Date()));
}

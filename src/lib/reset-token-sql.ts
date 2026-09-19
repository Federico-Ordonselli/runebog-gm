import { sql } from "drizzle-orm";

/** Un'unica DELETE decide chi vince: una lettura preventiva non è un lock. */
export const consumeResetTokenSql = (tokenHash: string) => sql`
  DELETE FROM password_reset_token
  WHERE token_hash = ${tokenHash} AND expires > CURRENT_TIMESTAMP
  RETURNING user_id AS "userId"`;

/** Consumo e cambio password nella stessa istruzione: un errore dell'UPDATE
 * annulla anche la DELETE, senza consumare un link che non ha cambiato nulla. */
export const resetPasswordSql = (tokenHash: string, passwordHash: string) => sql`
  WITH consumed AS (${consumeResetTokenSql(tokenHash)})
  UPDATE "user" SET password_hash = ${passwordHash}
  FROM consumed WHERE "user".id = consumed."userId"
  RETURNING "user".id`;

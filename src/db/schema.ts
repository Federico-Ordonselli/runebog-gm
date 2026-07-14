import { pgTable, text, timestamp, primaryKey, integer, jsonb, uuid } from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

/* ---- tabelle standard Auth.js ---- */
export const users = pgTable("user", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),          // nullable: chi entra con username/password può non darla
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  // account locali (username + password). Nulli per gli utenti Google.
  username: text("username").unique(),
  passwordHash: text("password_hash"),
});
export const accounts = pgTable("account", {
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").$type<AdapterAccountType>().notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("providerAccountId").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })]);
export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});
export const verificationTokens = pgTable("verificationToken", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
}, (t) => [primaryKey({ columns: [t.identifier, t.token] })]);

/* ---- recupero password ----
   Salviamo lo SHA-256 del token, mai il token in chiaro: se il DB trapela, i link di reset
   già emessi restano inutilizzabili. Il token vero esiste solo nell'email dell'utente. */
export const passwordResetTokens = pgTable("password_reset_token", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

/* ---- le campagne: un JSONB per campagna, stesso formato di Esporta/Importa ----
   shareToken: il link per il tavolo dei giocatori. Nullo = campagna non condivisa.
   Rigenerarlo invalida di colpo tutti i link già distribuiti. */
export const campaigns = pgTable("campaign", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("Nuova campagna"),
  data: jsonb("data").notNull(),
  shareToken: text("share_token").unique(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

import { pgTable, text, timestamp, primaryKey, integer, jsonb, uuid, index, customType } from "drizzle-orm/pg-core";
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
   Rigenerarlo invalida di colpo tutti i link già distribuiti.
   revision: contatore monotono, incrementato dalla PATCH. Non è un timestamp e non
   è un hash: serve a dire "la copia da cui sei partito è ancora quella corrente?",
   e a dirlo DENTRO la query che scrive (vedi PATCH in api/campaigns/[id]), sennò
   fra il controllo e la scrittura ci sta un'altra scheda. */
export const campaigns = pgTable("campaign", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("Nuova campagna"),
  data: jsonb("data").notNull(),
  shareToken: text("share_token").unique(),
  revision: integer("revision").notNull().default(0),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

/* ---- le immagini, fuori dal JSON della campagna (6 ago 2026) ----
 *
 * Finora stavano DENTRO `campaign.data`, in base64, quindi il documento se le
 * portava addosso ovunque andasse: nella PATCH, in `localStorage`, e dentro
 * l'HTML di ogni apertura di `/play/[id]`, che risponde `private, no-store` e
 * non può metterle in cache. Misurato il 31 lug 2026: sei battlemap riempiono
 * il tetto di 4 MB del documento.
 *
 * Restano in Neon e non in un deposito esterno perché **ci sono già**: qui non
 * si aggiunge un byte allo storage, semmai se ne toglie — il +33% del base64
 * in `bytea` non si paga. Il guadagno non è mai venuto da dove stanno i byte,
 * ma dal documento che smette di portarseli e dall'URL immutabile, cioè
 * memorizzabile in cache per sempre (vedi la rotta `/immagini/[chiave]`, che
 * sta fuori da `/api` apposta: l'invariante della copia offline esclude
 * `/play`, `/tavolo` e `/api` perché quelle risposte invecchiano, e una chiave
 * immutabile no).
 */
const bytea = customType<{ data: Buffer; notNull: true; default: false }>({
  dataType() { return "bytea"; },
});

export const campaignImages = pgTable("campaign_image", {
  /* La chiave è CASUALE, non un hash del contenuto. Il content-addressing
     deduplicherebbe, ma farebbe condividere lo stesso oggetto fra due utenti,
     e allora cancellare torna a essere un conteggio di riferimenti — cioè il
     confine "chi cancella" riaperto dal lato peggiore. Casuale tiene la
     proprietà 1:1 e rende la cascata qui sotto tutta la politica che serve.
     Un UUID è già 128 bit non indovinabili e sta dentro `[A-Za-z0-9-]`, che è
     ciò che la rotta e le tre whitelist di `safeUrl` devono ammettere. */
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  /* L'immagine appartiene a UNA campagna e muore con lei. La riga `user`
     cascata già sulle campagne per il diritto alla cancellazione (GDPR art.
     17): con questa seconda cascata un account cancellato non lascia in giro
     le sue mappe, che è la promessa che `deleteAccountAction` fa. */
  campaignId: uuid("campaign_id").notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  mime: text("mime").notNull(),
  bytes: bytea("bytes").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  /* Quando lo spazzino l'ha vista per la prima volta NON referenziata dal
     documento. Non si cancella un'immagine appena la sua bolla sparisce: gli
     snapshot di `undo` sono `JSON.stringify` dello stato e continuano a
     puntarci, quindi buttarla subito romperebbe proprio la funzione che serve
     a rimediare. Si segna qui, si butta a un passaggio successivo dopo il
     periodo di grazia, e si RIAZZERA se l'immagine torna referenziata — che è
     esattamente cosa succede quando qualcuno preme Ctrl+Z. */
  orphanSince: timestamp("orphan_since", { mode: "date" }),
}, (t) => [
  index("campaign_image_campaign_id_idx").on(t.campaignId),   // il diff dello spazzino, per campagna
  index("campaign_image_orphan_since_idx").on(t.orphanSince), // il passaggio che cancella
]);

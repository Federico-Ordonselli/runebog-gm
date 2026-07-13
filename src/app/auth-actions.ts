"use server";

import { AuthError } from "next-auth";
import { eq } from "drizzle-orm";
import { auth, signIn, signOut } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/password";
import { allowAttempt } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { consumeResetToken, createResetToken } from "@/lib/reset-token";

export type AuthState = { error?: string; notice?: string };

const USERNAME_RE = /^[a-z0-9_-]{3,32}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function signUpAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const email = String(form.get("email") ?? "").trim().toLowerCase();

  if (!USERNAME_RE.test(username))
    return { error: "Nome utente: da 3 a 32 caratteri, solo lettere, numeri, _ e -." };
  if (password.length < 8)
    return { error: "La password deve avere almeno 8 caratteri." };
  if (email && !EMAIL_RE.test(email))
    return { error: "L'email non sembra valida. Puoi anche lasciarla vuota." };

  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.username, username));
  if (taken) return { error: "Questo nome utente è già preso." };

  if (email) {
    const [dup] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (dup) return { error: "Questa email è già associata a un altro account." };
  }

  await db.insert(users).values({
    username,
    name: username,
    email: email || null,          // niente email = nessun recupero possibile: avvisato nel form
    passwordHash: await hashPassword(password),
  });

  // signIn lancia il redirect: deve propagarsi, non va catturato qui.
  await signIn("credentials", { username, password, redirectTo: "/" });
  return {};
}

/**
 * Cancellazione dell'account (diritto alla cancellazione, GDPR art. 17).
 * Elimina la riga `user`: le FK ON DELETE CASCADE portano via campagne, sessioni,
 * account OAuth collegati e token di reset. Non resta niente dell'utente.
 */
export async function deleteAccountAction(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;
  await db.delete(users).where(eq(users.id, session.user.id));
  await signOut({ redirectTo: "/" });
}

/**
 * Richiesta di recupero. Risponde SEMPRE con lo stesso messaggio, che l'account esista o no:
 * altrimenti questo form diventerebbe un modo per scoprire quali username sono registrati.
 */
export async function requestResetAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const generic = {
    notice: "Se l'account esiste e ha un'email associata, ti abbiamo inviato un link per reimpostare la password. Controlla la posta (e lo spam).",
  };
  if (!username) return { error: "Inserisci il tuo nome utente." };

  // Limita anche questo: senza freno è un modo per bombardare di email un utente.
  if (!allowAttempt(`reset:${username}`)) return generic;

  const [u] = await db.select().from(users).where(eq(users.username, username));
  if (!u?.email) return generic;              // niente account, o account senza email: stessa risposta

  const token = await createResetToken(u.id);
  const base = process.env.AUTH_URL ?? "http://localhost:3000";
  await sendEmail({
    to: u.email,
    subject: "Runebog GM — reimposta la password",
    text: `Ciao ${u.username},

hai chiesto di reimpostare la password di Runebog GM.
Apri questo link entro un'ora:

${base}/reset/${token}

Il link è valido una sola volta. Se non hai chiesto tu il reset, ignora questa email: la tua password resta quella di prima.`,
  });
  return generic;
}

/** Imposta la nuova password consumando il token monouso. */
export async function resetPasswordAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  if (password.length < 8) return { error: "La password deve avere almeno 8 caratteri." };

  const userId = await consumeResetToken(token);
  if (!userId) return { error: "Link scaduto o già usato. Richiedine uno nuovo." };

  await db.update(users)
    .set({ passwordHash: await hashPassword(password) })
    .where(eq(users.id, userId));

  return { notice: "Password aggiornata. Ora puoi accedere." };
}

export async function signInAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!username || !password) return { error: "Inserisci nome utente e password." };

  try {
    await signIn("credentials", { username, password, redirectTo: "/" });
  } catch (e) {
    // Messaggio volutamente generico: non riveliamo se l'username esiste.
    if (e instanceof AuthError) return { error: "Nome utente o password non corretti." };
    throw e;   // NEXT_REDIRECT: deve risalire
  }
  return {};
}

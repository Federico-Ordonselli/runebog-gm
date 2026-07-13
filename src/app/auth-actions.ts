"use server";

import { AuthError } from "next-auth";
import { eq } from "drizzle-orm";
import { signIn } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/password";

export type AuthState = { error?: string };

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

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, accounts, sessions, verificationTokens } from "@/db/schema";
import { verifyPassword } from "@/lib/password";
import { allowAttempt, resetAttempts } from "@/lib/rate-limit";
import { normalizeUsername } from "@/lib/username";

// Hash fittizio: lo verifichiamo anche quando l'utente non esiste, così il tempo di risposta
// resta lo stesso e non rivela quali username sono registrati.
const DUMMY_HASH = "scrypt$32768$8$1$" + "0".repeat(32) + "$" + "0".repeat(128);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  // JWT obbligatorio: il provider Credentials di Auth.js non supporta le sessioni su database.
  session: { strategy: "jwt" },
  providers: [
    Google,
    Credentials({
      name: "Username e password",
      credentials: {
        username: { label: "Nome utente", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        const username = normalizeUsername(creds?.username);
        const password = String(creds?.password ?? "");
        if (!username || !password) return null;

        if (!allowAttempt("login", username)) return null;   // troppi tentativi falliti

        const [u] = await db.select().from(users).where(eq(users.username, username));
        const ok = await verifyPassword(password, u?.passwordHash ?? DUMMY_HASH);
        if (!u?.passwordHash || !ok) return null;

        resetAttempts("login", username);
        return { id: u.id, name: u.name, email: u.email, image: u.image };
      },
    }),
  ],
  callbacks: {
    // Con la strategia JWT l'id dell'utente viaggia in token.sub (Auth.js lo popola da user.id).
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});

import { auth, signIn, signOut } from "@/auth";
import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

const DONATE_URL = "https://ko-fi.com/TUO_UTENTE"; // ← metti il tuo link Ko-fi / BuyMeACoffee / PayPal.me

export default async function Home() {
  const session = await auth();

  async function doSignIn() { "use server"; await signIn("google"); }
  async function doSignOut() { "use server"; await signOut(); }
  async function createCampaign() {
    "use server";
    const s = await auth();
    if (!s?.user?.id) return;
    const [row] = await db.insert(campaigns).values({
      userId: s.user.id,
      name: "Nuova campagna",
      data: { root: { id: "root", title: "Nuova campagna", type: "zona", status: "", notes: "",
                      img: null, children: [], edges: [], x: null, y: null, shape: null },
              checklist: [], players: [] },
    }).returning({ id: campaigns.id });
    redirect(`/play/${row.id}`);
  }

  const rows = session?.user?.id
    ? await db.select({ id: campaigns.id, name: campaigns.name, updatedAt: campaigns.updatedAt })
        .from(campaigns).where(eq(campaigns.userId, session.user.id)).orderBy(desc(campaigns.updatedAt))
    : [];

  return (
    <main style={{ maxWidth: 640, margin: "60px auto", fontFamily: "Georgia, serif",
                   color: "#e8e3d8", padding: "0 20px" }}>
      <h1 style={{ color: "#8fd4a8" }}>Runebog <small style={{ color: "#8b968e" }}>Diario del GM</small></h1>
      <p>Mappe gerarchiche, quest, encounter e schede mostro per le tue campagne. Gratis, per sempre.</p>

      {!session?.user ? (
        <form action={doSignIn}><button>Accedi con Google</button></form>
      ) : (
        <>
          <p>Ciao, {session.user.name} · <form action={doSignOut} style={{ display: "inline" }}>
            <button>Esci</button></form></p>
          <form action={createCampaign}><button>+ Nuova campagna</button></form>
          <ul>
            {rows.map(c => (
              <li key={c.id}>
                <a href={`/play/${c.id}`} style={{ color: "#6cc3c9" }}>{c.name}</a>
                {" "}<small style={{ color: "#8b968e" }}>
                  aggiornata {c.updatedAt.toLocaleDateString("it-IT")}</small>
              </li>
            ))}
          </ul>
        </>
      )}

      <hr style={{ margin: "40px 0", borderColor: "#2a352e" }} />
      <p><a href={DONATE_URL} style={{ color: "#d8b25a" }}>☕ Offrimi un caffè</a> —
        il sito resta gratuito per tutti.</p>
    </main>
  );
}

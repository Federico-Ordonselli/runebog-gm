import { auth, signIn, signOut } from "@/auth";
import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { DeleteCampaignButton } from "./delete-campaign-button";
import { AuthForms } from "./auth-forms";

// TODO: placeholder — sostituire con il link reale (Ko-fi / BuyMeACoffee / PayPal.me) prima del deploy.
const DONATE_URL = "https://ko-fi.com/TUO_UTENTE";

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
      <h1 style={{ color: "#8fd4a8" }}>Runebog{" "}
        <small style={{ color: "#8b968e", fontSize: 14, letterSpacing: ".14em",
                        textTransform: "uppercase" }}>GM · Diario del GM</small></h1>
      <p>Mappe gerarchiche, quest, encounter e schede mostro per le tue campagne. Gratis, per sempre.</p>
      <p style={{ color: "#8b968e", fontSize: 14 }}>
        Le campagne sono salvate sul tuo account: le riprendi da qualsiasi dispositivo.
        Puoi sempre esportarle in JSON — sono tue.</p>

      {!session?.user ? (
        <>
          <form action={doSignIn}>
            <button style={{ width: "100%", padding: "10px 14px", borderRadius: 8, cursor: "pointer",
                             background: "#1b261f", border: "1px solid #2a352e", color: "#e8e3d8",
                             font: "inherit", fontSize: 14, marginTop: 24 }}>
              Accedi con Google
            </button>
          </form>
          <p style={{ textAlign: "center", color: "#8b968e", fontSize: 13, margin: "16px 0 0" }}>
            oppure, senza Google:
          </p>
          <AuthForms />
        </>
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
                <DeleteCampaignButton id={c.id} name={c.name} />
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

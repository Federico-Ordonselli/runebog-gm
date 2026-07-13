import { auth, signIn, signOut } from "@/auth";
import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { DeleteCampaignButton } from "./delete-campaign-button";
import { AuthForms } from "./auth-forms";
import { DeleteAccount } from "./delete-account";

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
    <main className="page">
      <h1 className="title">
        Runebog
        <span className="title__kicker">GM · Diario del GM</span>
      </h1>

      {!session?.user ? (
        <>
          <p className="lede">
            Mappe gerarchiche, quest, encounter e schede mostro per le tue campagne.
            Gratis, per sempre.
          </p>
          <p className="muted small">
            Le campagne sono salvate sul tuo account: le riprendi da qualsiasi dispositivo.
            Puoi sempre esportarle in JSON — sono tue.
          </p>

          <form action={doSignIn} style={{ marginTop: "1.75rem" }}>
            <button className="btn btn--block">Accedi con Google</button>
          </form>

          <p className="divider">oppure, senza Google</p>

          <AuthForms />
        </>
      ) : (
        <>
          <div className="bar">
            <p className="muted" style={{ margin: 0 }}>
              Ciao, <strong style={{ color: "var(--parchment)", fontWeight: 400 }}>
                {session.user.name}
              </strong>
            </p>
            <form action={doSignOut}>
              <button className="btn btn--ghost">Esci</button>
            </form>
          </div>

          <div style={{ marginTop: "1.5rem" }}>
            <form action={createCampaign}>
              <button className="btn btn--primary">+ Nuova campagna</button>
            </form>
          </div>

          {rows.length === 0 ? (
            <div className="empty">
              <p>Non hai ancora campagne. Creane una: parte da una mappa vuota.</p>
            </div>
          ) : (
            <ul className="campaigns">
              {rows.map(c => (
                <li key={c.id} className="campaign">
                  <span className="campaign__body">
                    <a href={`/play/${c.id}`} className="campaign__name">{c.name}</a>
                    <span className="campaign__meta">
                      aggiornata {c.updatedAt.toLocaleDateString("it-IT")}
                    </span>
                  </span>
                  <DeleteCampaignButton id={c.id} name={c.name} />
                </li>
              ))}
            </ul>
          )}

          <DeleteAccount campaignCount={rows.length} />
        </>
      )}

      <hr className="rule" />
      <p className="small">
        <a href={DONATE_URL} className="link link--lantern"
           target="_blank" rel="noopener noreferrer">☕ Offrimi un caffè</a>{" "}
        — il sito resta gratuito per tutti.
      </p>
      {/* TODO: quando il repo GitHub sarà pubblico, aggiungi qui il link "Codice sorgente"
          (e rimetti la frase sul codice verificabile in fondo a /privacy). */}
      <p className="small">
        <a href="/privacy" className="link link--quiet">Privacy</a>
      </p>
    </main>
  );
}

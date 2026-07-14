import { auth, signIn, signOut } from "@/auth";
import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { DeleteCampaignButton } from "./delete-campaign-button";
import { AuthForms } from "./auth-forms";
import { DeleteAccount } from "./delete-account";
import { newCampaignData } from "@/lib/campaigns";
import { CONTACT_EMAIL, DONATE_URL } from "@/lib/site";

const NOME_INIZIALE = "Nuova campagna";

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
      name: NOME_INIZIALE,
      data: newCampaignData(NOME_INIZIALE),   // stessa forma che scrive POST /api/campaigns
    }).returning({ id: campaigns.id });
    redirect(`/play/${row.id}`);
  }

  const rows = session?.user?.id
    ? await db.select({ id: campaigns.id, name: campaigns.name, updatedAt: campaigns.updatedAt })
        .from(campaigns).where(eq(campaigns.userId, session.user.id)).orderBy(desc(campaigns.updatedAt))
    : [];

  return (
    <main className="page page--home">
      {!session?.user ? (
        <div className="hero">
          <div className="hero__intro">
            <h1 className="title">
              Runebog
              <span className="title__kicker">GM · Diario del GM</span>
            </h1>
            <p className="lede">
              Mappe gerarchiche, quest, encounter e schede mostro per le tue campagne.
              Gratis, per sempre.
            </p>
            <p className="muted small">
              Le campagne sono salvate sul tuo account: le riprendi da qualsiasi dispositivo.
              Puoi sempre esportarle in JSON — sono tue.
            </p>
          </div>

          <div className="hero__auth">
            <form action={doSignIn}>
              <button className="btn btn--block">Accedi con Google</button>
            </form>

            <p className="divider">oppure, senza Google</p>

            <AuthForms />
          </div>
        </div>
      ) : (
        <>
          <div className="bar">
            <h1 className="title title--sm">
              Runebog
              <span className="title__kicker">GM · Diario del GM</span>
            </h1>
            {/* <div>, non <p>: un <form> dentro un paragrafo è HTML non valido
                e manda React in errore di idratazione. */}
            <div className="whoami muted small">
              <span>
                Ciao, <strong className="whoami__name">{session.user.name}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <form action={doSignOut}>
                <button className="linkbtn">Esci</button>
              </form>
            </div>
          </div>

          <div className="bar bar--flush">
            <h2 className="section">Le tue campagne</h2>
            {/* Con zero campagne l'azione sta nello stato vuoto, dove guarda l'occhio:
                un bottone solo, non due che fanno la stessa cosa. */}
            {rows.length > 0 && (
              <form action={createCampaign}>
                <button className="btn btn--primary">+ Nuova campagna</button>
              </form>
            )}
          </div>

          {rows.length === 0 ? (
            <div className="empty">
              <p>Qui compariranno le tue campagne. La prima parte da una mappa vuota:
                 una zona, e da lì scendi in città, dungeon e stanze.</p>
              <form action={createCampaign}>
                <button className="btn btn--primary">+ Crea la prima campagna</button>
              </form>
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
        <a href="/dungeon" className="link">Generatore di dungeon</a>
        {" · "}
        <a href="/privacy" className="link link--quiet">Privacy</a>
        {" · "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="link link--quiet">Scrivimi</a>
      </p>
    </main>
  );
}

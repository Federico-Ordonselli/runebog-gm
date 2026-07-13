// TODO: decidi l'indirizzo di contatto pubblico. Una casella dedicata sul dominio
// (es. privacy@runebog.app, anche solo come inoltro) evita di esporre la tua email personale.
const CONTACT_EMAIL = "privacy@runebog.app";

export const metadata = { title: "Privacy — Runebog GM" };

const h2: React.CSSProperties = { color: "#8fd4a8", fontSize: 18, marginTop: 34 };
const li: React.CSSProperties = { marginBottom: 8 };

export default function Privacy() {
  return (
    <main style={{ maxWidth: 680, margin: "60px auto", fontFamily: "Georgia, serif",
                   color: "#e8e3d8", padding: "0 20px", lineHeight: 1.65 }}>
      <p><a href="/" style={{ color: "#6cc3c9" }}>← Torna a Runebog GM</a></p>
      <h1 style={{ color: "#8fd4a8" }}>Privacy</h1>
      <p style={{ color: "#8b968e" }}>
        Cosa raccoglie Runebog GM, perché, e come te ne liberi. In parole chiare.
      </p>

      <h2 style={h2}>Cosa raccogliamo</h2>
      <ul>
        <li style={li}>
          <strong>Se ti registri con nome utente e password:</strong> il nome utente e la password.
          La password non viene mai salvata come l&apos;hai scritta: ne conserviamo solo un{" "}
          <em>hash</em> (scrypt), che è una trasformazione a senso unico. Nemmeno chi gestisce il
          sito può risalire alla tua password.
        </li>
        <li style={li}>
          <strong>L&apos;email è facoltativa.</strong> Serve solo a reimpostare la password se la
          dimentichi. Se non la dai, non l&apos;abbiamo — ma in quel caso, se perdi la password,
          perdi l&apos;accesso all&apos;account.
        </li>
        <li style={li}>
          <strong>Se accedi con Google:</strong> riceviamo da Google il tuo nome, la tua email e
          l&apos;immagine del profilo. Non abbiamo accesso alla tua password Google né ad altro
          del tuo account.
        </li>
        <li style={li}>
          <strong>Le tue campagne:</strong> tutto ciò che scrivi nell&apos;app — mappe, note, quest,
          PNG, immagini che carichi. È il contenuto del servizio: senza, il sito non avrebbe senso.
        </li>
      </ul>
      <p>
        Non usiamo cookie di tracciamento, non facciamo profilazione, non c&apos;è pubblicità e non
        vendiamo nulla a nessuno. L&apos;unico cookie è quello che ti tiene collegato.
      </p>

      <h2 style={h2}>Dove stanno i dati</h2>
      <ul>
        <li style={li}><strong>Neon</strong> — il database (server nell&apos;Unione Europea).</li>
        <li style={li}><strong>Vercel</strong> — l&apos;hosting del sito.</li>
        <li style={li}><strong>Google</strong> — solo se scegli di accedere con Google.</li>
        <li style={li}><strong>Resend</strong> — solo per spedire l&apos;email di reimpostazione password, se ne chiedi una.</li>
      </ul>
      <p>
        Chi amministra il sito ha accesso tecnico al database, e quindi può leggere email, nomi
        utente e contenuti delle campagne. Te lo diciamo perché è vero, non perché lo facciamo:
        quei dati servono a far funzionare il servizio e non vengono usati per altro. Le password,
        come detto, non sono leggibili da nessuno.
      </p>

      <h2 style={h2}>Per quanto tempo</h2>
      <p>
        Finché tieni l&apos;account. Quando lo elimini, spariscono immediatamente e definitivamente
        anche le tue campagne, le sessioni e ogni eventuale token di recupero: non teniamo copie
        di cortesia. I token per reimpostare la password scadono comunque dopo un&apos;ora.
      </p>

      <h2 style={h2}>I tuoi diritti</h2>
      <ul>
        <li style={li}>
          <strong>Portarti via tutto:</strong> il pulsante <em>Esporta</em>, dentro ogni campagna,
          ti dà un file JSON con l&apos;intero contenuto. È un formato aperto, leggibile, e lo puoi
          reimportare dove vuoi. Non c&apos;è nessun lock-in.
        </li>
        <li style={li}>
          <strong>Cancellare tutto:</strong> il link <em>Elimina il mio account</em> nella pagina
          principale. Immediato, definitivo, senza doverlo chiedere a nessuno.
        </li>
        <li style={li}>
          <strong>Chiedere e correggere:</strong> puoi sapere quali dati abbiamo su di te e farli
          correggere scrivendo a <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "#6cc3c9" }}>{CONTACT_EMAIL}</a>.
        </li>
      </ul>

      <h2 style={h2}>Contatti</h2>
      <p>
        Per qualsiasi cosa riguardi i tuoi dati:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "#6cc3c9" }}>{CONTACT_EMAIL}</a>.
      </p>

      <hr style={{ margin: "40px 0", borderColor: "#2a352e" }} />
      {/* TODO: quando il repo GitHub sarà pubblico, riaggiungi qui che il codice è
          verificabile da chiunque — oggi è privato, quindi non lo affermiamo. */}
      <p style={{ color: "#8b968e", fontSize: 13 }}>
        Runebog GM è un progetto gratuito e senza scopo di lucro.
      </p>
    </main>
  );
}

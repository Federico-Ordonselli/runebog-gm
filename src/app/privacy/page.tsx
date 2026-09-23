import { CONTACT_EMAIL, REPO_URL } from "@/lib/site";

export const metadata = { title: "Privacy — Runebog GM" };

export default function Privacy() {
  return (
    <main className="page page--wide prose">
      <p className="small">
        <a href="/" className="link">← Torna a Runebog GM</a>
      </p>

      <h1 className="title">Privacy</h1>
      <p className="lede muted">
        Cosa raccoglie Runebog GM, perché, e come te ne liberi. In parole chiare.
      </p>

      <h2>Cosa raccogliamo</h2>
      <ul>
        <li>
          <strong>Se ti registri con nome utente e password:</strong> il nome utente e la password.
          La password non viene mai salvata come l&apos;hai scritta: ne conserviamo solo un{" "}
          <em>hash</em> (scrypt), che è una trasformazione a senso unico. Nemmeno chi gestisce il
          sito può risalire alla tua password.
        </li>
        <li>
          <strong>L&apos;email è facoltativa.</strong> Serve solo a reimpostare la password se la
          dimentichi. Se non la dai, non l&apos;abbiamo — ma in quel caso, se perdi la password,
          perdi l&apos;accesso all&apos;account.
        </li>
        <li>
          <strong>Se accedi con Google:</strong> riceviamo da Google il tuo nome, la tua email e
          l&apos;immagine del profilo. Non abbiamo accesso alla tua password Google né ad altro
          del tuo account.
        </li>
        <li>
          <strong>Le tue campagne:</strong> tutto ciò che scrivi nell&apos;app — mappe, note, quest,
          PNG, immagini che carichi. È il contenuto del servizio: senza, il sito non avrebbe senso.
        </li>
      </ul>
      <p>
        Non facciamo profilazione, non c&apos;è pubblicità e non vendiamo nulla a nessuno.
      </p>

      <h2>Cookie e dati salvati sul tuo dispositivo</h2>
      <p>
        Non usiamo cookie di tracciamento, di analisi o pubblicitari, né nostri né di terzi. Tutto
        ciò che il sito salva sul tuo dispositivo serve a farlo funzionare o a ricordare una scelta
        che hai fatto tu: per questo non ti chiediamo un consenso, che la legge (direttiva
        ePrivacy, art. 5.3) non richiede per questi casi.
      </p>
      <ul>
        <li>
          <strong>Cookie di accesso</strong> (<code>authjs.session-token</code>): ti tiene
          collegato dopo il login. Senza, dovresti rientrare a ogni pagina.
        </li>
        <li>
          <strong>Cookie di sicurezza</strong> (<code>authjs.csrf-token</code>,{" "}
          <code>authjs.callback-url</code> e, solo durante l&apos;accesso con Google,{" "}
          <code>authjs.state</code> e <code>authjs.pkce.code_verifier</code>): proteggono i moduli
          di accesso da richieste contraffatte e riportano alla pagina giusta dopo il login. Quelli
          dell&apos;accesso con Google spariscono appena l&apos;accesso è completato.
        </li>
        <li>
          <strong>Memoria locale del browser</strong> (<code>localStorage</code>, chiavi che
          iniziano con <code>runebog-</code>): il tema e le preferenze dell&apos;interfaccia, le
          campagne che usi senza account e una copia di sicurezza delle modifiche non ancora
          salvate sul server. Non lascia mai il tuo dispositivo, se non quando salvi tu.
        </li>
        <li>
          <strong>Copia offline</strong> (service worker e cache del browser): solo se apri
          l&apos;editor senza account o scegli di scaricare le regole per usarle senza rete.
        </li>
      </ul>
      <p>
        Sul sito i nomi dei cookie hanno davanti il prefisso <code>__Secure-</code> o{" "}
        <code>__Host-</code>, che obbliga il browser a spedirli solo su connessione cifrata.
        Puoi cancellare tutto in qualsiasi momento dalle impostazioni del browser. Perderai
        l&apos;accesso (basta rientrare) e ciò che era salvato solo lì.
      </p>

      <h2>Dove stanno i dati</h2>
      <ul>
        <li><strong>Neon</strong> — il database (server nell&apos;Unione Europea).</li>
        <li><strong>Vercel</strong> — l&apos;hosting del sito.</li>
        <li><strong>Google</strong> — solo se scegli di accedere con Google.</li>
        <li><strong>Resend</strong> — solo per spedire l&apos;email di reimpostazione password, se ne chiedi una.</li>
        <li>
          <strong>Cloudflare</strong> — sta davanti al sito: ogni richiesta passa di lì prima di
          arrivare a Vercel, quindi Cloudflare vede il tuo indirizzo IP e le pagine che chiedi,
          per consegnarle e per proteggere il sito dagli attacchi. Instrada anche la posta che
          scrivi a{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="link">{CONTACT_EMAIL}</a>. Non usiamo i
          suoi strumenti di analisi.
        </li>
      </ul>
      <p>
        Chi amministra il sito ha accesso tecnico al database, e quindi può leggere email, nomi
        utente e contenuti delle campagne. Te lo diciamo perché è vero, non perché lo facciamo:
        quei dati servono a far funzionare il servizio e non vengono usati per altro. Le password,
        come detto, non sono leggibili da nessuno.
      </p>

      <h2>Per quanto tempo</h2>
      <p>
        Finché tieni l&apos;account. Quando lo elimini, spariscono immediatamente e definitivamente
        anche le tue campagne, le sessioni e ogni eventuale token di recupero: non teniamo copie
        di cortesia. I token per reimpostare la password scadono comunque dopo un&apos;ora.
      </p>

      <h2>I tuoi diritti</h2>
      <ul>
        <li>
          <strong>Portarti via tutto:</strong> il pulsante <em>Esporta</em>, dentro ogni campagna,
          ti dà un file JSON con l&apos;intero contenuto. È un formato aperto, leggibile, e lo puoi
          reimportare dove vuoi. Non c&apos;è nessun lock-in.
        </li>
        <li>
          <strong>Cancellare tutto:</strong> il link <em>Elimina il mio account</em> nella pagina
          principale. Immediato, definitivo, senza doverlo chiedere a nessuno.
        </li>
        <li>
          <strong>Chiedere e correggere:</strong> puoi sapere quali dati abbiamo su di te e farli
          correggere scrivendo a{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="link">{CONTACT_EMAIL}</a>.
        </li>
      </ul>

      <h2>Contatti</h2>
      <p>
        Per qualsiasi cosa riguardi i tuoi dati:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="link">{CONTACT_EMAIL}</a>.
      </p>

      <hr className="rule" />
      <p className="muted small">
        Runebog GM è un progetto gratuito e senza scopo di lucro. Il{" "}
        <a href={REPO_URL} className="link" target="_blank" rel="noopener noreferrer">
          codice sorgente
        </a>{" "}
        è pubblico: quello che leggi qui è verificabile da chiunque.
      </p>
    </main>
  );
}

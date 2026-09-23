import { REPO_URL, WINDOWS_PORTABLE_SHA256, WINDOWS_PORTABLE_URL, WINDOWS_PORTABLE_VERSION } from "@/lib/site";

export const metadata = {
  title: "Scarica Runebog GM per Windows",
  description: "App portable per Windows: mappe e tavolo locale anche senza Internet.",
};

export default function Scarica() {
  return (
    <main className="page page--wide prose">
      <p className="small"><a href="/" className="link">← Torna a Runebog GM</a></p>
      <h1 className="title">Runebog per Windows</h1>
      <p className="lede muted">L&apos;editor sul tuo PC, senza installazione e senza connessione Internet.</p>

      <p><a className="btn btn--primary" href={WINDOWS_PORTABLE_URL}>Scarica Runebog GM Portable</a></p>
      <p className="small muted">Versione {WINDOWS_PORTABLE_VERSION} · Windows 64 bit · 104,8 MiB (circa 110 MB)</p>

      <h2>Come si usa</h2>
      <ol>
        <li>Scarica il file EXE e avvialo. Non serve installare Node.js.</li>
        <li>Per il tavolo, collega PC e telefoni alla stessa Wi-Fi o all&apos;hotspot del PC.</li>
        <li>Nell&apos;app premi <strong>Tavolo</strong>, apri il tavolo locale e fai scansionare il QR ai giocatori.</li>
      </ol>
      <p>Le campagne restano nella cartella <strong>Runebog GM Data</strong> accanto all&apos;EXE. Quando sposti l&apos;app, copia anche quella cartella. Puoi trasferire campagne dal sito con Esporta e Importa.</p>
      <p>Questa versione non è firmata digitalmente: Windows potrebbe mostrare un avviso alla prima apertura.</p>

      <h2>Verifica del file</h2>
      <p className="small">SHA-256: <code className="download-hash">{WINDOWS_PORTABLE_SHA256}</code></p>
      <p className="small muted">Il file è pubblicato nella <a href={`${REPO_URL}/releases/tag/v${WINDOWS_PORTABLE_VERSION}`} className="link">release su GitHub</a>.</p>
    </main>
  );
}

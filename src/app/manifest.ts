import type { MetadataRoute } from "next";

/* Il manifesto: quel che serve a installare Runebog come applicazione.
 *
 * È il terzo pezzo della copia offline, e quello che rende vero il caso d'uso —
 * un tablet al tavolo, in una cantina — invece di una scheda di browser con la
 * barra dell'indirizzo che mangia un decimo dello schermo.
 *
 * `start_url` è la HOME e non /app.html, ed è una scelta, non una svista.
 * Offline /app.html è lo standalone su localStorage: aprire lì chi ha le sue
 * campagne nel cloud vorrebbe dire consegnargli un editor vuoto che sembra il
 * suo. Dalla home ci si arriva in un clic quando la rete c'è, e quando non c'è
 * risponde `public/offline.html` — che quella differenza la dice invece di
 * nasconderla. È la stessa regola per cui la pagina di ripiego non è un
 * redirect.
 *
 * I colori sono quelli di Torbiera, il tema di default. Il manifesto è un file
 * statico e non può seguire il tema scelto (che sta in localStorage), quindi
 * chi gioca su Pergamena vede per un istante uno sfondo scuro all'avvio: il
 * rovescio è dichiarato, e vale meno di dodici manifesti o di uno generato a
 * runtime che nessun sistema riscarica comunque.
 *
 * Le icone sono generate: `node scripts/genera-icone.mjs`. La `maskable` è un
 * disegno diverso, non un ritaglio — vedi il commento nello script.
 */

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Runebog GM — Diario del GM",
    short_name: "Runebog",
    description:
      "Mappe gerarchiche, quest, encounter e schede mostro per le tue campagne. Funziona anche senza rete.",
    lang: "it",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0c1310",
    theme_color: "#0c1310",
    icons: [
      { src: "/icone/runebog-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icone/runebog-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icone/runebog-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

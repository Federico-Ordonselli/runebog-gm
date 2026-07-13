import "./globals.css";

export const metadata = {
  title: "Runebog GM — Diario del GM",
  description: "Mappe gerarchiche, quest, encounter e schede mostro per le tue campagne.",
};

// Il tema scelto nell'app vale anche qui: stesso dominio, stessa chiave.
// Va applicato PRIMA del primo disegno, o si vede un lampo del tema sbagliato.
const APPLICA_TEMA = `try{var t=localStorage.getItem("runebog-theme");if(t&&t!=="torbiera")document.documentElement.dataset.theme=t;}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: lo script scrive data-theme sull'<html> prima
    // dell'idratazione, quindi client e server differiscono di proposito. Vale
    // solo per questo elemento, non per i figli.
    <html lang="it" suppressHydrationWarning>
      <head>
        {/* Sorgente unica dei colori, condivisa con public/app.html */}
        <link rel="stylesheet" href="/themes.css" />
        <script dangerouslySetInnerHTML={{ __html: APPLICA_TEMA }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

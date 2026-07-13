import "./globals.css";

export const metadata = {
  title: "Runebog GM — Diario del GM",
  description: "Mappe gerarchiche, quest, encounter e schede mostro per le tue campagne.",
};

export const viewport = {
  themeColor: "#0c1310",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}

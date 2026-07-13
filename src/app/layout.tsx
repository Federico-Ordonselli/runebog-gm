export const metadata = {
  title: "Runebog GM — Diario del GM",
  description: "Mappe gerarchiche, quest, encounter e schede mostro per le tue campagne.",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body style={{ margin: 0, background: "#0d1411" }}>{children}</body>
    </html>
  );
}

export const metadata = { title: "Runebog — Diario del GM" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body style={{ margin: 0, background: "#0d1411" }}>{children}</body>
    </html>
  );
}

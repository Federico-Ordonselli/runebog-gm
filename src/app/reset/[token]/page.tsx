import { isResetTokenValid } from "@/lib/reset-token";
import { ResetForm } from "./reset-form";

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = await isResetTokenValid(token);   // controlla senza consumare

  return (
    <main style={{ maxWidth: 480, margin: "60px auto", fontFamily: "Georgia, serif",
                   color: "#e8e3d8", padding: "0 20px" }}>
      <h1 style={{ color: "#8fd4a8" }}>Nuova password</h1>
      {valid ? (
        <ResetForm token={token} />
      ) : (
        <>
          <p style={{ color: "#e0785f" }}>
            Questo link non è più valido: è scaduto (durano un&apos;ora) oppure è già stato usato.
          </p>
          <p><a href="/" style={{ color: "#6cc3c9" }}>← Torna alla home e richiedine uno nuovo</a></p>
        </>
      )}
    </main>
  );
}

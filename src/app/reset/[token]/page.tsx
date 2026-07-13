import { isResetTokenValid } from "@/lib/reset-token";
import { ResetForm } from "./reset-form";

export const metadata = { title: "Nuova password — Runebog GM" };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = await isResetTokenValid(token);   // controlla senza consumare

  return (
    <main className="page page--narrow">
      <h1 className="title">Nuova password</h1>
      {valid ? (
        <ResetForm token={token} />
      ) : (
        <>
          <p className="msg msg--error">
            Questo link non è più valido: è scaduto (durano un&apos;ora) oppure è già stato usato.
          </p>
          <p><a href="/" className="link">← Torna alla home e richiedine uno nuovo</a></p>
        </>
      )}
    </main>
  );
}

/**
 * Invio email via API REST di Resend (https://api.resend.com/emails).
 * Usiamo fetch, non l'SDK: nessuna dipendenza in più.
 *
 * Senza RESEND_API_KEY il modulo NON fallisce: stampa il link in console.
 * Così il flusso di recupero è testabile in locale prima di avere dominio e chiave.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(opts: {
  to: string; subject: string; text: string;
}): Promise<{ sent: boolean; error?: string }> {
  if (!emailConfigured()) {
    // Fallback di sviluppo: niente invio, il contenuto finisce nei log del server.
    console.warn(
      "\n[email] RESEND_API_KEY/EMAIL_FROM non impostate: email NON inviata.\n" +
      `[email] destinatario: ${opts.to}\n[email] ${opts.text}\n`,
    );
    return { sent: false, error: "not-configured" };
  }

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [opts.to],
      subject: opts.subject,
      text: opts.text,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[email] invio fallito:", res.status, body);
    return { sent: false, error: `resend-${res.status}` };
  }
  return { sent: true };
}

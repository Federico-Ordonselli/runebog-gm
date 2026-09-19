/**
 * Il confronto di `If-None-Match`, in un posto solo.
 *
 * È **debole**, cioè ignora il prefisso `W/` e accetta l'elenco separato da
 * virgole. Non è generosità: è ciò che la norma chiede (RFC 9110 §13.1.2,
 * "weak comparison"), e chiunque stia in mezzo ha il permesso di indebolire un
 * ETag forte. Un `===` sulla stringa intera legge `W/"r5"` come diverso da
 * `"r5"` e risponde 200 per sempre — cioè spreca tutto senza rompere niente,
 * che è il modo peggiore di sbagliare, perché non si vede.
 *
 * Misurato il 31 lug 2026 (`/themes.css` in produzione, con e senza brotli):
 * oggi l'edge di Vercel l'ETag lo lascia identico, quindi il caso non capita —
 * il confronto debole non serve a riparare qualcosa, serve a non dipendere da
 * quella misura.
 *
 * Sta qui e non dentro una rotta da quando i chiamanti sono **due** (il polling
 * del tavolo, dove l'ETag è la revisione, e `/immagini/[chiave]`, dove è la
 * chiave): una regola che si sbaglia in silenzio non va ricopiata.
 */
export const stessoEtag = (inviato: string | null, etag: string) =>
  !!inviato && inviato.split(",").some(v => v.trim().replace(/^W\//, "") === etag);

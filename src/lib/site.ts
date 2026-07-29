/** Costanti pubblicate sulle pagine. Una sola volta: l'indirizzo di contatto sta
 *  anche nella privacy policy, e due copie che divergono sono una promessa rotta. */

export const CONTACT_EMAIL = "support@runebog.app";

// Link diretto, non il widget JS di Ko-fi: quello caricherebbe uno script di terze
// parti (e potenziali cookie) su ogni visita, contraddicendo quanto promette /privacy.
export const DONATE_URL = "https://ko-fi.com/runebog";

// Il repo è pubblico: /privacy afferma che il codice è verificabile da chiunque,
// quindi se questo link torna privato va tolta anche quella frase.
export const REPO_URL = "https://github.com/Federico-Ordonselli/runebog-gm";

/* Il nome della licenza del CODICE, come va scritto agli utenti. Sta qui e non
   nelle pagine per la stessa ragione dell'indirizzo di contatto: una pagina che
   dichiara una licenza diversa da LICENSE non è un refuso ma una concessione
   pubblica che non volevo dare — fino al 29 lug 2026 il sito diceva "MIT", e
   quella frase da sola avrebbe continuato a concederla.
   NON copre i contenuti SRD, che restano CC-BY-4.0 (e quella permette anche
   l'uso commerciale): a dirlo è ATTRIBUZIONE_SRD, che è un'altra cosa. */
export const CODE_LICENSE = "PolyForm Noncommercial 1.0.0";

/** Costanti pubblicate sulle pagine. Una sola volta: l'indirizzo di contatto sta
 *  anche nella privacy policy, e due copie che divergono sono una promessa rotta. */

export const CONTACT_EMAIL = "support@runebog.app";

// Link diretto, non il widget JS di Ko-fi: quello caricherebbe uno script di terze
// parti (e potenziali cookie) su ogni visita, contraddicendo quanto promette /privacy.
export const DONATE_URL = "https://ko-fi.com/runebog";

// Il repo è pubblico: /privacy afferma che il codice è verificabile da chiunque,
// quindi se questo link torna privato va tolta anche quella frase.
export const REPO_URL = "https://github.com/Federico-Ordonselli/runebog-gm";

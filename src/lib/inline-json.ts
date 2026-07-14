/**
 * JSON da incastonare dentro un <script> inline.
 *
 * JSON.stringify da solo NON basta: il parser HTML chiude lo script al primo
 * "</script>" che incontra, anche dentro una stringa JSON. Un titolo di bolla
 * come `</script><script>...` uscirebbe dal tag ed eseguirebbe codice nel
 * browser di chi apre la pagina (per il tavolo: i giocatori). Con "<" scritto
 * \u003c il testo resta JSON valido e identico dopo il parse, ma non è più HTML.
 * U+2028/U+2029 sono legali in JSON e illegali nei letterali JS: senza escape
 * spaccherebbero lo script.
 */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

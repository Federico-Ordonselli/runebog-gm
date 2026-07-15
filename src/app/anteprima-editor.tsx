/* Anteprima dell'editor sulla landing: la mappa è disegnata a mano coi token
   di themes.css (gli stessi che usa l'editor vero), non è uno screenshot —
   così pesa nulla, resta nitida a ogni densità e segue il tema senza invecchiare.
   La grammatica visiva è quella di public/app/mappa.js: bolle con bordo del
   colore del tipo, mini-preview dei figli dentro la zona (è la gerarchia),
   collegamenti di EDGE_TYPES, status dot forma+colore, glow oro sul condiviso.
   Come nell'editor, stroke e fill vanno in style={}: gli attributi di
   presentazione SVG non risolvono var(). */

const dim = { fontSize: 11, fill: "var(--parchment-dim)" } as const;
const ombra = { filter: "drop-shadow(0 2px 3px rgba(0,0,0,.45))" } as const;

export function AnteprimaEditor() {
  return (
    <a className="demo" href="/app.html">
      <span className="demo__frame" aria-hidden="true">
        <svg viewBox="0 0 520 310" role="presentation" focusable="false">
          <defs>
            <pattern id="landing-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M40 0H0V40" fill="none" style={{ stroke: "var(--grid)" }} strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="520" height="310" fill="url(#landing-grid)" />

          {/* collegamenti, sotto le bolle come nell'editor */}
          <line x1="120" y1="115" x2="410" y2="75"
                style={{ stroke: "var(--track)" }} strokeWidth="5" strokeLinecap="round" />
          <text x="265" y="83" textAnchor="middle" style={{ ...dim, paintOrder: "stroke", stroke: "var(--peat)", strokeWidth: 3 }}>
            mezza giornata
          </text>
          {/* ponte: doppia linea (wisp + anima scura) */}
          <line x1="120" y1="115" x2="165" y2="250"
                style={{ stroke: "var(--wisp)" }} strokeWidth="7" strokeLinecap="round" />
          <line x1="120" y1="115" x2="165" y2="250"
                style={{ stroke: "var(--peat)" }} strokeWidth="2" />
          {/* passaggio segreto: il tratteggio cammina (vedi .demo__segreto) */}
          <line className="demo__segreto" x1="410" y1="75" x2="415" y2="220"
                style={{ stroke: "var(--arcane)" }} strokeWidth="3" strokeDasharray="2 7" strokeLinecap="round" />

          {/* zona con mini-preview dei figli: la bolla che si apre è la gerarchia.
              Condivisa coi giocatori: il glow di lanterna è la firma dell'editor. */}
          <g>
            <rect x="20" y="45" width="200" height="140" rx="10"
                  style={{ fill: "var(--surface)", stroke: "var(--moss)", filter: "drop-shadow(0 0 6px var(--lantern)) drop-shadow(0 2px 3px rgba(0,0,0,.45))" }}
                  strokeWidth="2" />
            <text x="120" y="65" textAnchor="middle" style={{ fontSize: 13, fill: "var(--parchment)" }}>
              Porto delle Nebbie
            </text>
            <g opacity="0.85">
              <line x1="72" y1="112" x2="158" y2="102" style={{ stroke: "var(--track)" }} strokeWidth="1.5" />
              <line x1="158" y1="102" x2="118" y2="152" style={{ stroke: "var(--track)" }} strokeWidth="1.5" strokeDasharray="3 3" />
              <rect x="52" y="98" width="40" height="26" rx="1.5" fill="none" style={{ stroke: "var(--wisp)" }} strokeWidth="1.2" />
              <rect x="140" y="90" width="36" height="24" rx="1.5" fill="none" style={{ stroke: "var(--moss)" }} strokeWidth="1.2" />
              <rect x="102" y="142" width="30" height="20" rx="1.5" fill="none" style={{ stroke: "var(--wisp)" }} strokeWidth="1.2" />
              <circle cx="80" cy="150" r="2.6" style={{ fill: "var(--ember)" }} />
            </g>
            <text x="120" y="177" textAnchor="middle" style={{ fontSize: 10, fill: "var(--parchment-dim)" }}>◦ 4</text>
          </g>

          {/* luogo, "in corso" (disco pieno di lanterna) */}
          <g>
            <rect x="340" y="35" width="140" height="80" rx="10"
                  style={{ fill: "var(--surface)", stroke: "var(--wisp)", ...ombra }} strokeWidth="2" />
            <text x="410" y="80" textAnchor="middle" style={{ fontSize: 13, fill: "var(--parchment)" }}>
              Taverna del Guado
            </text>
            <circle cx="476" cy="39" r="5.5" style={{ fill: "var(--lantern)", stroke: "var(--peat)" }} strokeWidth="2" />
          </g>

          {/* segnalino quest, "fatto" (disco con la spunta) */}
          <g>
            <circle cx="415" cy="220" r="15" style={{ fill: "var(--surface)", stroke: "var(--lantern)", ...ombra }} strokeWidth="2" />
            <text x="415" y="224" textAnchor="middle" style={{ fontSize: 12, fontWeight: 700, fill: "var(--lantern)" }}>Q</text>
            <text x="415" y="250" textAnchor="middle" style={dim}>Il carico sparito</text>
            <circle cx="428" cy="208" r="5.5" style={{ fill: "var(--moss)", stroke: "var(--peat)" }} strokeWidth="2" />
            <path d="M425.4 208.2l1.9 2 3.4-4" fill="none" style={{ stroke: "var(--peat)" }}
                  strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </g>

          {/* segnalino encounter */}
          <g>
            <circle cx="165" cy="250" r="15" style={{ fill: "var(--surface)", stroke: "var(--ember)", ...ombra }} strokeWidth="2" />
            <text x="165" y="254" textAnchor="middle" style={{ fontSize: 12, fontWeight: 700, fill: "var(--ember)" }}>E</text>
            <text x="165" y="280" textAnchor="middle" style={dim}>Imboscata al molo</text>
          </g>
        </svg>
      </span>
      <span className="demo__cta">
        Provala senza account <span className="demo__arrow" aria-hidden="true">→</span>
      </span>
    </a>
  );
}

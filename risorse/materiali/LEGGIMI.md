# Texture per battlemap

Le dodici texture stanno in `public/app/materiali/`; questo file e
`anteprima.webp` stanno qui, fuori da `public/`, perché il service worker
precarica tutto `public/` per ogni utente dell'editor e questi due file non
servono all'app (spostati il 29 settembre 2026).

Generate il 29 settembre 2026 su richiesta per Runebog.

## Generazione

Strumento: generatore integrato OpenAI `image_gen` (`image_gen.imagegen`), tramite Codex; una generazione distinta per materiale. Modello: modello di generazione immagini gestito dallo strumento, **identificativo e versione non esposti nella risposta**. Non è quindi possibile attestare un nome commerciale preciso. Nessuna immagine esterna usata come riferimento. Lava e tappeto sono stati successivamente corretti con lo stesso strumento per attenuare saturazione e contrasto.

Conversione e composizione: ImageMagick 7.1.2-32. Ridimensionamento a 256×256, rimozione dei metadati ed esportazione WebP con qualità 80. Nessuna griglia incorporata. Ogni tile copre 6×6 m, cioè 4×4 quadretti da 64 px / 1,5 m. Le otto file di assi misurano circa 32 px in larghezza; le lastre principali circa 64–128 px.

## Prompt

Specifica comune inviata al generatore, con il materiale sostituito per ogni immagine:

> Single square SEAMLESS TILEABLE texture: [material]. For RPG battlemap, perfect orthographic overhead, diffuse uniform lighting no shadows no perspective. Restrained hand painted gouache, very LOW contrast and saturation, middle tones no blacks or whites. Broad quiet detail, no fine noise. Entire image covers 6x6 meters (4x4 game squares), final 256x256. Opposite edges must join invisibly when tiled. No grid, borders, text, objects or vignette. One tile only.

Specifiche dei materiali:

- pietra-lastricata: lastre irregolari grigio caldo, grandi 1,5–3 m, fughe sottili e poco contrastate.
- pietra-grezza: roccia continua grigia non lavorata, chiazze ampie, poche fessure superficiali.
- legno-assi: legno bruno consumato, otto file parallele, giunti sfalsati, venatura tenue.
- terra-battuta: terra compatta bruno tortora, chiazze polverose morbide, senza impronte.
- erba: prato basso verde salvia/oliva, pennellate morbide, senza fiori.
- sabbia: beige ocra grigiastro, ondulazioni basse, senza impronte o sassolini.
- acqua-bassa: acqua verde azzurra attenuata, increspature morbide, fondo sabbioso tenue, senza rive.
- acqua-profonda: blu ardesia medio, increspature ampie e deboli, senza schiuma.
- lava: terracotta e ruggine, colate larghe e croste grigio brune, senza nero o bagliori bianchi.
- ghiaccio: grigio azzurro pallido, chiazze opache, fessure rade e deboli.
- fango: terra bruna fredda, chiazze umide, senza tracce o riflessi forti.
- tappeto-rosso: tessuto rosso borgogna polveroso, variazioni morbide, senza ornamenti o bordi.

Correzione per lava e tappeto: mantenere composizione, materiale, vista e raccordi; ridurre la saturazione a circa il 40% di quella iniziale e attenuare leggermente il contrasto locale.

## Ripetizione e anteprima

Ogni WebP finale è stato decodificato e ripetuto nove volte, senza specchiature, rotazioni, sovrapposizioni o spazi, formando un mosaico 768×768. I mosaici sono stati controllati visivamente, con controllo ingrandito di lastricato e assi. Non risultano stacchi marcati; i motivi rimangono naturalmente riconoscibili quando ripetuti. La compressione con perdita non garantisce pixel identici sui bordi opposti.

`anteprima.webp` contiene tutti i mosaici 3×3 con il nome sotto, disposti in quattro colonne e tre righe. Il foglio misura 832×672 px; ciascun mosaico è ridotto a 192×192 px (tile visualizzata a 64×64). Qualità WebP 77, prossima a 80, per mantenere anche il foglio sotto 40.000 byte. Per un controllo alla scala di gioco, ripetere le singole texture senza ridimensionarle.

## Correzioni successive (29 settembre 2026)

- **tappeto-rosso.webp**: dopo il controllo nell'editor mostrava una riga
  chiara ogni tile (salto medio di luminosità fra bordi opposti 3,8 contro
  una variazione interna di 0,4: su un tessuto quasi uniforme anche un salto
  piccolo si vede). Resa continua con la tecnica classica: la tile viene
  sommata a una sua copia spostata di mezza larghezza, con un peso che vale 1
  al centro e 0 sui bordi, così ai bordi resta la copia spostata, i cui lati
  opposti vengono dall'interno dell'originale e quindi combaciano. Salto
  residuo 1,0, sotto la soglia visibile. Esportata in WebP qualità 90 invece
  di 80: a 80 la compressione rimetteva un salto di 1,2.
- **anteprima.webp** rigenerato dalle dodici tile con la stessa disposizione
  (Pillow, ricampionamento Lanczos, etichette in Noto Sans 13 px). Le frange
  chiare sul bordo esterno di alcuni mosaici vengono dal ridimensionamento
  del foglio: nelle cuciture interne e nell'editor non ci sono.

## Licenza e utilizzo

Le immagini sono output generati per il richiedente, non risorse prelevate da una libreria con licenza di terzi. Nei rapporti tra OpenAI e l'utente, i diritti sull'output spettano all'utente nei limiti consentiti dalla legge. Sono utilizzabili nel progetto, modificabili e distribuibili anche in un prodotto commerciale, nel rispetto dei termini applicabili. Non viene applicata qui una licenza pubblica aggiuntiva come CC0 o CC-BY: l'eventuale concessione di una licenza a terzi spetta al titolare del progetto. L'output AI può non essere esclusivo e la protezione mediante diritto d'autore dipende dalla legge applicabile.

Fonte: [Termini d'uso europei OpenAI, sezione Content](https://openai.com/policies/eu-terms-of-use/#content), consultati il 29 settembre 2026.

## Dimensioni dei file

Tutti i valori sono byte effettivi su disco. Le dodici texture sono WebP RGB opachi da 256×256 px, qualità 80 (il tappeto 90, vedi sopra); nessun file supera 40.000 byte.

| File | Byte |
| --- | ---: |
| pietra-lastricata.webp | 8548 |
| pietra-grezza.webp | 5264 |
| legno-assi.webp | 6882 |
| terra-battuta.webp | 3438 |
| erba.webp | 8598 |
| sabbia.webp | 4088 |
| acqua-bassa.webp | 6158 |
| acqua-profonda.webp | 1926 |
| lava.webp | 7350 |
| ghiaccio.webp | 4418 |
| fango.webp | 3430 |
| tappeto-rosso.webp | 1534 |
| anteprima.webp | 33452 |
| LEGGIMI.md | 5972 |

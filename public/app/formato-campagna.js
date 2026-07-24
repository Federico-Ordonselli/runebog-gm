/*
 * Contratto condiviso del documento campagna: cosa può entrare in Runebog.
 *
 * ESM senza dipendenze perché lo importano sia il browser sia il server Next
 * (tramite src/lib/formato-campagna.ts). Una sola definizione, sennò le due
 * metà si allontanano da sole — è la stessa ragione per cui i mostri del sito
 * si leggono dal file dell'app invece di rigenerarli.
 *
 * **Valida la FORMA, non sostituisce la bonifica.** `sanitizeState`
 * (modello.js) e le proiezioni di `share.ts` restano dove sono: qui si decide
 * se un documento è ben formato, lì si decide cosa è sicuro interpolare dentro
 * un attributo HTML. Un documento valido NON è per ciò stesso stampabile — chi
 * un domani salterà la bonifica perché "tanto è validato" introdurrà una XSS.
 *
 * **Rigido in scrittura, tollerante in lettura.** POST, PATCH e Importa
 * rifiutano: i dati nuovi devono essere puliti, e nessuno perde niente perché
 * la copia locale resta (vedi P0.1). I percorsi che APRONO qualcosa di già
 * esistente — l'editor, il tavolo, il polling — non falliscono mai: normalizzano
 * se possono e altrimenti proseguono con le difese di prima. Una campagna
 * storta va riparata, non resa inapribile: se non la si può aprire non la si
 * può nemmeno correggere.
 */

export const CURRENT_CAMPAIGN_SCHEMA_VERSION = 1;

export const CAMPAIGN_LIMITS = Object.freeze({
  requestBytes: 4 * 1024 * 1024,
  documentBytes: 4 * 1024 * 1024 - 4096,
  imageBytes: Math.floor(3.75 * 1024 * 1024),
  genericDepth: 96,
  /* Rete di sicurezza della scansione, NON un limite di prodotto: quelli sono
     `nodes`, `childrenPerNode` e compagni. Deve stare sopra ciò che
     `documentBytes` può esprimere, sennò contraddice i limiti veri — a 120.000
     mordeva a ~2.000 nodi e rendeva `nodes: 5000` irraggiungibile, cioè una
     campagna dichiarata ammessa veniva rifiutata. Misurato: 4 MiB di JSON
     contengono al massimo 2,0 milioni di valori (un array di zeri, la densità
     massima possibile) e la scansione ci mette 140 ms; una campagna vera da
     5.000 nodi con muri fa 305.016 valori in 23 ms. I byte si controllano
     sempre PRIMA del parse (requestBytes nella route, documentBytes in
     parseCampaignJson), quindi qui non arriva mai niente di illimitato. */
  genericValues: 2000000,
  genericArrayItems: 12000,
  treeDepth: 32,
  nodes: 5000,
  childrenPerNode: 600,
  edgesPerNode: 3000,
  wallsPerNode: 3000,
  foesPerNode: 1000,
  initiativePerNode: 1500,
  players: 200,
  checklist: 2000,
  idChars: 120,
  titleChars: 500,
  shortTextChars: 2000,
  longTextChars: 250000,
  coordinateAbs: 10000000,
});

const NODE_TYPES = new Set(["zona","luogo","quest","encounter","png","token","nota"]);
const STATUSES = new Set(["","da fare","in corso","fatto"]);
const SHAPES = new Set(["quartiere","edificio","stanza","piazza","torre"]);
const EDGE_TYPES = new Set(["strada","bloccata","ponte","segreto","tunnel"]);
const DOOR_TYPES = new Set(["aperta","chiusa","chiave","segreta"]);
const IMAGE_MIMES = new Set(["png","jpeg","jpg","webp","gif","avif","svg+xml"]);
const ID_RE = /^[\w-]+$/u;
const COLOR_RE = /^#[0-9a-f]{3,8}$/i;

/* L'esito è un'unione discriminata su `ok`, e i tipi sono dichiarati perché
   `tsconfig` ha `allowJs` e le route in TypeScript leggono `esito.value` dopo
   aver controllato `esito.ok`. Senza le annotazioni TS allarga `ok` a `boolean`
   — lo spread di `extra` glielo impone — e la discriminazione non scatta.

   @typedef {{code:string, message:string, path:string}} ErroreCampagna
   @typedef {{ok:true, value:any, migrated?:boolean, fromVersion?:number,
              bytes?:number, values?:number, stats?:{nodes:number}}} EsitoValido
   @typedef {{ok:false, error:ErroreCampagna}} EsitoRifiutato
   @typedef {EsitoValido|EsitoRifiutato} EsitoCampagna */

/** @returns {EsitoValido} */
const ok = (value, extra = {}) => /** @type {any} */ ({ok:true, value, ...extra});
/** @returns {EsitoRifiutato} */
const bad = (code, message, path = "$") => ({
  ok:false,
  error:{code, message, path},
});

export function utf8ByteLength(value){
  return new TextEncoder().encode(String(value)).byteLength;
}

function isObject(value){
  if(!value || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/*
 * Preflight su TUTTO il JSON, inclusi eventuali campi futuri/ignoti. Impedisce
 * che un oggetto ignorato dal validatore specifico nasconda profondità o array
 * capaci di far esplodere JSON.stringify e funzioni ricorsive successive.
 */
/** @returns {EsitoCampagna} */
export function scanJsonLimits(value, limits = CAMPAIGN_LIMITS){
  const stack = [{value, depth:0, path:"$"}];
  const seen = new WeakSet();
  let values = 0;

  while(stack.length){
    const item = stack.pop();
    values++;
    if(values > limits.genericValues)
      return bad("too_many_values", `Il documento supera ${limits.genericValues} valori`, item.path);
    if(item.depth > limits.genericDepth)
      return bad("json_too_deep", `Il JSON supera ${limits.genericDepth} livelli`, item.path);

    const current = item.value;
    if(current === null || typeof current === "boolean" || typeof current === "string") continue;
    if(typeof current === "number"){
      if(!Number.isFinite(current)) return bad("non_finite_number", "Numero non finito", item.path);
      continue;
    }
    if(typeof current !== "object")
      return bad("unsupported_value", "Valore non rappresentabile in JSON", item.path);
    if(seen.has(current))
      return bad("cyclic_or_shared", "Il documento contiene riferimenti ciclici o condivisi", item.path);
    seen.add(current);

    if(Array.isArray(current)){
      if(current.length > limits.genericArrayItems)
        return bad("array_too_large", `Array oltre ${limits.genericArrayItems} elementi`, item.path);
      for(let i=current.length-1; i>=0; i--)
        stack.push({value:current[i], depth:item.depth+1, path:`${item.path}[${i}]`});
      continue;
    }
    if(!isObject(current)) return bad("non_plain_object", "Oggetto non semplice", item.path);
    const entries = Object.entries(current);
    for(let i=entries.length-1; i>=0; i--){
      const [key, child] = entries[i];
      stack.push({value:child, depth:item.depth+1, path:`${item.path}.${key}`});
    }
  }
  return ok(value, {values});
}

/* Un id per ciò che il formato storico non ne aveva. Non deve essere
   irripetibile in assoluto — solo distinguere due voci nello stesso documento,
   che è il lavoro che l'app gli chiede (`x.id !== c.id` in checklist.js). La
   forma è quella di `uid()`: base36 corto, dentro ID_RE. */
let contatoreId = 0;
const idGenerato = () =>
  `m${(++contatoreId).toString(36)}${Math.random().toString(36).slice(2,8)}`;

function migrateV0ToV1(document){
  /*
   * v0 è il formato storico privo di schemaVersion.
   *
   * I default qui sotto NON allargano lo schema: lo ricalcano. Ognuno è una
   * forma che l'editor tratta già come legittima e che rendeva in un modo
   * preciso, e il default è quello che rendeva. Allargare il validatore avrebbe
   * reso il difetto permanente e invisibile; una migrazione lo ripara al primo
   * salvataggio e lascia il contratto stretto — è la regola scritta nel README
   * del pacchetto, e vale la pena rispettarla proprio qui.
   *
   * Le migrazioni VISUALI (plan, tokenColor, centratura dei segnalini) restano
   * in `migrateState`: non servono a convalidare il contratto, e portarle qui
   * vorrebbe dire farle girare anche sul server, che non disegna niente.
   */
  if(document.checklist === undefined) document.checklist = [];
  if(document.players === undefined) document.players = [];

  const radice = document.root;
  const stack = radice ? [radice] : [];
  while(stack.length){
    const node = stack.pop();
    if(!isObject(node)) continue;
    if(node.id === undefined) node.id = idGenerato();
    if(node.title === undefined) node.title = "";
    /* Senza `type`, `isMarker` (modello.js) dà true e la bolla esce come
       segnalino grigio, cioè una nota — tranne la radice, che non è una bolla
       ma il contenitore del livello, ed è una zona. Il default è ciò che si
       vedeva, non ciò che sarebbe stato più sensato scegliere allora. */
    if(node.type === undefined) node.type = node === radice ? "zona" : "nota";
    if(node.status === undefined) node.status = "";
    if(node.notes === undefined) node.notes = "";
    if(node.img === undefined) node.img = null;
    if(node.x === undefined) node.x = null;
    if(node.y === undefined) node.y = null;
    if(node.shape === undefined) node.shape = null;
    if(node.children === undefined) node.children = [];
    if(node.edges === undefined) node.edges = [];
    // `bg.opacity ?? 0.6` sta in due render (mappa.js, pannello.js): uno sfondo
    // senza opacità è uno sfondo al 60%, non uno sfondo rotto.
    if(isObject(node.bg) && node.bg.opacity === undefined) node.bg.opacity = 0.6;
    if(Array.isArray(node.edges))
      for(const edge of node.edges)
        if(isObject(edge) && edge.id === undefined) edge.id = idGenerato();
    if(isObject(node.monster) && Array.isArray(node.monster.foes))
      for(const foe of node.monster.foes)
        if(isObject(foe) && foe.id === undefined) foe.id = idGenerato();
    if(Array.isArray(node.children))
      for(let i=node.children.length-1; i>=0; i--) stack.push(node.children[i]);
  }
  if(Array.isArray(document.players)){
    for(const player of document.players){
      if(!isObject(player)) continue;
      if(player.id === undefined) player.id = idGenerato();
      if(player.name === undefined) player.name = "";
      if(player.cls === undefined) player.cls = "";
      if(player.hp === undefined) player.hp = 20;
      if(player.hpMax === undefined) player.hpMax = 20;
      if(player.notes === undefined) player.notes = "";
    }
  }
  if(Array.isArray(document.checklist)){
    for(const item of document.checklist){
      if(!isObject(item)) continue;
      // Due voci senza id sono la STESSA voce per `x.id !== c.id`: cancellarne
      // una le cancellava entrambe. Darglielo non è solo conformità.
      if(item.id === undefined) item.id = idGenerato();
      if(item.text === undefined) item.text = "";
      if(item.done === undefined) item.done = false;
    }
  }
  document.schemaVersion = 1;
  return document;
}

export const CAMPAIGN_MIGRATIONS = Object.freeze({
  0: migrateV0ToV1,
});

/** @returns {EsitoCampagna} */
export function migrateCampaignDocument(document){
  if(!isObject(document)) return bad("not_an_object", "La campagna deve essere un oggetto");
  let version = document.schemaVersion === undefined ? 0 : document.schemaVersion;
  if(!Number.isSafeInteger(version) || version < 0)
    return bad("invalid_schema_version", "schemaVersion deve essere un intero non negativo", "$.schemaVersion");
  if(version > CURRENT_CAMPAIGN_SCHEMA_VERSION)
    return bad(
      "future_schema_version",
      `La campagna usa lo schema ${version}, ma questa versione supporta fino a ${CURRENT_CAMPAIGN_SCHEMA_VERSION}`,
      "$.schemaVersion",
    );

  const fromVersion = version;
  while(version < CURRENT_CAMPAIGN_SCHEMA_VERSION){
    const migration = CAMPAIGN_MIGRATIONS[version];
    if(!migration)
      return bad("missing_migration", `Manca la migrazione dallo schema ${version}`, "$.schemaVersion");
    migration(document);
    version = document.schemaVersion;
  }
  return ok(document, {fromVersion, migrated:fromVersion !== version});
}

function requireArray(value, max, path){
  if(!Array.isArray(value)) return bad("expected_array", "Deve essere un array", path);
  if(value.length > max) return bad("too_many_items", `Massimo ${max} elementi`, path);
  return null;
}

function requireObject(value, path){
  return isObject(value) ? null : bad("expected_object", "Deve essere un oggetto", path);
}

function validateString(value, max, path, {nullable=false, empty=true} = {}){
  if(nullable && value === null) return null;
  if(typeof value !== "string") return bad("expected_string", "Deve essere testo", path);
  if(!empty && value.length === 0) return bad("empty_string", "Non può essere vuoto", path);
  if(value.length > max) return bad("text_too_long", `Massimo ${max} caratteri`, path);
  return null;
}

function validateOptionalString(value, max, path){
  return value === undefined ? null : validateString(value, max, path);
}

function validateId(value, path){
  const error = validateString(value, CAMPAIGN_LIMITS.idChars, path, {empty:false});
  if(error) return error;
  return ID_RE.test(value) ? null : bad("invalid_id", "ID ammesso: lettere, numeri, _ e -", path);
}

function validateNumber(value, path, {nullable=false, min=-Infinity, max=Infinity, integer=false} = {}){
  if(nullable && value === null) return null;
  if(typeof value !== "number" || !Number.isFinite(value))
    return bad("expected_number", "Deve essere un numero finito", path);
  if(integer && !Number.isInteger(value)) return bad("expected_integer", "Deve essere un intero", path);
  if(value < min || value > max) return bad("number_out_of_range", `Valore ammesso: ${min}…${max}`, path);
  return null;
}

function validateOptionalNumber(value, path, options){
  return value === undefined ? null : validateNumber(value, path, options);
}

/* Deve restare **almeno stretto quanto** `safeUrl` in modello.js e in share.ts:
   là un'immagine con dentro spazi, virgolette o angolari viene buttata perché
   uscirebbe dall'attributo `src`. Se qui passasse, un documento sarebbe
   "valido" e comunque impresentabile — e prima o poi qualcuno tratterebbe la
   validità come permesso di stampare. I tre elenchi si toccano insieme. */
const FUORI_DALL_ATTRIBUTO = /[\s"'<>`]/;

function validateImage(value, path){
  if(value === null || value === undefined) return null;
  if(typeof value !== "string") return bad("invalid_image", "L'immagine deve essere una stringa o null", path);
  if(FUORI_DALL_ATTRIBUTO.test(value))
    return bad("invalid_image", "L'immagine contiene caratteri non ammessi in un attributo", path);
  if(/^https?:\/\//i.test(value)){
    return value.length <= 4096 ? null : bad("image_url_too_long", "URL immagine troppo lungo", path);
  }
  const match = value.match(/^data:image\/([^;,]+);(base64|utf8),/i);
  if(!match || !IMAGE_MIMES.has(match[1].toLowerCase()))
    return bad("invalid_image_type", "Tipo immagine non ammesso", path);
  if(utf8ByteLength(value) > CAMPAIGN_LIMITS.imageBytes)
    return bad("image_too_large", "Immagine incorporata troppo grande", path);
  return null;
}

function validateWall(wall, path){
  let error = requireObject(wall, path);
  if(error) return error;
  if((error = validateId(wall.id, `${path}.id`))) return error;
  for(const key of ["x","y"]){
    if((error = validateNumber(wall[key], `${path}.${key}`, {
      min:-CAMPAIGN_LIMITS.coordinateAbs, max:CAMPAIGN_LIMITS.coordinateAbs,
    }))) return error;
  }
  if(wall.dir !== "h" && wall.dir !== "v") return bad("invalid_wall_direction", "Direzione muro non valida", `${path}.dir`);
  // WALL_MIN/WALL_MAX di modello.js. Ricopiati perché questo modulo gira anche
  // sul server, dove modello.js non si importa: se cambiano lì, cambiano qui.
  if((error = validateNumber(wall.len, `${path}.len`, {integer:true, min:1, max:200}))) return error;
  if(wall.porta !== undefined && !DOOR_TYPES.has(wall.porta))
    return bad("invalid_door_type", "Tipo porta non valido", `${path}.porta`);
  return null;
}

function validateEdge(edge, path){
  let error = requireObject(edge, path);
  if(error) return error;
  for(const key of ["id","a","b"]){
    if((error = validateId(edge[key], `${path}.${key}`))) return error;
  }
  if(!EDGE_TYPES.has(edge.type)) return bad("invalid_edge_type", "Tipo collegamento non valido", `${path}.type`);
  if((error = validateOptionalString(edge.label, CAMPAIGN_LIMITS.shortTextChars, `${path}.label`))) return error;
  if((error = validateOptionalString(edge.notes, CAMPAIGN_LIMITS.longTextChars, `${path}.notes`))) return error;
  return null;
}

function validateMonster(monster, path){
  if(monster === undefined) return null;
  let error = requireObject(monster, path);
  if(error) return error;
  const shortFields = ["meta","ac","init","speed","saves","skills","resist","senses","langs","cr","gear"];
  const longFields = ["traits","actions","legendary","moves","special"];
  for(const key of shortFields)
    if((error = validateOptionalString(monster[key], CAMPAIGN_LIMITS.shortTextChars, `${path}.${key}`))) return error;
  for(const key of longFields)
    if((error = validateOptionalString(monster[key], CAMPAIGN_LIMITS.longTextChars, `${path}.${key}`))) return error;
  for(const key of ["str","dex","con","int","wis","cha","hpDefault"])
    if((error = validateOptionalNumber(monster[key], `${path}.${key}`, {min:-1000000,max:1000000}))) return error;
  if(monster.foes !== undefined){
    if((error = requireArray(monster.foes, CAMPAIGN_LIMITS.foesPerNode, `${path}.foes`))) return error;
    for(let i=0; i<monster.foes.length; i++){
      const foe = monster.foes[i], fp = `${path}.foes[${i}]`;
      if((error = requireObject(foe, fp))) return error;
      if((error = validateId(foe.id, `${fp}.id`))) return error;
      if((error = validateString(foe.name, CAMPAIGN_LIMITS.titleChars, `${fp}.name`))) return error;
      if((error = validateNumber(foe.hp, `${fp}.hp`, {min:0,max:1000000}))) return error;
      if((error = validateNumber(foe.hpMax, `${fp}.hpMax`, {min:1,max:1000000}))) return error;
    }
  }
  return null;
}

function validateBattle(battle, path){
  if(battle === undefined) return null;
  let error = requireObject(battle, path);
  if(error) return error;
  if((error = validateNumber(battle.round, `${path}.round`, {integer:true,min:1,max:1000000}))) return error;
  if((error = validateNumber(battle.turn, `${path}.turn`, {integer:true,min:0,max:1000000}))) return error;
  if((error = requireArray(battle.order, CAMPAIGN_LIMITS.initiativePerNode, `${path}.order`))) return error;
  for(let i=0; i<battle.order.length; i++){
    const entry = battle.order[i], ep = `${path}.order[${i}]`;
    if((error = requireObject(entry, ep))) return error;
    if((error = validateId(entry.id, `${ep}.id`))) return error;
    if(entry.kind !== "pg" && entry.kind !== "foe")
      return bad("invalid_combatant_kind", "Tipo combattente non valido", `${ep}.kind`);
    if((error = validateNumber(entry.init, `${ep}.init`, {min:-1000000,max:1000000}))) return error;
    for(const key of ["playerId","nodeId","foeId"])
      if(entry[key] !== undefined && (error = validateId(entry[key], `${ep}.${key}`))) return error;
    if((error = validateOptionalNumber(entry.des, `${ep}.des`, {min:-1000000,max:1000000}))) return error;
  }
  return null;
}

function validateNodeShallow(node, path){
  let error = requireObject(node, path);
  if(error) return error;
  if((error = validateId(node.id, `${path}.id`))) return error;
  if((error = validateString(node.title, CAMPAIGN_LIMITS.titleChars, `${path}.title`))) return error;
  if(!NODE_TYPES.has(node.type)) return bad("invalid_node_type", "Tipo nodo non valido", `${path}.type`);
  if(!STATUSES.has(node.status)) return bad("invalid_status", "Stato non valido", `${path}.status`);
  if((error = validateString(node.notes, CAMPAIGN_LIMITS.longTextChars, `${path}.notes`))) return error;
  if((error = validateOptionalString(node.playerNotes, CAMPAIGN_LIMITS.longTextChars, `${path}.playerNotes`))) return error;
  if((error = validateImage(node.img, `${path}.img`))) return error;
  if((error = requireArray(node.children, CAMPAIGN_LIMITS.childrenPerNode, `${path}.children`))) return error;
  if((error = requireArray(node.edges, CAMPAIGN_LIMITS.edgesPerNode, `${path}.edges`))) return error;
  if(node.shape !== null && node.shape !== undefined && !SHAPES.has(node.shape))
    return bad("invalid_shape", "Forma non valida", `${path}.shape`);
  if(node.shared !== undefined && typeof node.shared !== "boolean")
    return bad("expected_boolean", "shared deve essere booleano", `${path}.shared`);
  if(node.walls !== undefined && typeof node.walls !== "boolean")
    return bad("expected_boolean", "walls deve essere booleano", `${path}.walls`);
  // `color: null` è un gesto dell'app, non un dato rotto: il campione
  // "Predefinito della forma" nel pannello fa `editNode('color', null)` per
  // tornare al default (come `img: null` col bottone Rimuovi). Trovato al primo
  // smoke test in produzione: il 422 bloccava il salvataggio di una campagna
  // il cui unico torto era un click legittimo.
  if(node.color !== undefined && node.color !== null && !COLOR_RE.test(node.color))
    return bad("invalid_color", "Colore non valido", `${path}.color`);
  for(const key of ["x","y","w","h"]){
    if((error = validateOptionalNumber(node[key], `${path}.${key}`, {
      nullable:true, min:-CAMPAIGN_LIMITS.coordinateAbs, max:CAMPAIGN_LIMITS.coordinateAbs,
    }))) return error;
  }
  if(node.playerId !== undefined && (error = validateId(node.playerId, `${path}.playerId`))) return error;
  if(node.foe !== undefined){
    if((error = requireObject(node.foe, `${path}.foe`))) return error;
    if((error = validateId(node.foe.nodeId, `${path}.foe.nodeId`))) return error;
    if((error = validateId(node.foe.foeId, `${path}.foe.foeId`))) return error;
  }
  if(node.bg !== undefined){
    if((error = requireObject(node.bg, `${path}.bg`))) return error;
    if((error = validateImage(node.bg.img, `${path}.bg.img`))) return error;
    for(const key of ["x","y","w","h"])
      if((error = validateNumber(node.bg[key], `${path}.bg.${key}`, {
        min:-CAMPAIGN_LIMITS.coordinateAbs,max:CAMPAIGN_LIMITS.coordinateAbs,
      }))) return error;
    if((error = validateNumber(node.bg.opacity, `${path}.bg.opacity`, {min:0,max:1}))) return error;
  }
  if(node.wallSegs !== undefined){
    if((error = requireArray(node.wallSegs, CAMPAIGN_LIMITS.wallsPerNode, `${path}.wallSegs`))) return error;
    for(let i=0; i<node.wallSegs.length; i++)
      if((error = validateWall(node.wallSegs[i], `${path}.wallSegs[${i}]`))) return error;
  }
  for(let i=0; i<node.edges.length; i++)
    if((error = validateEdge(node.edges[i], `${path}.edges[${i}]`))) return error;
  if((error = validateMonster(node.monster, `${path}.monster`))) return error;
  if((error = validateBattle(node.battle, `${path}.battle`))) return error;
  return null;
}

/** @returns {EsitoCampagna} */
export function validateCampaignDocument(document){
  let error = requireObject(document, "$");
  if(error) return error;
  if(document.schemaVersion !== CURRENT_CAMPAIGN_SCHEMA_VERSION)
    return bad("unsupported_schema_version", "Versione schema non normalizzata", "$.schemaVersion");
  if((error = requireArray(document.checklist, CAMPAIGN_LIMITS.checklist, "$.checklist"))) return error;
  if((error = requireArray(document.players, CAMPAIGN_LIMITS.players, "$.players"))) return error;

  const ids = new Set();
  const stack = [{node:document.root, depth:0, path:"$.root"}];
  let nodes = 0;
  while(stack.length){
    const current = stack.pop();
    nodes++;
    if(nodes > CAMPAIGN_LIMITS.nodes)
      return bad("too_many_nodes", `Massimo ${CAMPAIGN_LIMITS.nodes} nodi`, current.path);
    if(current.depth > CAMPAIGN_LIMITS.treeDepth)
      return bad("tree_too_deep", `Massimo ${CAMPAIGN_LIMITS.treeDepth} livelli di mappa`, current.path);
    if((error = validateNodeShallow(current.node, current.path))) return error;
    if(ids.has(current.node.id)) return bad("duplicate_node_id", "ID nodo duplicato", `${current.path}.id`);
    ids.add(current.node.id);
    for(let i=current.node.children.length-1; i>=0; i--)
      stack.push({
        node:current.node.children[i],
        depth:current.depth+1,
        path:`${current.path}.children[${i}]`,
      });
  }

  const playerIds = new Set();
  for(let i=0; i<document.players.length; i++){
    const player = document.players[i], path = `$.players[${i}]`;
    if((error = requireObject(player, path))) return error;
    if((error = validateId(player.id, `${path}.id`))) return error;
    if(playerIds.has(player.id)) return bad("duplicate_player_id", "ID giocatore duplicato", `${path}.id`);
    playerIds.add(player.id);
    if((error = validateString(player.name, CAMPAIGN_LIMITS.titleChars, `${path}.name`))) return error;
    if((error = validateString(player.cls, CAMPAIGN_LIMITS.shortTextChars, `${path}.cls`))) return error;
    if((error = validateString(player.notes, CAMPAIGN_LIMITS.longTextChars, `${path}.notes`))) return error;
    if((error = validateNumber(player.hp, `${path}.hp`, {min:0,max:1000000}))) return error;
    if((error = validateNumber(player.hpMax, `${path}.hpMax`, {min:1,max:1000000}))) return error;
  }

  const checklistIds = new Set();
  for(let i=0; i<document.checklist.length; i++){
    const item = document.checklist[i], path = `$.checklist[${i}]`;
    if((error = requireObject(item, path))) return error;
    if((error = validateId(item.id, `${path}.id`))) return error;
    if(checklistIds.has(item.id)) return bad("duplicate_checklist_id", "ID checklist duplicato", `${path}.id`);
    checklistIds.add(item.id);
    if((error = validateString(item.text, CAMPAIGN_LIMITS.longTextChars, `${path}.text`))) return error;
    if(typeof item.done !== "boolean") return bad("expected_boolean", "done deve essere booleano", `${path}.done`);
  }

  return ok(document, {stats:{nodes}});
}

/** @returns {EsitoCampagna} */
export function prepareCampaignDocument(document, options = {}){
  const scan = scanJsonLimits(document, options.limits || CAMPAIGN_LIMITS);
  if(!scan.ok) return scan;

  const migration = migrateCampaignDocument(document);
  if(!migration.ok) return migration;

  const validation = validateCampaignDocument(document);
  if(!validation.ok) return validation;

  let normalizedBytes;
  try{ normalizedBytes = utf8ByteLength(JSON.stringify(document)); }
  catch(_){ return bad("not_serializable", "La campagna non è serializzabile"); }
  const bytes = Math.max(options.sourceBytes || 0, normalizedBytes);
  if(bytes > CAMPAIGN_LIMITS.documentBytes)
    return bad("document_too_large", `La campagna supera ${CAMPAIGN_LIMITS.documentBytes} byte UTF-8`);

  return ok(document, {
    migrated:migration.migrated,
    fromVersion:migration.fromVersion,
    bytes,
    stats:validation.stats,
  });
}

/** @returns {EsitoCampagna} */
export function parseCampaignJson(text){
  if(typeof text !== "string") return bad("expected_text", "Il file deve contenere testo JSON");
  const bytes = utf8ByteLength(text);
  if(bytes > CAMPAIGN_LIMITS.documentBytes)
    return bad("document_too_large", `Il file supera ${CAMPAIGN_LIMITS.documentBytes} byte UTF-8`);
  let document;
  try{ document = JSON.parse(text); }
  catch(_){ return bad("invalid_json", "JSON non valido"); }
  return prepareCampaignDocument(document, {sourceBytes:bytes});
}

/* Il percorso si tronca perché un pezzo lo scrive il file: dentro `$.root.…`
   ci finiscono i nomi delle chiavi trovate, e una chiave lunga 250.000
   caratteri farebbe un avviso alto quanto lo schermo. Non è una questione di
   sicurezza — il messaggio va in `textContent` — ma di leggibilità: chi legge
   deve capire dove guardare. */
const PERCORSO_MAX = 120;

export function campaignErrorMessage(error){
  if(!error) return "Campagna non valida.";
  if(!error.path || error.path === "$") return error.message;
  const path = error.path.length > PERCORSO_MAX
    ? error.path.slice(0, PERCORSO_MAX) + "…" : error.path;
  return `${error.message} (${path})`;
}

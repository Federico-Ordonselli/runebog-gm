/* La formattazione delle caselle di testo (24 set 2026). L'uscita va dentro
   un foreignObject con innerHTML: il testo è del DM, ma una campagna può
   arrivare da un file altrui, quindi i soli tag possibili sono i nostri. */
import test from "node:test";
import assert from "node:assert/strict";
import { repoUrl } from "../critici/_repo.mjs";

const { testoRicco, testoSemplice, avvolgi, prefissaRighe } = await import(repoUrl("public/app/testo-ricco.js"));

test("nessun markup dell'utente sopravvive", ()=>{
  const out = testoRicco(`# <img src=x onerror=alert(1)>\n- **<script>x</script>**\n"'&`);
  assert.doesNotMatch(out, /<img|<script/);
  assert.match(out, /&lt;img/);
  const tag = [...out.matchAll(/<\/?([a-z0-9]+)/g)].map(m=>m[1]);
  for(const t of tag) assert.ok(["div","span","b","i","s","hr"].includes(t), t);
  // attributi: solo class e aria-hidden, scritti da noi
  for(const m of out.matchAll(/<[a-z]+\s([^>]*)>/g))
    assert.match(m[1], /^(class="[\w -]+"( aria-hidden="true")?)$/, m[1]);
});

test("titoli, elenchi, rientro e stili in linea", ()=>{
  assert.equal(testoRicco("# Missioni"), `<div class="tr-t1">Missioni</div>`);
  assert.equal(testoRicco("-# nota"), `<div class="tr-piccolo">nota</div>`);
  assert.match(testoRicco("  - voce"), /class="tr-li tr-in1"/);
  assert.match(testoRicco("2) seconda"), /<span class="tr-mk">2\)<\/span>seconda/);
  assert.equal(testoRicco("**forte** e *piano* e ~~fatto~~"),
    `<div class="tr-p"><b>forte</b> e <i>piano</i> e <s>fatto</s></div>`);
  assert.equal(testoRicco("2*3*4 e nome_di_file"), `<div class="tr-p">2*3*4 e nome_di_file</div>`);
  assert.equal(testoRicco("---"), `<hr class="tr-hr">`);
  assert.equal(testoRicco("a\n\nb"), `<div class="tr-p">a</div><div class="tr-vuota"></div><div class="tr-p">b</div>`);
  assert.equal(testoSemplice("# Titolo\n- **uno**\n1. due *tre*"), "Titolo uno due tre");
});

test("i comandi del pannello mettono e tolgono", ()=>{
  const b = avvolgi("ciao mondo", 5, 10, "**");
  assert.deepEqual(b, {testo:"ciao **mondo**", inizio:7, fine:12});
  assert.deepEqual(avvolgi(b.testo, b.inizio, b.fine, "**"), {testo:"ciao mondo", inizio:5, fine:10});

  const l = prefissaRighe("uno\ndue\n\ntre", 0, 7, "- ");
  assert.equal(l.testo, "- uno\n- due\n\ntre");
  assert.equal(prefissaRighe(l.testo, 0, 3, "- ").testo, "uno\n- due\n\ntre", "ripremere toglie");
  assert.equal(prefissaRighe("## vecchio", 3, 3, "# ").testo, "# vecchio", "un titolo sostituisce l'altro");
  assert.equal(prefissaRighe("a\nb\nc", 0, 5, "1. ").testo, "1. a\n2. b\n3. c");
  assert.equal(prefissaRighe("  - voce", 4, 4, null).testo, "  voce");
});

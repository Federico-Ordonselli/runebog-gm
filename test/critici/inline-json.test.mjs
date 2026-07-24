import test from "node:test";
import assert from "node:assert/strict";
import { repoUrl } from "./_repo.mjs";

const { jsonForScript } = await import(repoUrl("src/lib/inline-json.ts"));

test("jsonForScript neutralizza la chiusura del tag script", ()=>{
  const source = "</script><script>globalThis.compromesso=true</script>";
  const encoded = jsonForScript({source});
  assert.equal(encoded.includes("</script>"), false);
  assert.equal(encoded.includes("<script>"), false);
  assert.deepEqual(JSON.parse(encoded), {source});
});

test("jsonForScript neutralizza U+2028 e U+2029 senza cambiare il valore", ()=>{
  const value = {text:"prima\u2028mezzo\u2029dopo"};
  const encoded = jsonForScript(value);
  assert.equal(encoded.includes("\u2028"), false, "nessun separatore U+2028 letterale");
  assert.equal(encoded.includes("\u2029"), false, "nessun separatore U+2029 letterale");
  assert.match(encoded, /\\u2028/);
  assert.match(encoded, /\\u2029/);
  assert.deepEqual(JSON.parse(encoded), value);
});

test("jsonForScript resta JSON valido con virgolette, backslash e HTML", ()=>{
  const value = {text:'"</script>\\&<b>test</b>'};
  assert.deepEqual(JSON.parse(jsonForScript(value)), value);
});

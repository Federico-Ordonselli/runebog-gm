/* PostgreSQL reale, dati sintetici in un database temporaneo del contenitore
   runebog-todo-test. Le query importate sono quelle eseguite dall'app. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PgDialect } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { consumeResetTokenSql, resetPasswordSql } from '../../src/lib/reset-token-sql.ts';
import { lockImageOwnerSql,lockCampaignSql,insertCampaignImageSql,ownsImageReferencesSql,
  markOrphanImagesSql,deleteOrphanImagesSql,CAMPAIGN_IMAGE_BYTES,CAMPAIGN_IMAGE_COUNT } from '../../src/lib/campaign-images-sql.ts';

const container=process.env.TEST_PG_CONTAINER || 'runebog-todo-test';
const database='test_'+randomUUID().replaceAll('-','');
function psql(text, db=database){
  return new Promise((resolve,reject)=>{
    const p=spawn('docker',['exec','-i',container,'psql','-U','postgres','-d',db,'-XqAt','-v','ON_ERROR_STOP=1']);
    let out='',err=''; p.stdout.on('data',s=>out+=s);p.stderr.on('data',s=>err+=s);
    p.on('error',reject);p.on('exit',code=>code===0?resolve(out.trim()):reject(new Error(err)));
    p.stdin.end(text);
  });
}
const dialect=new PgDialect(); let seq=0;
function prepared(query){
  const q=dialect.sqlToQuery(query),name='q'+seq++;
  const args=q.params.map(v=>v===null?'NULL':typeof v==='number'?String(v):"'"+String(v).replaceAll("'","''")+"'");
  return `PREPARE ${name} AS ${q.sql}; EXECUTE ${name}${args.length?'('+args.join(',')+')':''};`;
}
const run=q=>psql(prepared(q));
const batch=queries=>psql('BEGIN;'+queries.map(prepared).join('\n')+'COMMIT;');
const id=randomUUID(), id2=randomUUID();
let checks=0;
await psql('CREATE DATABASE '+database,'postgres');
try{
  for(const file of ['0000_iniziale.sql','0001_revisione-campagna.sql','0002_immagini-fuori-dal-json.sql'])
    await psql(await readFile(new URL('../../drizzle/'+file,import.meta.url),'utf8'));
  await psql(`INSERT INTO "user" (id,password_hash) VALUES ('u','prima'),('altro','prima');
    INSERT INTO campaign (id,user_id,data) VALUES ('${id}','u','{"root":{"children":[]}}'),('${id2}','altro','{"root":{}}');`);
  async function token(name,expired=false){
    await psql(`INSERT INTO password_reset_token VALUES ('${name}','u',now()+interval '${expired?'-1':'1'} hour')`);
  }
  await token('uno');
  const consumed=await Promise.all([run(consumeResetTokenSql('uno')),run(consumeResetTokenSql('uno'))]);
  assert.equal(consumed.filter(v=>v==='u').length,1); checks++;
  assert.equal(await run(consumeResetTokenSql('uno')),'');
  await token('scaduto',true);assert.equal(await run(consumeResetTokenSql('scaduto')),''); checks++;
  await token('corsa');
  const results=await Promise.all(Array.from({length:8},(_,i)=>run(resetPasswordSql('corsa','nuova'+i))));
  assert.equal(results.filter(Boolean).length,1);
  assert.equal(await psql(`SELECT password_hash FROM "user" WHERE id='u'`),'nuova'+results.findIndex(Boolean)); checks++;
  await psql(`ALTER TABLE "user" ADD CONSTRAINT password_di_prova CHECK(password_hash <> 'fallisci')`);
  await token('rollback');
  await assert.rejects(run(resetPasswordSql('rollback','fallisci')));
  assert.equal(await run(resetPasswordSql('rollback','valida')),'u'); checks++;

  const upload=(camp,user,key,bytes=Buffer.from('pixel'))=>batch([
    lockImageOwnerSql(user),lockCampaignSql(camp,user),markOrphanImagesSql(camp,user),deleteOrphanImagesSql(camp,user),
    insertCampaignImageSql(camp,user,key,'image/png',bytes),
  ]);
  await upload(id,'u','riferita'); await upload(id,'u','orfana'); await upload(id,'u','recente');
  await upload(id2,'altro','altrui');
  await upload(id,'altro','vietata');
  assert.equal(await psql("SELECT count(*) FROM campaign_image WHERE id='vietata'"),'0'); checks++;
  assert.equal(await run(sql`SELECT ${ownsImageReferencesSql(id,['riferita'])}`),'t');
  assert.equal(await run(sql`SELECT ${ownsImageReferencesSql(id,['altrui'])}`),'f');
  assert.equal(await run(sql`SELECT ${ownsImageReferencesSql(id,['mancante'])}`),'f'); checks++;
  await psql(`UPDATE campaign SET data='{"root":{"img":"/immagini/riferita","children":[]}}' WHERE id='${id}'`);
  await batch([lockCampaignSql(id,'u'),markOrphanImagesSql(id,'u'),deleteOrphanImagesSql(id,'u')]);
  assert.equal(await psql("SELECT orphan_since IS NULL FROM campaign_image WHERE id='riferita'"),'t');
  assert.equal(await psql("SELECT orphan_since IS NOT NULL FROM campaign_image WHERE id='orfana'"),'t'); checks++;
  await psql("UPDATE campaign_image SET orphan_since=now()-interval '31 days' WHERE id IN ('orfana','riferita')");
  await batch([lockCampaignSql(id,'u'),markOrphanImagesSql(id,'u'),deleteOrphanImagesSql(id,'u')]);
  assert.equal(await psql("SELECT count(*) FROM campaign_image WHERE id='orfana'"),'0');
  assert.equal(await psql("SELECT count(*) FROM campaign_image WHERE id IN ('riferita','recente')"),'2'); checks++;
  await psql(`DELETE FROM campaign_image WHERE campaign_id='${id}';
    INSERT INTO campaign_image(id,campaign_id,mime,bytes) VALUES ('quota','${id}','image/png',decode(repeat('00',${CAMPAIGN_IMAGE_BYTES-1}),'hex'));`);
  await Promise.all([upload(id,'u','ultimo1',Buffer.from('x')),upload(id,'u','ultimo2',Buffer.from('x'))]);
  assert.equal(await psql("SELECT count(*) FROM campaign_image WHERE id IN ('ultimo1','ultimo2')"),'1'); checks++;
  await psql(`DELETE FROM campaign_image WHERE campaign_id='${id}';
    INSERT INTO campaign_image(id,campaign_id,mime,bytes)
      SELECT 'conta-' || n, '${id}', 'image/png', decode('01','hex') FROM generate_series(1,${CAMPAIGN_IMAGE_COUNT}) n;`);
  await upload(id,'u','oltre-conteggio',Buffer.from('x'));
  assert.equal(await psql("SELECT count(*) FROM campaign_image WHERE id='oltre-conteggio'"),'0');checks++;
  await psql(`DELETE FROM campaign_image WHERE campaign_id='${id}';
    WITH nuove AS (INSERT INTO campaign(user_id,data) SELECT 'u','{}' FROM generate_series(1,4) RETURNING id)
    INSERT INTO campaign_image(id,campaign_id,mime,bytes)
      SELECT 'budget-' || id,id,'image/png',decode(repeat('00',${CAMPAIGN_IMAGE_BYTES}),'hex') FROM nuove;`);
  await upload(id,'u','oltre-account',Buffer.from('x'));
  assert.equal(await psql("SELECT count(*) FROM campaign_image WHERE id='oltre-account'"),'0');checks++;
  await psql(`DELETE FROM campaign WHERE id='${id}'`);
  assert.equal(await psql(`SELECT count(*) FROM campaign_image WHERE campaign_id='${id}'`),'0'); checks++;
  await psql("DELETE FROM \"user\" WHERE id='altro'");
  assert.equal(await psql(`SELECT count(*) FROM campaign_image WHERE campaign_id='${id2}'`),'0'); checks++;
  console.log(`${checks} controlli PostgreSQL superati: concorrenza, rollback, proprietà, quote, orfani e cascate.`);
}finally{
  await psql('DROP DATABASE '+database+' WITH (FORCE)','postgres');
}

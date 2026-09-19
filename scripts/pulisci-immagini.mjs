/* Di default conta soltanto; --apply marca gli orfani e rimuove quelli oltre
   i 30 giorni. Serve anche per campagne inattive, mai visitate dallo spazzino
   automatico di PATCH/upload. Usa soltanto DATABASE_URL già esistente. */
import { neon } from '@neondatabase/serverless';
import { PgDialect } from 'drizzle-orm/pg-core';
import { lockCampaignSql,markOrphanImagesSql,deleteOrphanImagesSql,countExpiredImagesSql } from '../src/lib/campaign-images-sql.ts';

if(!process.env.DATABASE_URL) throw new Error('Impostare DATABASE_URL (oppure usare node --env-file=.env).');
if(process.argv.slice(2).some(a=>a!=='--apply')) throw new Error('Unica opzione ammessa: --apply. Senza opzioni non modifica il database.');
const client=neon(process.env.DATABASE_URL),dialect=new PgDialect();
const query=statement=>{const q=dialect.sqlToQuery(statement);return client(q.sql,q.params);};
const apply=process.argv.includes('--apply');
const campaigns=await client('SELECT id,user_id FROM campaign');
let images=0,bytes=0;
for(const c of campaigns){
  if(apply){
    const result=await client.transaction([
      query(lockCampaignSql(c.id,c.user_id)),query(markOrphanImagesSql(c.id,c.user_id)),
      query(countExpiredImagesSql(c.id,c.user_id)),query(deleteOrphanImagesSql(c.id,c.user_id)),
    ]);
    images+=Number(result[2][0].images);bytes+=Number(result[2][0].bytes);
  }else{
    const [count]=await query(countExpiredImagesSql(c.id,c.user_id));
    images+=Number(count.images);bytes+=Number(count.bytes);
  }
}
console.log(`${apply?'Eliminate':'Eliminabili'}: ${images} immagini, ${bytes} byte. Grazia: 30 giorni.`);

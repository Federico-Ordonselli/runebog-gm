/* Handler HTTP veri + Drizzle vero + PostgreSQL reale; sostituiti soltanto
   sessione e trasporto Neon con psql nel contenitore temporaneo. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { pathToFileURL,fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '../../src/db/schema.ts';
import { node } from '../../public/app/modello.js';

const root=fileURLToPath(new URL('../../',import.meta.url));
const database='test_api_'+randomUUID().replaceAll('-','');
function psql(text,db=database){
  return new Promise((resolve,reject)=>{
    const p=spawn('docker',['exec','-i',process.env.TEST_PG_CONTAINER||'runebog-todo-test','psql','-U','postgres','-d',db,'-XqAt','-v','ON_ERROR_STOP=1']);
    let out='',err='';p.stdout.on('data',s=>out+=s);p.stderr.on('data',s=>err+=s);
    p.on('error',reject);p.on('exit',code=>code===0?resolve(out.trim()):reject(new Error(err)));p.stdin.end(text);
  });
}
let seq=0;
function command(plan){
  const name='q'+seq++;
  let query=plan.query;
  if(/^\s*(UPDATE|DELETE)/i.test(query) && !/\breturning\b/i.test(query)) query+=' RETURNING 1';
  query=`WITH result AS (${query}) SELECT COALESCE(json_agg(result),'[]'::json) FROM result`;
  const args=plan.params.map(v=>v===null?'NULL':typeof v==='number'?String(v):"'"+String(v).replaceAll("'","''")+"'");
  return `PREPARE ${name} AS ${query}; EXECUTE ${name}${args.length?'('+args.join(',')+')':''};`;
}
function result(text,plan){
  const rows=JSON.parse(text);
  for(const r of rows) if(typeof r.bytes==='string' && r.bytes.startsWith('\\x')) r.bytes=Buffer.from(r.bytes.slice(2),'hex');
  return {rows:plan.options?.arrayMode?rows.map(Object.values):rows,rowCount:rows.length,fields:[]};
}
function client(query,params,options){
  const plan={query,params,options};
  return {...plan,then(resolve,reject){return psql(command(plan)).then(s=>result(s,plan)).then(resolve,reject);}};
}
client.transaction=async plans=>{
  const lines=(await psql('BEGIN;'+plans.map(command).join('\n')+'COMMIT;')).split('\n');
  return plans.map((p,i)=>result(lines[i],p));
};
const state={schemaVersion:1,root:node('Prova','zona'),players:[],checklist:[]};
const id=randomUUID(),otherId=randomUUID();
globalThis.__apiTest={db:drizzle(client,{schema}),session:{user:{id:'u'}}};
async function handler(relative){
  const file=path.join(root,relative);
  let source=ts.transpileModule(await readFile(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  source=source.replace(/from ["']([^"']+)["']/g,(_,specifier)=>{
    let url;
    if(specifier==='@/auth') url='data:text/javascript,export const auth=async()=>globalThis.__apiTest.session';
    else if(specifier==='@/db') url='data:text/javascript,export const db=globalThis.__apiTest.db';
    else if(specifier.startsWith('@/')) url=pathToFileURL(path.join(root,'src',specifier.slice(2)+'.ts')).href;
    else if(specifier.startsWith('.')) url=new URL(specifier,pathToFileURL(file)).href;
    else url=import.meta.resolve(specifier==='next/server'?'next/server.js':specifier);
    return `from ${JSON.stringify(url)}`;
  });
  return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
}
const args=()=>({params:Promise.resolve({id})});
const uploadReq=(mime='image/png',body=new Uint8Array([1,2,3]))=>new Request('http://localhost/api/campaigns/'+id+'/images',{method:'POST',headers:{'Content-Type':mime},body});
await psql('CREATE DATABASE '+database,'postgres');let checks=0;
try{
  for(const f of ['0000_iniziale.sql','0001_revisione-campagna.sql','0002_immagini-fuori-dal-json.sql']) await psql(await readFile(path.join(root,'drizzle',f),'utf8'));
  await psql(`INSERT INTO "user"(id) VALUES ('u'),('altro'); INSERT INTO campaign(id,user_id,data) VALUES ('${id}','u','{}'),('${otherId}','altro','{}');`);
  const upload=await handler('src/app/api/campaigns/[id]/images/route.ts');
  const campaign=await handler('src/app/api/campaigns/[id]/route.ts');
  const image=await handler('src/app/immagini/[chiave]/route.ts');
  globalThis.__apiTest.session=null;assert.equal((await upload.POST(uploadReq(),args())).status,404);checks++;
  globalThis.__apiTest.session={user:{id:'altro'}};assert.equal((await upload.POST(uploadReq(),args())).status,404);checks++;
  globalThis.__apiTest.session={user:{id:'u'}};
  assert.equal((await upload.POST(uploadReq('text/html'),args())).status,415);
  assert.equal((await upload.POST(uploadReq('image/png',new Uint8Array(0)),args())).status,400);
  assert.equal((await upload.POST(uploadReq('image/png',new Uint8Array(3*1024*1024)),args())).status,413);checks++;
  const uploaded=await upload.POST(uploadReq(),args());assert.equal(uploaded.status,201);
  const {url}=await uploaded.json();state.root.img=url;checks++;
  const patch=(data,baseRevision)=>campaign.PATCH(new Request('http://localhost/api/campaigns/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({data,baseRevision})}),args());
  let response=await patch(state,0);assert.equal(response.status,200);assert.equal((await response.json()).revision,1);checks++;
  response=await patch(state,0);assert.equal(response.status,409);assert.equal((await response.json()).data.root.img,url);checks++;
  const missing=structuredClone(state);missing.root.img='/immagini/non-esiste';
  assert.equal((await patch(missing,1)).status,422);checks++;
  await psql(`INSERT INTO campaign_image(id,campaign_id,mime,bytes) VALUES ('altrui','${otherId}','image/png',decode('01','hex'))`);
  missing.root.img='/immagini/altrui';assert.equal((await patch(missing,1)).status,422);checks++;
  const key=url.slice('/immagini/'.length),params={params:Promise.resolve({chiave:key})};
  response=await image.GET(new Request('http://localhost'+url),params);
  assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/immutable/);
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[1,2,3]);checks++;
  response=await image.GET(new Request('http://localhost'+url,{headers:{'If-None-Match':`W/"${key}"`}}),params);
  assert.equal(response.status,304);assert.match(response.headers.get('content-security-policy'),/sandbox/);checks++;
  console.log(`${checks} controlli handler API/PostgreSQL superati: autorizzazione, upload, PATCH, conflitto, proprietà e lettura.`);
}finally{
  await psql('DROP DATABASE '+database+' WITH (FORCE)','postgres');delete globalThis.__apiTest;
}

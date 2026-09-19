import test from 'node:test';
import assert from 'node:assert/strict';
import { embedImages,uploadImages,replaceImageUrls,ARCHIVE_BYTES,IMAGE_UPLOAD_BYTES,readLimitedBody } from '../../public/app/immagini.js';
import { node } from '../../public/app/modello.js';
import { parseCampaignJson } from '../../public/app/formato-campagna.js';
const state=()=>({schemaVersion:1,root:node('Campagna','zona'),players:[],checklist:[]});
const inline='data:image/png;base64,AQID';

test('export re-incorpora immagini e sfondi, deduplica download e non muta lo stato',async()=>{
  const s=state();s.root.img='/immagini/a';s.root.bg={img:'/immagini/a'};
  let calls=0;
  const copy=await embedImages(s,{fetcher:async()=>{calls++;return new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'image/png'}});}});
  assert.equal(calls,1);assert.equal(copy.root.img,inline);assert.equal(copy.root.bg.img,inline);
  assert.equal(s.root.img,'/immagini/a');
});
test('un’immagine mancante o di MIME ostile fa fallire l’intero backup',async()=>{
  const s=state();s.root.img='/immagini/a';
  for(const response of [new Response('',{status:404}),new Response('<script>',{headers:{'content-type':'text/html'}})])
    await assert.rejects(embedImages(s,{fetcher:async()=>response}));
  assert.equal(s.root.img,'/immagini/a');
});
test('upload dei vecchi data URL e import degli URL creano riferimenti della nuova campagna',async()=>{
  const s=state();s.root.img=inline;s.root.children=[node('figlio','luogo')];s.root.children[0].img='/immagini/vecchia';
  const requests=[];
  const fetcher=async(url,opts)=>{
    if(opts?.method==='POST'){requests.push([url,opts]);return Response.json({url:'/immagini/nuova'+requests.length});}
    return new Response(new Uint8Array(url.startsWith('data:')?[1,2,3]:[4,5,6]),{headers:{'content-type':'image/png'}});
  };
  const replacements=await uploadImages(s,'campagna',{fetcher,copyUrls:true});
  assert.equal(requests.length,2);assert.equal(s.root.img,inline);
  replaceImageUrls(s,replacements);
  assert.equal(s.root.img,'/immagini/nuova1');assert.equal(s.root.children[0].img,'/immagini/nuova2');
  assert.equal(requests[0][0],'/api/campaigns/campagna/images');
  assert.deepEqual([...requests[0][1].body],[1,2,3]);
});
test('upload fallito lascia intatto lo snapshot e dichiara il motivo',async()=>{
  const s=state();s.root.img=inline;
  await assert.rejects(uploadImages(s,'c',{fetcher:async(url,opts)=>opts?.method==='POST'
    ?Response.json({error:'quota'},{status:413})
    :new Response(new Uint8Array([1]),{headers:{'content-type':'image/png'}})}),/quota/);
  assert.equal(s.root.img,inline);
});
test('limite binario controllato anche senza Content-Length',async()=>{
  await assert.rejects(readLimitedBody(new Response(new Uint8Array(IMAGE_UPLOAD_BYTES+1))),/grande/);
});
test('backup sopra 4 MiB importabile, limite del documento cloud invariato',()=>{
  const s=state();
  s.root.children=Array.from({length:3},()=>({...node('Mappa','luogo'),img:'data:image/png;base64,'+'A'.repeat(2*1024*1024)}));
  const json=JSON.stringify(s);
  assert.equal(parseCampaignJson(json).ok,false);
  assert.equal(parseCampaignJson(json,{documentBytes:ARCHIVE_BYTES}).ok,true);
});


test('il limite del backup conta le immagini ripetute prima di espandere il JSON',async()=>{
  const s=state();s.root.children=Array.from({length:50},()=>({...node('Mappa','luogo'),img:'/immagini/ripetuta'}));
  let calls=0;
  await assert.rejects(embedImages(s,{fetcher:async()=>{
    calls++;return new Response(new Uint8Array(2*1024*1024),{headers:{'content-type':'image/png'}});
  }}),/64 MiB/);
  assert.equal(calls,1);assert.equal(s.root.children[0].img,'/immagini/ripetuta');
});


test('un retry riusa gli upload riusciti prima dell’errore senza duplicare i blob',async()=>{
  const s=state();s.root.img=inline;s.root.children=[{...node('Seconda','luogo'),img:'data:image/png;base64,BAUG'}];
  let posts=0,fail=true;
  const fetcher=async(url,opts)=>{
    if(opts?.method==='POST'){
      posts++;
      if(opts.body[0]===4 && fail) return Response.json({error:'rete'},{status:503});
      return Response.json({url:'/immagini/retry'+opts.body[0]});
    }
    return new Response(new Uint8Array(url===inline?[1,2,3]:[4,5,6]),{headers:{'content-type':'image/png'}});
  };
  await assert.rejects(uploadImages(s,'retry',{fetcher}));fail=false;
  const mapped=await uploadImages(s,'retry',{fetcher});
  assert.equal(posts,3);assert.equal(mapped.size,2);assert.equal(s.root.img,inline);
});

/* Editor vero in Chromium; upload/PATCH simulati. Per SQL e concorrenza reale:
   test/database/verifica-todo.mjs. Nessun account o server esterno richiesto. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { apriBrowser } from './campagna-di-prova.mjs';
import { node } from '../../public/app/modello.js';
import { generateDungeon,exportForRunebog } from '../../src/lib/dungeon/engine.ts';
import { MONSTERS,MAGIC_ITEMS } from '../../src/lib/dungeon/srd-data.ts';
const origin='http://localhost:4189';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5FcAAAAASUVORK5CYII=';
const initial={schemaVersion:1,root:node('Campagna','zona'),players:[{id:'pg',name:'Ada',cls:'',hp:12,hpMax:20,notes:''}],checklist:[]};
initial.root.img=png; initial.root.bg={img:png,x:0,y:0,w:100,h:100,opacity:0.6};
const {browser,contesto:context}=await apriBrowser();
let server=structuredClone(initial), revision=1, images=new Map(), uploads=0, failUpload=false, failGet=false;
let holdUpload=null;const errors=[];let checks=0;
try{
  await context.route(origin+'/**',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/api/campaigns/c1/images'){
      uploads++;
      if(holdUpload) await holdUpload;
      if(failUpload){await route.fulfill({status:413,json:{error:'Spazio immagini esaurito'}});return;}
      const key='/immagini/i'+uploads;
      images.set(key,{body:route.request().postDataBuffer(),mime:route.request().headers()['content-type']});
      await route.fulfill({status:201,json:{url:key}});return;
    }
    if(url.pathname==='/api/campaigns/c1'){
      const body=route.request().postDataJSON();
      if(body.baseRevision!==revision){await route.fulfill({status:409,json:{data:server,revision}});return;}
      assert.equal(JSON.stringify(body.data).includes('data:image'),false,'PATCH senza base64');
      server=body.data;revision++;
      await route.fulfill({json:{revision}});return;
    }
    if(url.pathname.startsWith('/immagini/')){
      const img=images.get(url.pathname);
      await route.fulfill(img && !failGet?{body:img.body,contentType:img.mime,headers:{'Cache-Control':'no-store'}}:{status:404,body:''});return;
    }
    if(url.pathname!=='/app.html' && url.pathname!=='/themes.css' && !url.pathname.startsWith('/app/')){
      await route.fulfill({status:404,body:''});return;
    }
    const body=await readFile(new URL('../../public'+url.pathname,import.meta.url));
    await route.fulfill({body,contentType:url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.css')?'text/css':'text/html'});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(state=>{window.__cloud={id:'c1',state,revision:1};},initial);
  await page.goto(origin+'/app.html');
  await page.waitForFunction(()=>document.getElementById('savestate').textContent.includes('Salvato nel cloud'));
  assert.equal(uploads,1);assert.equal(server.root.img,'/immagini/i1');assert.equal(server.root.bg.img,server.root.img);checks++;
  assert.equal(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('runebog-cloud-pending')).length),0);checks++;
  let downloadEvent=page.waitForEvent('download');await page.evaluate(()=>window.exportJSON());
  let download=await downloadEvent;
  const backup=JSON.parse(await readFile(await download.path(),'utf8'));
  assert.equal(backup.root.img,png);assert.equal(backup.root.bg.img,png);checks++;
  failGet=true;let downloads=0;page.on('download',()=>downloads++);
  await page.evaluate(()=>window.exportJSON());
  await page.locator('#alert-dialog[open]').waitFor();
  assert.match(await page.locator('#alert-text').textContent(),/Backup non creato/);
  assert.equal(downloads,0);checks++;
  await page.getByRole('button',{name:'Ho capito'}).click();failGet=false;

  // Errore upload: la figura nuova resta nel locale, il cloud non cambia.
  failUpload=true;
  const png2='data:image/png;base64,'+Buffer.concat([Buffer.from(png.split(',')[1],'base64'),Buffer.from([0])]).toString('base64');
  await page.evaluate(async img=>{const m=await import('/app/stato.js');m.st.state.root.img=img;m.save();},png2);
  await page.waitForFunction(()=>document.getElementById('savestate').textContent.includes('Immagini non caricate'));
  assert.equal(server.root.img,'/immagini/i1');
  assert.equal(await page.evaluate(async()=> (await import('/app/stato.js')).st.state.root.img),png2);checks++;
  failUpload=false;
  let release;holdUpload=new Promise(r=>release=r);
  await page.evaluate(()=>window.dispatchEvent(new Event('online')));
  await page.waitForFunction(()=>document.getElementById('savestate').textContent.includes('Caricamento immagini'));
  await page.evaluate(async()=>{const m=await import('/app/stato.js');m.st.state.root.title='Durante upload';m.save();});
  release();holdUpload=null;
  await page.waitForFunction(()=>document.getElementById('savestate').textContent.includes('Salvato nel cloud'));
  assert.equal(server.root.title,'Durante upload');assert.match(server.root.img,/^\/immagini\//);checks++;

  // Anche il backup del conflitto deve sopravvivere senza il server.
  downloadEvent=page.waitForEvent('download');
  await page.evaluate(async()=>{
    const {st}=await import('/app/stato.js');const m=await import('/app/sync-cloud.js');
    await m.downloadRecoveryBackup(m.recoveryBackup({campaignId:'c1',
      localCache:m.makePendingCache({campaignId:'c1',state:st.state,baseRevision:1}),
      server:{state:st.state,revision:2,updatedAt:null}}));
  });
  download=await downloadEvent;
  const both=JSON.parse(await readFile(await download.path(),'utf8'));
  assert.ok(both.local.state.root.img.startsWith('data:image/'));
  assert.ok(both.server.state.root.img.startsWith('data:image/'));checks++;

  // Import cloud: errore non sostituisce; successo ricopia le immagini.
  const cloudBackup=structuredClone(backup);
  cloudBackup.root.title='Copia importata';
  cloudBackup.root.img='data:image/png;base64,'+Buffer.concat([Buffer.from(png.split(',')[1],'base64'),Buffer.from([1])]).toString('base64');
  cloudBackup.root.bg.img=cloudBackup.root.img;
  const previous=JSON.stringify(server);failUpload=true;
  await page.locator('#import-file').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(cloudBackup))});
  await page.locator('#confirm-dialog[open]').waitFor();await page.locator('#confirm-yes').click();
  await page.locator('#alert-dialog[open]').waitFor();
  assert.match(await page.locator('#alert-text').textContent(),/Importazione non riuscita/);
  assert.equal(JSON.stringify(server),previous);checks++;
  await page.getByRole('button',{name:'Ho capito'}).click();failUpload=false;
  const oldUrl=server.root.img;
  await page.locator('#import-file').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(cloudBackup))});
  await page.locator('#confirm-dialog[open]').waitFor();await page.locator('#confirm-yes').click();
  for(let i=0;i<250 && server.root.img===oldUrl;i++) await new Promise(r=>setTimeout(r,20));
  assert.notEqual(server.root.img,oldUrl);assert.equal(server.root.title,cloudBackup.root.title);checks++;

  // Import autosufficiente in standalone: nessuna richiesta di upload.
  const standalone=await context.newPage();standalone.on('pageerror',e=>errors.push(e.message));
  await standalone.goto(origin+'/app.html');const before=uploads;
  await standalone.locator('#import-file').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  await standalone.waitForFunction(()=>document.getElementById('savestate').textContent.includes('Importata come campagna nuova'));
  assert.equal(await standalone.evaluate(async()=> (await import('/app/stato.js')).st.state.root.img),png);
  assert.equal(uploads,before);checks++;

  // Dungeon e PG: rendering reale, nome/PF alla fonte, nessuna pedina doppia.
  const dungeon=exportForRunebog(generateDungeon({seed:123,name:'Dungeon',roomCount:5,theme:'misto',level:3,partySize:4,difficulty:'medio',ruleset:'2024'},MONSTERS,MAGIC_ITEMS));
  const pg=await standalone.evaluate(async dungeon=>{
    const {st}=await import('/app/stato.js');
    const {importDungeon}=await import('/app/dungeon.js');
    const {tokenLink,placeAllPlayers}=await import('/app/battaglia.js');
    importDungeon(JSON.stringify(dungeon));
    const dg=st.state.root.children.at(-1), token=dg.children.find(n=>n.playerId==='pg');
    const before=dg.children.filter(n=>n.playerId).length;
    st.state.players[0].name='Adele';st.state.players[0].hp=7;
    placeAllPlayers();
    return {link:tokenLink(token),before,after:dg.children.filter(n=>n.playerId).length};
  },dungeon);
  assert.equal(pg.link.nome,'Adele');assert.equal(pg.link.hp,7);assert.equal(pg.after,pg.before);checks++;

  // duplicateSelected effettiva, compresa la cancellazione dell'originale.
  const duplicated=await standalone.evaluate(async()=>{
    const {st,selectNode,removeNode}=await import('/app/stato.js');
    const {node}=await import('/app/modello.js');
    const {duplicateSelected}=await import('/app/mappa.js');
    const {tokenLink,combattente}=await import('/app/battaglia.js');
    const z=node('Zona','zona'),e=node('Orchi','encounter'),t=node('Orco','token');
    e.monster={foes:[{id:'orco',name:'Orco',hp:9,hpMax:20}]};t.foe={nodeId:e.id,foeId:'orco'};
    z.children=[e,t];z.battle={round:1,turn:0,order:[{id:'turno',kind:'foe',...t.foe,init:10}]};
    st.state.root.children.push(z);st.path=[st.state.root.id];selectNode(z.id);duplicateSelected();
    const copy=st.state.root.children.at(-1);removeNode(z.id,st.state.root);
    return {token:tokenLink(copy.children[1]),turn:combattente(copy.battle.order[0])};
  });
  assert.equal(duplicated.token.hp,9);assert.equal(duplicated.turn.nome,'Orco');checks++;
  assert.deepEqual(errors,[]);checks++;
  console.log(`${checks} controlli browser superati: immagini, export, errori, import standalone, PG e duplicazione.`);
}finally{await browser.close();}

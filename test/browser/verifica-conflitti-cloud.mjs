/* Due pagine vere condividono localStorage; solo il server PATCH è simulato.
   Nessun database/account richiesto. Eseguire: node test/browser/verifica-conflitti-cloud.mjs */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { apriBrowser } from './campagna-di-prova.mjs';
import { node } from '../../public/app/modello.js';

const origin='http://localhost:4179';
const initial=()=>({schemaVersion:1,root:node('Iniziale','zona'),checklist:[],players:[]});
const tick=()=>new Promise(resolve=>setTimeout(resolve,20));
async function until(fn){
  for(let i=0;i<250;i++){if(await fn()) return; await tick();}
  throw new Error('Condizione non raggiunta');
}
const title=page=>page.evaluate(async()=> (await import('/app/stato.js')).st.state.root.title);
const pending=page=>page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('runebog-cloud-pending-v1:')).map(k=>JSON.parse(localStorage.getItem(k))));
async function edit(page, value){
  await page.evaluate(async value=>{
    const m=await import('/app/stato.js'); m.st.state.root.title=value; m.save();
  },value);
}
const {browser,contesto:unused}=await apriBrowser();
await unused.close();
let checks=0;
try{
  for(const choice of ['Conserva cloud','Recupera locale','Riapri','Più copie offline','ACK durante modifica']){
    let context=await browser.newContext({acceptDownloads:true,serviceWorkers:'block'});
    let server={data:initial(),revision:1,updatedAt:'2026-09-19T00:00:00Z'};
    let held=true; const requests=[]; const errors=[];
    async function routes(ctx){
      await ctx.route(origin+'/**',async route=>{
        const url=new URL(route.request().url());
        if(url.pathname==='/api/campaigns/c1'){
          const body=route.request().postDataJSON();
          if(held){ requests.push({route,body}); return; }
          if(body.baseRevision!==server.revision){
            await route.fulfill({status:409,json:server}); return;
          }
          server={...server,data:body.data,revision:server.revision+1};
          await route.fulfill({json:{revision:server.revision,updatedAt:server.updatedAt}}); return;
        }
        const allowed=url.pathname==='/app.html' || url.pathname==='/themes.css' || url.pathname.startsWith('/app/');
        if(!allowed){await route.fulfill({status:404,body:''});return;}
        try{
          const file=new URL('../../public'+url.pathname,import.meta.url);
          const body=await readFile(file);
          await route.fulfill({body,contentType:url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.css')?'text/css':'text/html'});
        }catch{await route.fulfill({status:404,body:''});}
      });
    }
    async function open(){
      const page=await context.newPage();
      page.on('pageerror',e=>errors.push(e.message));
      await page.addInitScript(cloud=>{window.__cloud=cloud;},{id:'c1',state:server.data,revision:server.revision,updatedAt:server.updatedAt});
      await page.goto(origin+'/app.html');
      await page.waitForFunction(()=>document.documentElement.classList.contains('cloud'));
      return page;
    }
    await routes(context);
    const a=await open(), b=await open();
    if(choice==='Più copie offline'){
      await edit(a,'A offline'); await until(()=>requests.length===1);
      await requests[0].route.abort('internetdisconnected');
      await edit(b,'B offline'); await until(()=>requests.length===2);
      await requests[1].route.abort('internetdisconnected');
      assert.equal((await pending(a)).length,2); checks++;
      await a.close(); await b.close();
      const storageState=await context.storageState(); await context.close();
      context=await browser.newContext({storageState,serviceWorkers:'block'});
      await routes(context); held=false;
      const reopened=await open();
      await reopened.locator('#cloud-recovery-dialog').waitFor();
      assert.match(await reopened.locator('#cloud-recovery-dialog').textContent(),/A offline/);
      await reopened.getByRole('button',{name:'Conserva cloud',exact:true}).click();
      assert.match(await reopened.locator('#cloud-recovery-dialog').textContent(),/B offline/);
      assert.equal((await pending(reopened)).length,1); checks++;
      await reopened.getByRole('button',{name:'Recupera locale',exact:true}).click();
      await until(async()=>!(await pending(reopened)).length);
      assert.equal(server.data.root.title,'B offline');
      assert.equal(server.revision,2); checks++;
      assert.deepEqual(errors,[]); checks++;
      await context.close(); console.log('ok:',choice); continue;
    }
    if(choice==='ACK durante modifica'){
      await edit(a,'Prima'); await until(()=>requests.length===1);
      await edit(a,'Dopo');
      server={...server,data:requests[0].body.data,revision:2};
      await requests[0].route.fulfill({json:{revision:2}});
      await until(()=>requests.length===2);
      assert.equal(requests[1].body.data.root.title,'Dopo');
      assert.equal(requests[1].body.baseRevision,2);
      assert.equal((await pending(a))[0].state.root.title,'Dopo'); checks++;
      server={...server,data:requests[1].body.data,revision:3}; held=false;
      await requests[1].route.fulfill({json:{revision:3}});
      await until(async()=>!(await pending(a)).length);
      assert.equal(await title(a),'Dopo'); checks++;
      assert.deepEqual(errors,[]); checks++;
      await context.close(); console.log('ok:',choice); continue;
    }
    // B persiste prima; poi l'ACK di A arriva prima del 409 di B.
    await edit(b,'B'); await until(()=>requests.length===1);
    await edit(a,'A'); await until(()=>requests.length===2);
    assert.deepEqual((await pending(a)).map(c=>c.state.root.title).sort(),['A','B']); checks++;
    const reqA=requests.find(r=>r.body.data.root.title==='A');
    server={...server,data:reqA.body.data,revision:2};
    await reqA.route.fulfill({json:{revision:2,updatedAt:server.updatedAt}});
    await until(async()=> (await pending(a)).length===1);
    assert.equal((await pending(a))[0].state.root.title,'B'); checks++;
    // L'ultima battuta è ancora nei 700 ms del debounce al momento del 409.
    await edit(b,'B ultima modifica');
    await requests[0].route.fulfill({status:409,json:server});
    await b.locator('#cloud-recovery-dialog').waitFor();
    const downloadEvent=b.waitForEvent('download');
    await b.getByRole('button',{name:'Esporta entrambe',exact:true}).click();
    const download=await downloadEvent;
    const backup=JSON.parse(await readFile(await download.path(),'utf8'));
    assert.equal(backup.local.state.root.title,'B ultima modifica');
    assert.equal(backup.local.baseRevision,1);
    assert.equal(backup.server.state.root.title,'A');
    assert.equal(backup.server.revision,2); checks++;
    await b.waitForTimeout(850);
    assert.equal(requests.length,2); // nessun debounce scavalca il dialogo
    assert.equal(server.data.root.title,'A');
    assert.equal(await title(a),'A'); checks++;
    held=false;
    if(choice==='Riapri'){
      await a.close(); await b.close();
      const storageState=await context.storageState();
      await context.close();
      context=await browser.newContext({storageState,serviceWorkers:'block'});
      await routes(context);
      const reopened=await open();
      await reopened.locator('#cloud-recovery-dialog').waitFor();
      assert.match(await reopened.locator('#cloud-recovery-dialog').textContent(),/B ultima modifica/);
      await reopened.getByRole('button',{name:'Recupera locale',exact:true}).click();
      await until(()=>server.data.root.title==='B ultima modifica');
      await until(async()=>!(await pending(reopened)).length);
      assert.equal(await title(reopened),'B ultima modifica'); checks++;
    }else{
      await b.getByRole('button',{name:choice,exact:true}).click();
      const expected=choice==='Recupera locale'?'B ultima modifica':'A';
      await until(async()=>!(await pending(b)).length);
      assert.equal(await title(b),expected);
      assert.equal(server.data.root.title,expected);
      assert.equal(server.revision,choice==='Recupera locale'?3:2);
      assert.equal(await title(a),'A'); checks++;
      await a.close(); await b.close();
      const storageState=await context.storageState();
      await context.close();
      context=await browser.newContext({storageState,serviceWorkers:'block'});
      await routes(context);
      const reopened=await open();
      assert.equal(await title(reopened),expected);
      assert.equal(await reopened.locator('#cloud-recovery-dialog').count(),0); checks++;
    }
    assert.deepEqual(errors,[]); checks++;
    await context.close();
    console.log('ok:',choice);
  }
  console.log(`${checks} controlli superati`);
}finally{
  await browser.close();
}

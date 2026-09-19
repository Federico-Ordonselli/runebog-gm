/* Due build vere in /tmp, stessa origine via proxy; varia soltanto la UI.
   Nessuna modifica ai sorgenti di lavoro né connessione al database. */
import assert from 'node:assert/strict';
import { cp,mkdtemp,readFile,writeFile,symlink,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { apriBrowser } from './campagna-di-prova.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const temp=process.env.TEST_SRD_BUILDS || await mkdtemp(path.join(tmpdir(),'runebog-srd-builds-'));
let passed=false;
const next=path.join(root,'node_modules/next/dist/bin/next');
const env={...process.env,DATABASE_URL:'postgresql://test:test@localhost:5432/test',AUTH_SECRET:'solo-build-di-prova',NEXT_TELEMETRY_DISABLED:'1'};
const children=[];let browser,proxy;
async function build(name){
  const dir=path.join(temp,name);
  if(process.env.TEST_SRD_BUILDS) return dir;
  await cp(path.join(root,'src'),path.join(dir,'src'),{recursive:true});
  await cp(path.join(root,'public'),path.join(dir,'public'),{recursive:true});
  for(const f of ['package.json','package-lock.json','tsconfig.json','next-env.d.ts']) await cp(path.join(root,f),path.join(dir,f));
  await symlink(path.join(root,'node_modules'),path.join(dir,'node_modules'),'dir');
  const page=path.join(dir,'src/app/srd/page.tsx');
  await writeFile(page,(await readFile(page,'utf8')).replace('<main className=',`<main data-verifica-build="${name}" className=`));
  const css=path.join(dir,'src/app/srd/srd.css');
  await writeFile(css,(await readFile(css,'utf8'))+`\n.srd-page{--verifica-build:${name};}\n`);
  const child=spawn(process.execPath,[next,'build'],{cwd:dir,env});children.push(child);
  let log='';child.stdout.on('data',s=>log+=s);child.stderr.on('data',s=>log+=s);
  const [code]=await once(child,'exit');
  await writeFile(path.join(temp,`build-${name}.log`),log);
  if(code!==0) throw new Error(log);
  console.log('Build completata:',name);return dir;
}
async function serve(dir){
  const probe=http.createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');
  const port=probe.address().port;await new Promise(r=>probe.close(r));
  const child=spawn(process.execPath,[next,'start','-p',String(port),'-H','127.0.0.1'],{cwd:dir,env,stdio:'ignore'});children.push(child);
  for(let i=0;i<100;i++){
    try{if((await fetch(`http://127.0.0.1:${port}/sw.js`)).ok) return port;}catch{}
    await new Promise(r=>setTimeout(r,100));
  }
  throw new Error('Server Next non pronto');
}
try{
  const a=await build('a'),b=await build('b');
  const portA=await serve(a),portB=await serve(b);let target=portA;
  proxy=http.createServer((req,res)=>{
    const upstream=http.request({hostname:'127.0.0.1',port:target,path:req.url,method:req.method,headers:req.headers},r=>{
      res.writeHead(r.statusCode,r.headers);r.pipe(res);
    });
    upstream.on('error',()=>{res.writeHead(502);res.end();});req.pipe(upstream);
  });
  proxy.listen(0,'127.0.0.1');await once(proxy,'listening');
  const origin=`http://127.0.0.1:${proxy.address().port}`;
  const opened=await apriBrowser();browser=opened.browser;const context=opened.contesto,page=await context.newPage();
  page.on('pageerror',e=>console.log('Errore pagina:',e.message));
  await page.goto(origin+'/srd');
  await page.evaluate(async()=>{
    await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Download regole scaduto')),30000);
      function done(ev){
        if(!['regole-fatto','regole-errore'].includes(ev.data?.tipo)) return;
        clearTimeout(timer);navigator.serviceWorker.removeEventListener('message',done);
        ev.data.tipo==='regole-fatto'?resolve():reject(new Error('Download regole fallito'));
      }
      navigator.serviceWorker.addEventListener('message',done);
      navigator.serviceWorker.ready.then(r=>r.active.postMessage({tipo:'scarica-regole'}));
    });
  });
  const cacheA=await page.evaluate(async()=> (await caches.keys()).find(n=>n.startsWith('runebog-regole-')));
  assert.ok(cacheA);
  assert.equal(await page.locator('main').getAttribute('data-verifica-build'),'a');
  target=portB;
  await page.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration();await reg.update();});
  let updated=false;
  for(let i=0;i<300;i++){
    updated=await page.evaluate(async old=>{
      const names=await caches.keys();return !names.includes(old) && names.some(n=>n.startsWith('runebog-regole-'));
    },cacheA);
    if(updated) break;
    await new Promise(r=>setTimeout(r,100));
  }
  assert.ok(updated,'attivazione completata e cache precedente rimossa');
  assert.ok((await (await fetch(origin+'/srd')).text()).includes('data-verifica-build="b"'), 'il proxy serve la build b');
  const cdp=await context.newCDPSession(page);await cdp.send('Network.clearBrowserCache');
  await page.reload();
  assert.equal(await page.locator('main').getAttribute('data-verifica-build'),'b');
  assert.equal(await page.locator('main').evaluate(el=>getComputedStyle(el).getPropertyValue('--verifica-build').trim()),'b');
  await cdp.send('Network.clearBrowserCache');await context.setOffline(true);
  await page.reload();
  assert.equal(await page.locator('main').getAttribute('data-verifica-build'),'b');
  assert.equal(await page.locator('main').evaluate(el=>getComputedStyle(el).getPropertyValue('--verifica-build').trim()),'b');
  await page.goto(origin+'/srd/come-si-gioca');
  if(!await page.locator('main').count()) throw new Error('Capitolo offline privo del contenuto');
  assert.ok((await page.locator('main').textContent()).length>1000);
  passed=true;
  console.log('6 controlli superati: cache aggiornata, HTML e CSS nuovi online/offline, capitolo offline.');
}finally{
  if(browser) await browser.close();
  if(proxy){proxy.closeAllConnections();await new Promise(r=>proxy.close(r));}
  for(const child of children) if(child.exitCode===null){child.kill('SIGTERM');await once(child,'exit').catch(()=>{});}
  if(passed) await rm(temp,{recursive:true,force:true});
  else console.log("Build di diagnosi conservate:",temp);
}

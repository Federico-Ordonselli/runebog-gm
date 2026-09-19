import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,mkdir,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { versioneRegole } from '../../src/lib/offline/versione-regole.ts';

test('UI, ricerca e stili cambiano la cache SRD; la mappa non la invalida',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'runebog-versione-'));
  try{
    for(const file of ['src/app/srd/page.tsx','src/app/srd/cerca.tsx','src/app/srd/srd.css','src/lib/srd/dati.json',
      'src/app/layout.tsx','src/app/globals.css','public/themes.css','public/app/srd-mostri.js','public/app/mappa.js','package-lock.json']){
      await mkdir(path.dirname(path.join(dir,file)),{recursive:true});await writeFile(path.join(dir,file),'prima');
    }
    let previous=await versioneRegole(dir,['/srd']);
    await writeFile(path.join(dir,'public/app/mappa.js'),'seconda');
    assert.equal(await versioneRegole(dir,['/srd']),previous);
    for(const file of ['src/app/srd/page.tsx','src/app/srd/cerca.tsx','src/app/srd/srd.css','src/app/globals.css','public/themes.css','package-lock.json']){
      await writeFile(path.join(dir,file),'seconda');
      const next=await versioneRegole(dir,['/srd']);assert.notEqual(next,previous,file);previous=next;
    }
    assert.notEqual(await versioneRegole(dir,['/srd','/srd/nuova']),previous);
  }finally{await rm(dir,{recursive:true,force:true});}
});

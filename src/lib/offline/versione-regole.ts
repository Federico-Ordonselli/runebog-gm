import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

/** Comprende rendering, ricerca, layout e stili condivisi, oltre ai dati.
 * Il lockfile copre aggiornamenti di Next/React a sorgenti nostre immutate. */
export async function versioneRegole(root: string, rotte: string[]) {
  const files: string[] = [];
  async function visit(relative: string) {
    for(const item of await readdir(path.join(root, relative), {withFileTypes:true})) {
      const file = path.join(relative, item.name);
      if(item.isDirectory()) await visit(file);
      else files.push(file);
    }
  }
  await visit('src/app/srd');
  await visit('src/lib/srd');
  files.push('src/app/layout.tsx', 'public/themes.css', 'public/app/srd-mostri.js', 'package-lock.json');
  // I CSS del layout globale sono dipendenze della pagina anche fuori da /srd.
  for(const file of await readdir(path.join(root,'src/app')))
    if(file.endsWith('.css')) files.push('src/app/'+file);
  const hash = createHash('sha256');
  for(const file of files.sort()) {
    hash.update(file).update('\0').update(await readFile(path.join(root,file))).update('\0');
  }
  hash.update(JSON.stringify([...rotte].sort()));
  return hash.digest('hex').slice(0,16);
}

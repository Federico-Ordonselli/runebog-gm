/* Il percorso di un collegamento disegnato a mano (`e.percorso`, 24 set 2026).

   Un collegamento resta un arco fra DUE bolle: il percorso sono solo i punti
   di mezzo, e non è in coordinate della pianta ma nel riferimento dell'arco —
   `[u, v]` con l'origine al centro di `a`, u lungo a→b e v perpendicolare, in
   unità della distanza fra i due centri. Così spostare una bolla non stacca
   la strada: il tracciato si stira e ruota con le sue estremità, invece di
   restare fermo col capo che va a pescare dall'altra parte della mappa. Lo
   stesso vale per duplica e incolla, che copiano l'arco com'è.

   Modulo puro, senza DOM né import: la bonifica sta nel contratto
   (`normalizzaPercorso`), qui c'è solo geometria, provata in test/disegno/. */

/* I punti veri dell'arco, estremi compresi. */
export function puntiArco(percorso, A, B){
  const dx = B.x - A.x, dy = B.y - A.y;
  const pts = [A];
  for(const [u, v] of (Array.isArray(percorso) ? percorso : []))
    pts.push({x: A.x + u*dx - v*dy, y: A.y + u*dy + v*dx});
  pts.push(B);
  return pts;
}

/* L'inversa: punti della pianta → riferimento dell'arco. Con due centri
   coincidenti il riferimento non esiste, e l'arco torna dritto. */
export function percorsoRelativo(punti, A, B){
  const dx = B.x - A.x, dy = B.y - A.y, L2 = dx*dx + dy*dy;
  if(!(L2 > 0)) return [];
  const r = x => Math.round(x*1000)/1000 + 0;
  return punti.map(p => {
    const px = p.x - A.x, py = p.y - A.y;
    return [r((px*dx + py*dy)/L2), r((py*dx - px*dy)/L2)];
  });
}

/* Ramer–Douglas–Peucker: la traccia del dito ha un punto ogni pochi pixel e
   tutto il tremolio della mano. Restano i punti che si scostano più di `tol`
   dalla corda, cioè gli spigoli e le anse che il DM ha voluto; una traccia
   che non si scosta mai torna ai soli estremi, ed è l'arco dritto di sempre. */
export function semplificaTraccia(pts, tol){
  if(pts.length <= 2) return pts.slice();
  const keep = new Array(pts.length).fill(false);
  keep[0] = keep[pts.length-1] = true;
  const pila = [[0, pts.length-1]];
  while(pila.length){
    const [i, j] = pila.pop();
    const A = pts[i], B = pts[j];
    const dx = B.x-A.x, dy = B.y-A.y, L = Math.hypot(dx, dy);
    let max = -1, k = -1;
    for(let m=i+1; m<j; m++){
      const d = L ? Math.abs((pts[m].x-A.x)*dy - (pts[m].y-A.y)*dx)/L
                  : Math.hypot(pts[m].x-A.x, pts[m].y-A.y);
      if(d > max){ max = d; k = m; }
    }
    if(max > tol){ keep[k] = true; pila.push([i, k], [k, j]); }
  }
  return pts.filter((_, i) => keep[i]);
}

/* La curva che si disegna: una Catmull-Rom sui punti, convertita in Bézier
   cubiche. Passa per OGNI punto rimasto — il DM ritrova il percorso che ha
   tracciato — e ne arrotonda gli spigoli, che è il "più sinuoso" richiesto.
   Torna anche il punto a metà LUNGHEZZA, dove stanno etichetta e croce di
   una strada bloccata: il punto medio della corda, su un'ansa, cadrebbe nel
   vuoto lontano dalla strada. */
export function curvaArco(pts){
  const f = x => Math.round(x*10)/10;
  if(pts.length < 3){
    const [A, B] = pts;
    return {d:`M${f(A.x)} ${f(A.y)}L${f(B.x)} ${f(B.y)}`, meta:{x:(A.x+B.x)/2, y:(A.y+B.y)/2}};
  }
  let d = `M${f(pts[0].x)} ${f(pts[0].y)}`;
  const campioni = [pts[0]];
  for(let i=0; i<pts.length-1; i++){
    const p0 = pts[i-1] || pts[i], p1 = pts[i], p2 = pts[i+1], p3 = pts[i+2] || p2;
    const c1 = {x: p1.x + (p2.x-p0.x)/6, y: p1.y + (p2.y-p0.y)/6};
    const c2 = {x: p2.x - (p3.x-p1.x)/6, y: p2.y - (p3.y-p1.y)/6};
    d += `C${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(p2.x)} ${f(p2.y)}`;
    for(let s=1; s<=8; s++){
      const t = s/8, u = 1-t;
      campioni.push({
        x: u*u*u*p1.x + 3*u*u*t*c1.x + 3*u*t*t*c2.x + t*t*t*p2.x,
        y: u*u*u*p1.y + 3*u*u*t*c1.y + 3*u*t*t*c2.y + t*t*t*p2.y,
      });
    }
  }
  return {d, meta: aMetaStrada(campioni)};
}

function aMetaStrada(pts){
  const lung = [0];
  for(let i=1; i<pts.length; i++)
    lung.push(lung[i-1] + Math.hypot(pts[i].x-pts[i-1].x, pts[i].y-pts[i-1].y));
  const meta = lung.at(-1) / 2;
  for(let i=1; i<pts.length; i++){
    if(lung[i] < meta) continue;
    const t = (meta - lung[i-1]) / ((lung[i] - lung[i-1]) || 1);
    return {x: pts[i-1].x + (pts[i].x-pts[i-1].x)*t, y: pts[i-1].y + (pts[i].y-pts[i-1].y)*t};
  }
  return pts.at(-1);
}

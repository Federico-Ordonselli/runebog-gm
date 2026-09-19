/* Le immagini a riposo possono essere URL; un backup deve invece contenere
   tutti i byte. Questo modulo non importa stato o DOM e lavora su snapshot. */
import { CAMPAIGN_LIMITS, IMMAGINE_LOCALE } from './formato-campagna.js';
export const ARCHIVE_BYTES = 64 * 1024 * 1024;
export const IMAGE_UPLOAD_BYTES = Math.floor(CAMPAIGN_LIMITS.imageBytes * 3 / 4) - 128;
export const IMAGE_MIMES = new Set(['image/png','image/jpeg','image/webp','image/gif','image/avif','image/svg+xml']);

export function imageFields(state){
  const fields = [], stack = state?.root ? [state.root] : [];
  while(stack.length){
    const n = stack.pop();
    if(typeof n.img === 'string' && n.img) fields.push([n,'img']);
    if(typeof n.bg?.img === 'string' && n.bg.img) fields.push([n.bg,'img']);
    stack.push(...(n.children || []));
  }
  return fields;
}
export const localImageKeys = state => [...new Set(imageFields(state)
  .map(([o,k])=>o[k]).filter(s=>IMMAGINE_LOCALE.test(s)).map(s=>s.slice('/immagini/'.length)))];

export async function readLimitedBody(response, limit=IMAGE_UPLOAD_BYTES){
  if(Number(response.headers.get('content-length')) > limit) throw new Error('Immagine troppo grande.');
  const reader=response.body.getReader(), chunks=[]; let size=0;
  try{
    for(;;){
      const {done,value}=await reader.read(); if(done) break;
      size+=value.byteLength;
      if(size>limit) throw new Error('Immagine troppo grande.');
      chunks.push(value);
    }
  }catch(error){ await reader.cancel().catch(()=>{}); throw error; }
  const bytes=new Uint8Array(size); let at=0;
  for(const chunk of chunks){ bytes.set(chunk,at); at+=chunk.byteLength; }
  return bytes;
}

async function readImage(url, fetcher){
  const response=await fetcher(url, {signal:AbortSignal.timeout(30000)});
  if(!response.ok) throw new Error('Immagine non disponibile ('+response.status+').');
  let mime=response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if(mime === 'image/jpg') mime = 'image/jpeg';
  if(!IMAGE_MIMES.has(mime)) throw new Error('Formato immagine non ammesso.');
  return {mime, bytes:await readLimitedBody(response)};
}
function dataUrl({mime,bytes}){
  let binary='';
  for(let i=0;i<bytes.length;i+=8192) binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return `data:${mime};base64,${btoa(binary)}`;
}
export function replaceImageUrls(state, replacements){
  for(const [o,k] of imageFields(state)) if(replacements.has(o[k])) o[k]=replacements.get(o[k]);
}

/** Ritorna una copia completa oppure fallisce senza produrre alcun file. */
export async function embedImages(state, {fetcher=fetch, onProgress=()=>{}}={}){
  const copy=structuredClone(state), replacements=new Map();
  const occurrences=new Map();
  for(const [o,k] of imageFields(copy)) if(!o[k].startsWith('data:')) occurrences.set(o[k],(occurrences.get(o[k]) || 0)+1);
  const urls=[...occurrences.keys()];
  const byteLength=s=>new TextEncoder().encode(s).length;
  let total=byteLength(JSON.stringify(copy));
  onProgress(0,urls.length);
  for(const [i,url] of urls.entries()){
    const data=dataUrl(await readImage(url,fetcher));
    // Lo stesso URL può comparire in migliaia di bolle. Conta TUTTE le copie
    // prima di serializzare: scaricarlo una volta non rende piccolo l'export.
    total+=(data.length+2-byteLength(JSON.stringify(url)))*occurrences.get(url);
    if(total>ARCHIVE_BYTES) throw new Error('Il backup supera 64 MiB.');
    replacements.set(url,data); onProgress(i+1,urls.length);
  }
  replaceImageUrls(copy,replacements);
  if(new TextEncoder().encode(JSON.stringify(copy)).length>ARCHIVE_BYTES) throw new Error('Il backup supera 64 MiB.');
  return copy;
}

/** In cloud solo i data URL vengono caricati; lo standalone non chiama qui.
 * In import `copyUrls` ricopia anche gli URL: la campagna nuova possiede i
 * propri byte e non dipende dalla cancellazione della campagna originale. */
// Solo nella sessione e nella stessa campagna: un upload riuscito non viene
// ripetuto se quello successivo fallisce. L'URL resta casuale e non è mai
// condiviso fra campagne; il digest serve solo a ritrovare questo risultato.
const completedUploads = new Map();
const UPLOAD_MEMO_MS = 7 * 24 * 60 * 60 * 1000;

export async function uploadImages(state, campaignId, {fetcher=fetch,onProgress=()=>{},copyUrls=false}={}){
  const replacements=new Map();
  const urls=[...new Set(imageFields(state).map(([o,k])=>o[k]).filter(s=>copyUrls || s.startsWith('data:')))];
  onProgress(0,urls.length);
  for(const [i,url] of urls.entries()){
    const {mime,bytes}=await readImage(url,fetcher);
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
    const cacheKey = `${campaignId}:${mime}:${digest}`;
    const completed = completedUploads.get(cacheKey);
    if(completed && Date.now()-completed.at < UPLOAD_MEMO_MS){
      replacements.set(url,completed.url); onProgress(i+1,urls.length); continue;
    }
    const response=await fetcher(`/api/campaigns/${encodeURIComponent(campaignId)}/images`,{
      method:'POST',headers:{'Content-Type':mime},body:bytes,signal:AbortSignal.timeout(30000),
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok || !IMMAGINE_LOCALE.test(result.url || ''))
      throw new Error(result.error || 'Caricamento immagine non riuscito.');
    completedUploads.set(cacheKey,{url:result.url,at:Date.now()});
    if(completedUploads.size>1000) completedUploads.delete(completedUploads.keys().next().value);
    replacements.set(url,result.url); onProgress(i+1,urls.length);
  }
  return replacements;
}

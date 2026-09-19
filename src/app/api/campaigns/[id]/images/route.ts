import { randomUUID } from 'node:crypto';
import { auth } from '@/auth';
import { db } from '@/db';
import { IMAGE_MIMES, IMAGE_UPLOAD_BYTES, readLimitedBody } from '../../../../../../public/app/immagini.js';
import { lockImageOwnerSql, lockCampaignSql, markOrphanImagesSql, deleteOrphanImagesSql, insertCampaignImageSql } from '@/lib/campaign-images-sql';

const headers = {'Cache-Control':'private, no-store'};
export async function POST(req: Request, {params}: {params:Promise<{id:string}>}) {
  const session=await auth(); const {id}=await params;
  if(!session?.user?.id || !/^[0-9a-f-]{36}$/i.test(id))
    return Response.json({error:'Campagna non trovata.'},{status:404,headers});
  const userId=session.user.id;
  // Autorizza prima di leggere il corpo; il lock nella transazione ripete
  // comunque il controllo se la campagna viene eliminata durante l'upload.
  const owned=await db.execute(lockCampaignSql(id,userId));
  if(!owned.rows.length) return Response.json({error:'Campagna non trovata.'},{status:404,headers});
  const mime=req.headers.get('content-type')?.split(';')[0].trim().toLowerCase() || '';
  if(!IMAGE_MIMES.has(mime)) return Response.json({error:'Formato immagine non ammesso.'},{status:415,headers});
  let bytes: Buffer;
  try { bytes=Buffer.from(await readLimitedBody(req,IMAGE_UPLOAD_BYTES)); }
  catch { return Response.json({error:'Immagine troppo grande o incompleta.'},{status:413,headers}); }
  if(!bytes.length) return Response.json({error:'Immagine vuota.'},{status:400,headers});
  const key=randomUUID();
  const results=await db.batch([
    db.execute(lockImageOwnerSql(userId)), db.execute(lockCampaignSql(id,userId)),
    db.execute(markOrphanImagesSql(id,userId)), db.execute(deleteOrphanImagesSql(id,userId)),
    db.execute(insertCampaignImageSql(id,userId,key,mime,bytes)),
  ]);
  if(!results[1].rows.length) return Response.json({error:'Campagna non trovata.'},{status:404,headers});
  if(!results[4].rows.length) return Response.json({error:'Limite immagini raggiunto (500/32 MiB per campagna, 2000/128 MiB per account).'}, {status:413,headers});
  return Response.json({url:'/immagini/'+key},{status:201,headers});
}

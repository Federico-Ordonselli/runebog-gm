import { sql } from 'drizzle-orm';

export const CAMPAIGN_IMAGE_BYTES = 32 * 1024 * 1024;
export const USER_IMAGE_BYTES = 128 * 1024 * 1024;
export const IMAGE_GRACE_DAYS = 30;
export const CAMPAIGN_IMAGE_COUNT = 500;
export const USER_IMAGE_COUNT = 2000;

export const lockImageOwnerSql = (userId: string) => sql`SELECT id FROM "user" WHERE id=${userId} FOR UPDATE`;
export const lockCampaignSql = (id: string, userId: string) => sql`
  SELECT id FROM campaign WHERE id=${id}::uuid AND user_id=${userId} FOR UPDATE`;

/* Cercare ogni campo img è conservativo anche con campi futuri: meglio
 * trattenere un orfano che cancellare una figura ancora referenziata. */
const referenced = sql`jsonb_path_exists(c.data, '$.**.img ? (@ == $url)',
  jsonb_build_object('url', '/immagini/' || i.id))`;
export const markOrphanImagesSql = (id: string, userId: string) => sql`
  UPDATE campaign_image i SET orphan_since = CASE WHEN ${referenced} THEN NULL
    ELSE COALESCE(i.orphan_since, CURRENT_TIMESTAMP) END
  FROM campaign c WHERE i.campaign_id=c.id AND c.id=${id}::uuid AND c.user_id=${userId}`;
export const deleteOrphanImagesSql = (id: string, userId: string) => sql`
  DELETE FROM campaign_image i USING campaign c
  WHERE i.campaign_id=c.id AND c.id=${id}::uuid AND c.user_id=${userId}
    AND i.orphan_since < CURRENT_TIMESTAMP - ${IMAGE_GRACE_DAYS} * INTERVAL '1 day'
    AND NOT ${referenced}`;

/** Va eseguita dopo i lock utente/campagna nella stessa transazione: due
 * upload paralleli non possono superare le quote contando entrambi prima. */
export const insertCampaignImageSql = (id: string, userId: string, key: string, mime: string, bytes: Buffer) => sql`
  INSERT INTO campaign_image (id,campaign_id,mime,bytes)
  SELECT ${key}, c.id, ${mime}, decode(${bytes.toString('hex')},'hex') FROM campaign c
  WHERE c.id=${id}::uuid AND c.user_id=${userId}
    AND (SELECT COALESCE(SUM(octet_length(i.bytes)),0) FROM campaign_image i WHERE i.campaign_id=c.id)
      + ${bytes.length} <= ${CAMPAIGN_IMAGE_BYTES}
    AND (SELECT COALESCE(SUM(octet_length(i.bytes)),0) FROM campaign_image i
      JOIN campaign owned ON owned.id=i.campaign_id WHERE owned.user_id=${userId})
      + ${bytes.length} <= ${USER_IMAGE_BYTES}
    AND (SELECT count(*) FROM campaign_image i WHERE i.campaign_id=c.id) < ${CAMPAIGN_IMAGE_COUNT}
    AND (SELECT count(*) FROM campaign_image i JOIN campaign owned ON owned.id=i.campaign_id
      WHERE owned.user_id=${userId}) < ${USER_IMAGE_COUNT}
  RETURNING id`;

export const ownsImageReferencesSql = (campaignId: string, keys: string[]) => sql`
  NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(${JSON.stringify(keys)}::jsonb) AS wanted(id)
    WHERE NOT EXISTS (SELECT 1 FROM campaign_image i WHERE i.id=wanted.id AND i.campaign_id=${campaignId}::uuid))`;


export const countExpiredImagesSql = (id: string, userId: string) => sql`
  SELECT count(*)::int AS images, COALESCE(sum(octet_length(i.bytes)),0)::bigint AS bytes
  FROM campaign_image i JOIN campaign c ON c.id=i.campaign_id
  WHERE c.id=${id}::uuid AND c.user_id=${userId}
    AND i.orphan_since < CURRENT_TIMESTAMP - ${IMAGE_GRACE_DAYS} * INTERVAL '1 day'
    AND NOT ${referenced}`;

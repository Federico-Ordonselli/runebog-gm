/*
 * Unico contratto, due ambienti. Il sorgente vive sotto public/app perché deve
 * essere importabile direttamente dall'editor vanilla; Next lo include tramite
 * questo wrapper.
 */
export {
  CURRENT_CAMPAIGN_SCHEMA_VERSION,
  CAMPAIGN_LIMITS,
  CAMPAIGN_MIGRATIONS,
  utf8ByteLength,
  scanJsonLimits,
  migrateCampaignDocument,
  validateCampaignDocument,
  prepareCampaignDocument,
  parseCampaignJson,
  campaignErrorMessage,
} from "../../public/app/formato-campagna.js";

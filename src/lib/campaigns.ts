/**
 * Forma iniziale del documento campagna: una sola definizione, usata sia dalla
 * server action della home sia da POST /api/campaigns. Erano due copie: aggiungere
 * un campo allo schema significava ricordarsi di aggiornarle entrambe.
 * È lo stesso formato di Esporta/Importa.
 */
import { CURRENT_CAMPAIGN_SCHEMA_VERSION } from "@/lib/formato-campagna";

export function newCampaignData(name: string) {
  return {
    schemaVersion: CURRENT_CAMPAIGN_SCHEMA_VERSION,
    root: {
      id: "root", title: name, type: "zona", status: "", notes: "", img: null,
      children: [], edges: [], x: null, y: null, shape: null,
    },
    checklist: [],
    players: [],
  };
}

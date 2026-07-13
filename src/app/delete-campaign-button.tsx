"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Stato = "fermo" | "chiede" | "elimina" | "fallito";

export function DeleteCampaignButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [stato, setStato] = useState<Stato>("fermo");

  async function onDelete() {
    setStato("elimina");
    const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setStato("fallito");
      return;
    }
    router.refresh();
  }

  if (stato === "fermo") {
    return (
      <span className="rowaction">
        <button className="btn btn--sm btn--quiet" onClick={() => setStato("chiede")}
                aria-label={`Elimina la campagna ${name}`}>
          Elimina
        </button>
      </span>
    );
  }

  // La conferma vive nella riga, non in un dialogo del browser: stessa lingua,
  // stessi colori, e l'utente non perde di vista la campagna che sta cancellando.
  const inCorso = stato === "elimina";
  const fallito = stato === "fallito";

  return (
    <span className="rowaction" data-open="true">
      <span className="rowaction__msg">{fallito ? "Non è riuscito." : "Eliminare?"}</span>
      <button className="btn btn--sm btn--danger" onClick={onDelete} disabled={inCorso}>
        {inCorso ? "Elimino…" : fallito ? "Riprova" : "Sì, elimina"}
      </button>
      <button className="btn btn--sm" onClick={() => setStato("fermo")} disabled={inCorso}>
        Annulla
      </button>
    </span>
  );
}

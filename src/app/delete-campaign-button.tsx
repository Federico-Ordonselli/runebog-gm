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

  // La conferma vive nella riga, non in un dialogo del browser: stessa lingua,
  // stessi colori, e l'utente non perde di vista la campagna che sta cancellando.
  if (stato === "chiede" || stato === "elimina" || stato === "fallito") {
    return (
      <span className="rowaction" data-open="true">
        {stato === "fallito" ? (
          <>
            <span className="rowaction__msg">Non è riuscito.</span>
            <button className="rowaction__btn rowaction__btn--yes" onClick={onDelete}>
              Riprova
            </button>
          </>
        ) : (
          <>
            <span className="rowaction__msg">Eliminare?</span>
            <button className="rowaction__btn rowaction__btn--yes" onClick={onDelete}
                    disabled={stato === "elimina"}>
              {stato === "elimina" ? "Elimino…" : "Sì, elimina"}
            </button>
          </>
        )}
        <button className="rowaction__btn" onClick={() => setStato("fermo")}
                disabled={stato === "elimina"}>
          Annulla
        </button>
      </span>
    );
  }

  return (
    <span className="rowaction">
      <button className="rowaction__btn rowaction__btn--quiet" onClick={() => setStato("chiede")}
              aria-label={`Elimina la campagna ${name}`}>
        Elimina
      </button>
    </span>
  );
}

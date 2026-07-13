"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteCampaignButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!confirm(`Eliminare la campagna "${name}"? Operazione definitiva: esportala prima se hai dubbi.`))
      return;
    setBusy(true);
    const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setBusy(false);
      alert("Eliminazione non riuscita. Riprova.");
      return;
    }
    router.refresh();
  }

  return (
    <button onClick={onDelete} disabled={busy} className="campaign__delete"
            aria-label={`Elimina la campagna ${name}`}>
      {busy ? "Elimino…" : "Elimina"}
    </button>
  );
}

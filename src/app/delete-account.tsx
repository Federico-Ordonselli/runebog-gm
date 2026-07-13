"use client";

import { useState } from "react";
import { deleteAccountAction } from "./auth-actions";

const WORD = "ELIMINA";

export function DeleteAccount({ campaignCount }: { campaignCount: number }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");

  if (!open) {
    return (
      <p style={{ marginTop: 30 }}>
        <button onClick={() => setOpen(true)}
                style={{ background: "none", border: "none", cursor: "pointer", font: "inherit",
                         fontSize: 13, color: "#8b968e", textDecoration: "underline", padding: 0 }}>
          Elimina il mio account
        </button>
      </p>
    );
  }

  return (
    <div style={{ marginTop: 30, border: "1px solid #6b3a2e", borderRadius: 12, padding: 20 }}>
      <p style={{ color: "#e0785f", marginTop: 0, lineHeight: 1.6 }}>
        <strong>Questa operazione è definitiva.</strong> Vengono cancellati il tuo account e{" "}
        {campaignCount === 1 ? "la tua campagna" : `le tue ${campaignCount} campagne`}, senza
        possibilità di recupero. Se ci tieni ai tuoi dati, <strong>esportali prima in JSON</strong>{" "}
        da dentro ogni campagna.
      </p>

      <form action={deleteAccountAction}>
        <label style={{ display: "block", fontSize: 13, color: "#8b968e", marginBottom: 6 }}>
          Per confermare, scrivi <strong style={{ color: "#e8e3d8" }}>{WORD}</strong> qui sotto:
        </label>
        <input value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off"
               style={{ width: "100%", padding: "9px 10px", boxSizing: "border-box",
                        background: "#131c17", border: "1px solid #2a352e", borderRadius: 8,
                        color: "#e8e3d8", font: "inherit", fontSize: 14 }} />

        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button type="submit" disabled={typed !== WORD}
                  style={{ padding: "9px 14px", borderRadius: 8, font: "inherit", fontSize: 14,
                           background: typed === WORD ? "#8a3a2a" : "#2a352e",
                           border: "1px solid " + (typed === WORD ? "#a8664f" : "#2a352e"),
                           color: typed === WORD ? "#fff" : "#6b756e",
                           cursor: typed === WORD ? "pointer" : "not-allowed" }}>
            Elimina definitivamente
          </button>
          <button type="button" onClick={() => { setOpen(false); setTyped(""); }}
                  style={{ padding: "9px 14px", borderRadius: 8, font: "inherit", fontSize: 14,
                           background: "none", border: "1px solid #2a352e", color: "#e8e3d8",
                           cursor: "pointer" }}>
            Annulla
          </button>
        </div>
      </form>
    </div>
  );
}

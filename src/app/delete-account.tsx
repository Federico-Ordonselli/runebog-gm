"use client";

import { useState } from "react";
import { deleteAccountAction } from "./auth-actions";

const WORD = "ELIMINA";

export function DeleteAccount({ campaignCount }: { campaignCount: number }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const confirmed = typed === WORD;

  if (!open) {
    return (
      <p style={{ marginTop: "2.5rem" }}>
        <button className="linkbtn linkbtn--danger" onClick={() => setOpen(true)}>
          Elimina il mio account
        </button>
      </p>
    );
  }

  return (
    <div className="card card--danger" style={{ marginTop: "2.5rem" }}>
      <p className="msg msg--error" style={{ marginTop: 0 }}>
        <strong>Questa operazione è definitiva.</strong> Vengono cancellati il tuo account e{" "}
        {campaignCount === 1 ? "la tua campagna" : `le tue ${campaignCount} campagne`}, senza
        possibilità di recupero. Se ci tieni ai tuoi dati, <strong>esportali prima in JSON</strong>{" "}
        da dentro ogni campagna.
      </p>

      <form action={deleteAccountAction}>
        <label className="field">
          <span className="muted small">
            Per confermare, scrivi <strong style={{ color: "var(--parchment)" }}>{WORD}</strong> qui sotto:
          </span>
          <input value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off"
                 className="input" />
        </label>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "1.1rem" }}>
          <button type="submit" disabled={!confirmed} className="btn btn--danger">
            Elimina definitivamente
          </button>
          <button type="button" className="btn"
                  onClick={() => { setOpen(false); setTyped(""); }}>
            Annulla
          </button>
        </div>
      </form>
    </div>
  );
}

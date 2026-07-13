"use client";

import { useActionState, useState } from "react";
import { requestResetAction, signInAction, signUpAction, type AuthState } from "./auth-actions";

type Mode = "in" | "up" | "forgot";

const AZIONI = { in: signInAction, up: signUpAction, forgot: requestResetAction };

export function AuthForms() {
  const [mode, setMode] = useState<Mode>("in");
  const isForgot = mode === "forgot";

  return (
    <div className="card">
      {/* In modalità recupero i tab sparirebbero entrambi spenti, lasciando il
          riquadro senza titolo: al loro posto va detto dove sei. */}
      {isForgot ? (
        <h2 className="section">Recupera l&apos;accesso</h2>
      ) : (
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={mode === "in"} className="tab"
                  onClick={() => setMode("in")}>Accedi</button>
          <button type="button" role="tab" aria-selected={mode === "up"} className="tab"
                  onClick={() => setMode("up")}>Registrati</button>
        </div>
      )}

      {/* La key rimonta il form a ogni cambio di modalità: un solo useActionState
          invece di tre, e l'errore della modalità precedente non resta appeso. */}
      <AuthForm key={mode} mode={mode} />

      <p className="switch">
        <button type="button" className="linkbtn"
                onClick={() => setMode(isForgot ? "in" : "forgot")}>
          {isForgot ? "← Torna al login" : "Password dimenticata?"}
        </button>
      </p>
    </div>
  );
}

function AuthForm({ mode }: { mode: Mode }) {
  const [state, action, pending] = useActionState(AZIONI[mode], {} as AuthState);
  const isUp = mode === "up";
  const isForgot = mode === "forgot";

  return (
    <form action={action}>
      {isForgot && (
        <p className="msg muted">
          Scrivi il tuo nome utente: se all&apos;account è associata un&apos;email,
          ti mandiamo un link per reimpostare la password.
        </p>
      )}

      <label className="field">
        <span className="field__label">Nome utente</span>
        <input name="username" autoComplete="username" required className="input"
               placeholder={isUp ? "3-32 caratteri: lettere, numeri, _ e -" : undefined} />
      </label>

      {!isForgot && (
        <label className="field">
          <span className="field__label">Password</span>
          <input name="password" type="password" required className="input"
                 autoComplete={isUp ? "new-password" : "current-password"}
                 placeholder={isUp ? "almeno 8 caratteri" : undefined} />
        </label>
      )}

      {isUp && (
        <>
          <label className="field">
            <span className="field__label">
              Email <span className="field__label-note">(facoltativa)</span>
            </span>
            <input name="email" type="email" autoComplete="email" className="input"
                   placeholder="serve solo a recuperare la password" />
          </label>
          <p className="msg msg--warn">
            ⚠️ Senza email non potrai recuperare l&apos;account: se dimentichi la password,
            perdi le campagne. Puoi comunque esportarle in JSON quando vuoi.
          </p>
        </>
      )}

      {state.error && <p role="alert" className="msg msg--error">{state.error}</p>}
      {state.notice && <p role="status" className="msg msg--ok">{state.notice}</p>}

      <button type="submit" disabled={pending} className="btn btn--primary btn--block">
        {pending ? "Attendi…" : isForgot ? "Mandami il link" : isUp ? "Crea account" : "Accedi"}
      </button>
    </form>
  );
}

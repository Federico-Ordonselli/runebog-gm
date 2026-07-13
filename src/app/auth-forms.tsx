"use client";

import { useActionState, useState } from "react";
import { requestResetAction, signInAction, signUpAction, type AuthState } from "./auth-actions";

type Mode = "in" | "up" | "forgot";

export function AuthForms() {
  const [mode, setMode] = useState<Mode>("in");
  const empty: AuthState = {};
  const [inState, doSignIn, inPending] = useActionState(signInAction, empty);
  const [upState, doSignUp, upPending] = useActionState(signUpAction, empty);
  const [fgState, doForgot, fgPending] = useActionState(requestResetAction, empty);

  const isUp = mode === "up";
  const isForgot = mode === "forgot";
  const state = isForgot ? fgState : isUp ? upState : inState;
  const pending = isForgot ? fgPending : isUp ? upPending : inPending;
  const action = isForgot ? doForgot : isUp ? doSignUp : doSignIn;

  return (
    <div className="card">
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={mode === "in"} className="tab"
                onClick={() => setMode("in")}>Accedi</button>
        <button type="button" role="tab" aria-selected={isUp} className="tab"
                onClick={() => setMode("up")}>Registrati</button>
      </div>

      <form action={action} key={mode}>
        {isForgot && (
          <p className="msg muted">
            Inserisci il tuo nome utente: se all&apos;account è associata un&apos;email,
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

        <button type="submit" disabled={pending} className="btn btn--primary btn--block"
                style={{ marginTop: "1.25rem" }}>
          {pending ? "Attendi…" : isForgot ? "Mandami il link" : isUp ? "Crea account" : "Accedi"}
        </button>
      </form>

      <p style={{ margin: "0.9rem 0 0", textAlign: "center" }}>
        <button type="button" className="linkbtn"
                onClick={() => setMode(isForgot ? "in" : "forgot")}>
          {isForgot ? "← Torna al login" : "Password dimenticata?"}
        </button>
      </p>
    </div>
  );
}

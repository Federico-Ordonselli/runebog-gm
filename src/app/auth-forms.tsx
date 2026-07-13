"use client";

import { useActionState, useState } from "react";
import { signInAction, signUpAction, type AuthState } from "./auth-actions";

const input: React.CSSProperties = {
  width: "100%", padding: "9px 10px", marginTop: 4, boxSizing: "border-box",
  background: "#131c17", border: "1px solid #2a352e", borderRadius: 8,
  color: "#e8e3d8", font: "inherit", fontSize: 14,
};
const label: React.CSSProperties = {
  display: "block", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase",
  color: "#8b968e", marginTop: 14,
};
const submit: React.CSSProperties = {
  marginTop: 18, width: "100%", padding: "10px 14px", borderRadius: 8, cursor: "pointer",
  background: "#8fd4a8", border: "1px solid #8fd4a8", color: "#0d1411",
  font: "inherit", fontWeight: 600, fontSize: 14,
};
const tab = (active: boolean): React.CSSProperties => ({
  padding: "7px 14px", borderRadius: 8, cursor: "pointer", font: "inherit", fontSize: 14,
  background: active ? "#1b261f" : "none",
  border: "1px solid " + (active ? "#2a352e" : "transparent"),
  color: active ? "#8fd4a8" : "#8b968e",
});

export function AuthForms() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const empty: AuthState = {};
  const [inState, doSignIn, inPending] = useActionState(signInAction, empty);
  const [upState, doSignUp, upPending] = useActionState(signUpAction, empty);

  const isUp = mode === "up";
  const state = isUp ? upState : inState;
  const pending = isUp ? upPending : inPending;

  return (
    <div style={{ border: "1px solid #2a352e", borderRadius: 12, padding: 20, marginTop: 24 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <button type="button" style={tab(!isUp)} onClick={() => setMode("in")}>Accedi</button>
        <button type="button" style={tab(isUp)} onClick={() => setMode("up")}>Registrati</button>
      </div>

      <form action={isUp ? doSignUp : doSignIn} key={mode}>
        <label style={label}>Nome utente</label>
        <input name="username" autoComplete="username" required style={input}
               placeholder={isUp ? "3-32 caratteri: lettere, numeri, _ e -" : ""} />

        <label style={label}>Password</label>
        <input name="password" type="password" required style={input}
               autoComplete={isUp ? "new-password" : "current-password"}
               placeholder={isUp ? "almeno 8 caratteri" : ""} />

        {isUp && (
          <>
            <label style={label}>Email <span style={{ textTransform: "none", letterSpacing: 0 }}>(facoltativa)</span></label>
            <input name="email" type="email" autoComplete="email" style={input}
                   placeholder="serve solo a recuperare la password" />
            <p style={{ color: "#d8b25a", fontSize: 13, marginTop: 10, marginBottom: 0, lineHeight: 1.5 }}>
              ⚠️ Senza email non potrai recuperare l'account: se dimentichi la password,
              perdi le campagne. Puoi comunque esportarle in JSON quando vuoi.
            </p>
          </>
        )}

        {state.error && (
          <p role="alert" style={{ color: "#e0785f", fontSize: 14, marginTop: 14, marginBottom: 0 }}>
            {state.error}
          </p>
        )}

        <button type="submit" disabled={pending} style={{ ...submit, opacity: pending ? 0.6 : 1 }}>
          {pending ? "Attendi…" : isUp ? "Crea account" : "Accedi"}
        </button>
      </form>
    </div>
  );
}

"use client";

import { useActionState } from "react";
import { resetPasswordAction, type AuthState } from "../../auth-actions";

const input: React.CSSProperties = {
  width: "100%", padding: "9px 10px", marginTop: 4, boxSizing: "border-box",
  background: "#131c17", border: "1px solid #2a352e", borderRadius: 8,
  color: "#e8e3d8", font: "inherit", fontSize: 14,
};

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, {} as AuthState);

  if (state.notice) {
    return (
      <>
        <p style={{ color: "#8fd4a8" }}>{state.notice}</p>
        <p><a href="/" style={{ color: "#6cc3c9" }}>← Vai al login</a></p>
      </>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="token" value={token} />
      <label style={{ display: "block", fontSize: 11, letterSpacing: ".12em",
                      textTransform: "uppercase", color: "#8b968e", marginTop: 14 }}>
        Nuova password
      </label>
      <input name="password" type="password" required autoComplete="new-password"
             placeholder="almeno 8 caratteri" style={input} />

      {state.error && (
        <p role="alert" style={{ color: "#e0785f", fontSize: 14, marginTop: 14 }}>{state.error}</p>
      )}

      <button type="submit" disabled={pending}
              style={{ marginTop: 18, width: "100%", padding: "10px 14px", borderRadius: 8,
                       cursor: "pointer", background: "#8fd4a8", border: "1px solid #8fd4a8",
                       color: "#0d1411", font: "inherit", fontWeight: 600, fontSize: 14,
                       opacity: pending ? 0.6 : 1 }}>
        {pending ? "Attendi…" : "Imposta la nuova password"}
      </button>
    </form>
  );
}

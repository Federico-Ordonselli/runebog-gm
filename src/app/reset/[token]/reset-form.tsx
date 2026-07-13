"use client";

import { useActionState } from "react";
import { resetPasswordAction, type AuthState } from "../../auth-actions";

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, {} as AuthState);

  if (state.notice) {
    return (
      <>
        <p className="msg msg--ok">{state.notice}</p>
        <p><a href="/" className="link">← Vai al login</a></p>
      </>
    );
  }

  return (
    <form action={action} className="card">
      <input type="hidden" name="token" value={token} />

      <label className="field" style={{ marginTop: 0 }}>
        <span className="field__label">Nuova password</span>
        <input name="password" type="password" required autoComplete="new-password"
               placeholder="almeno 8 caratteri" className="input" />
      </label>

      {state.error && <p role="alert" className="msg msg--error">{state.error}</p>}

      <button type="submit" disabled={pending} className="btn btn--primary btn--block"
              style={{ marginTop: "1.25rem" }}>
        {pending ? "Attendi…" : "Imposta la nuova password"}
      </button>
    </form>
  );
}

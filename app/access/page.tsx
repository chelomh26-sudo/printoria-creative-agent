"use client";

import { FormEvent, useState } from "react";

export default function AccessPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function enter(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/access", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) setError(result.error ?? "Contraseña incorrecta");
    else location.assign("/");
  }

  return (
    <main className="auth-screen">
      <form className="auth-card" onSubmit={enter}>
        <div className="brand-lockup auth-brand"><div className="brand-cube" aria-hidden="true"><span /></div><div><p className="brand-name">Printoria</p><p className="brand-product">Creative Agent</p></div></div>
        <span className="section-kicker">ACCESO PRIVADO</span>
        <h1>Escribe tu contraseña</h1>
        <p>Una sola contraseña. Sin correo, registros ni confirmaciones.</p>
        <label className="field-label" htmlFor="password">Contraseña</label>
        <input autoFocus id="password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
        {error && <p className="form-notice" role="alert">{error}</p>}
        <button className="primary-button auth-submit" disabled={busy} type="submit">{busy ? "Entrando…" : "Entrar"}</button>
      </form>
    </main>
  );
}

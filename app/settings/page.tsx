"use client";

import { useEffect, useMemo, useState } from "react";
import { WorkspaceShell } from "../../components/WorkspaceShell";

type Meta = { key: string; label: string; grupo: string };

export default function SettingsPage() {
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [defaults, setDefaults] = useState<Record<string, string>>({});
  const [meta, setMeta] = useState<Meta[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => { setPrompts(d.prompts || {}); setDefaults(d.defaults || {}); setMeta(d.meta || []); }).finally(() => setLoading(false));
  }, []);

  const grupos = useMemo(() => {
    const g: Record<string, Meta[]> = {};
    for (const m of meta) (g[m.grupo] ||= []).push(m);
    return g;
  }, [meta]);

  const guardar = async () => {
    setSaving(true); setMsg("");
    const r = await fetch("/api/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompts }) }).then((x) => x.json());
    setSaving(false);
    setMsg(r.ok ? "✓ Guardado. Los cambios aplican en las próximas generaciones." : (r.error || "No se pudo guardar."));
  };

  const inp = { background: "#121517", border: "1px solid #343a3c", borderRadius: 10, color: "#f5f6f1", fontSize: 12.5, padding: "12px", width: "100%", minHeight: 120, resize: "vertical", lineHeight: 1.5, fontFamily: "inherit" } as const;

  return (
    <WorkspaceShell active="settings" title="Ajustes" subtitle="Aquí viven todos los prompts (descripciones e imágenes). Edítalos y guarda; si algo falla, ajusta y prueba. Puedes restaurar el original.">
      {loading ? <div className="empty-state">Cargando…</div> : (
        <div style={{ display: "grid", gap: 26 }}>
          {Object.entries(grupos).map(([grupo, items]) => (
            <div key={grupo}>
              <div style={{ color: "#96d629", fontSize: 11, fontWeight: 800, letterSpacing: ".14em", marginBottom: 12, textTransform: "uppercase" }}>{grupo}</div>
              <div style={{ display: "grid", gap: 16 }}>
                {items.map((m) => (
                  <div key={m.key} style={{ background: "rgba(27,31,33,.88)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 14, padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 10, flexWrap: "wrap" }}>
                      <label style={{ fontSize: 13, fontWeight: 700, color: "#f5f6f1" }}>{m.label}</label>
                      <button type="button" onClick={() => setPrompts((p) => ({ ...p, [m.key]: defaults[m.key] || "" }))}
                        style={{ background: "transparent", border: "1px solid rgba(255,255,255,.15)", color: "#9da4a6", borderRadius: 8, fontSize: 11, padding: "5px 10px", cursor: "pointer" }}>↺ Restaurar original</button>
                    </div>
                    <textarea value={prompts[m.key] ?? ""} onChange={(e) => setPrompts((p) => ({ ...p, [m.key]: e.target.value }))} style={inp} />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div style={{ display: "flex", gap: 12, alignItems: "center", position: "sticky", bottom: 0, background: "linear-gradient(transparent, #111416 40%)", padding: "14px 0" }}>
            <button className="primary-button" disabled={saving} onClick={guardar} type="button">{saving ? "Guardando…" : "Guardar cambios"}</button>
            {msg && <span style={{ fontSize: 12.5, color: msg.startsWith("✓") ? "#c5f169" : "#ffd28a" }}>{msg}</span>}
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
}

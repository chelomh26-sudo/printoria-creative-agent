"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { WorkspaceShell } from "../../components/WorkspaceShell";

type Meta = { key: string; label: string; grupo: string };

export default function SettingsPage() {
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [defaults, setDefaults] = useState<Record<string, string>>({});
  const [meta, setMeta] = useState<Meta[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const upRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const allRef = useRef<HTMLInputElement | null>(null);

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
    setMsg(r.ok ? "✓ Guardado. Aplica en las próximas generaciones." : (r.error || "No se pudo guardar."));
  };

  const docName = (label: string) => (label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, " ").trim().replace(/\s+/g, "-").toLowerCase() || "prompt") + ".md";
  const bajar = (nombre: string, texto: string) => {
    const blob = new Blob([texto ?? ""], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = nombre; a.click();
    URL.revokeObjectURL(url);
  };

  const subirUno = async (key: string, file: File | null) => {
    if (!file) return;
    const t = await file.text();
    setPrompts((p) => ({ ...p, [key]: t }));
    setMsg(`✓ Cargado "${file.name}" en el editor. No olvides Guardar.`);
  };

  const bajarTodo = () => bajar("prompts-printoria.json", JSON.stringify(prompts, null, 2));
  const subirTodo = async (file: File | null) => {
    if (!file) return;
    try {
      const o = JSON.parse(await file.text());
      if (o && typeof o === "object") { setPrompts((p) => ({ ...p, ...o })); setMsg("✓ Cargado el archivo. Revisa y Guarda."); }
    } catch { setMsg("Ese archivo no es un JSON válido de prompts."); }
  };

  const inp = { background: "#121517", border: "1px solid #343a3c", borderRadius: 10, color: "#f5f6f1", fontSize: 12.5, padding: "12px", width: "100%", minHeight: 240, resize: "vertical", lineHeight: 1.5, fontFamily: "inherit" } as const;
  const mini = { background: "transparent", border: "1px solid rgba(255,255,255,.15)", color: "#9da4a6", borderRadius: 8, fontSize: 11, padding: "5px 10px", cursor: "pointer", whiteSpace: "nowrap" } as const;

  return (
    <WorkspaceShell active="settings" title="Ajustes" subtitle="Todos los prompts como documentos: velos, edítalos, descárgalos o sube una versión actualizada. Si algo falla, ajusta y prueba. Puedes restaurar el original.">
      {loading ? <div className="empty-state">Cargando…</div> : (
        <div style={{ display: "grid", gap: 26 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button style={mini} onClick={bajarTodo} type="button">⬇ Descargar todo (respaldo)</button>
            <button style={mini} onClick={() => allRef.current?.click()} type="button">⬆ Subir respaldo</button>
            <input ref={(el) => { allRef.current = el; }} type="file" accept=".json,application/json" style={{ display: "none" }} onChange={(e) => subirTodo(e.target.files?.[0] || null)} />
          </div>

          {Object.entries(grupos).map(([grupo, items]) => (
            <div key={grupo}>
              <div style={{ color: "#96d629", fontSize: 11, fontWeight: 800, letterSpacing: ".14em", marginBottom: 12, textTransform: "uppercase" }}>{grupo}</div>
              <div style={{ display: "grid", gap: 16 }}>
                {items.map((m) => (
                  <div key={m.key} style={{ background: "rgba(27,31,33,.88)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 14, padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 10, flexWrap: "wrap" }}>
                      <label style={{ fontSize: 13, fontWeight: 700, color: "#f5f6f1" }}>{m.label}</label>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button style={mini} type="button" onClick={() => bajar(docName(m.label), prompts[m.key] ?? "")}>⬇ Descargar</button>
                        <button style={mini} type="button" onClick={() => upRefs.current[m.key]?.click()}>⬆ Subir</button>
                        <input ref={(el) => { upRefs.current[m.key] = el; }} type="file" accept=".txt,.md,text/plain" style={{ display: "none" }} onChange={(e) => subirUno(m.key, e.target.files?.[0] || null)} />
                        <button style={mini} type="button" onClick={() => setPrompts((p) => ({ ...p, [m.key]: defaults[m.key] || "" }))}>↺ Restaurar</button>
                      </div>
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

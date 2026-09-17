"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createElement, useEffect, useRef, useState } from "react";

const box = { background: "#121517", border: "1px solid #343a3c", borderRadius: 10, color: "#f5f6f1", fontSize: 13, padding: "10px 12px", fontFamily: "inherit" } as const;
const btn = { padding: "10px 16px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, border: "1px solid #96D629", background: "rgba(150,214,41,.14)", color: "#c5f169" } as const;
const btnGhost = { ...btn, border: "1px solid #343a3c", background: "#121517", color: "#f5f6f1", fontWeight: 500 } as const;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function Generador3D({ imageUrl }: { imageUrl?: string }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState("");
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [stlUrl, setStlUrl] = useState<string | null>(null);
  const [baseTaskId, setBaseTaskId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const mvLoaded = useRef(false);

  useEffect(() => {
    if (mvLoaded.current) return; mvLoaded.current = true;
    const s = document.createElement("script");
    s.type = "module"; s.src = "https://cdn.jsdelivr.net/npm/@google/model-viewer@4.0.0/dist/model-viewer.min.js";
    document.head.appendChild(s);
  }, []);

  async function pollUntilDone(taskId: string): Promise<string | null> {
    for (let i = 0; i < 100; i++) {
      const j = await fetch(`/api/produccion/modelo3d?taskId=${taskId}`).then((x) => x.json());
      if (j.error) throw new Error(j.error);
      setProgress(Number(j.progress) || 0); setStatusMsg(`${j.status} · ${j.progress ?? 0}%`);
      if (j.status === "success") return j.modelUrl as string;
      if (j.status === "failed" || j.status === "cancelled" || j.status === "error") throw new Error("La tarea 3D falló en Tripo.");
      await sleep(4000);
    }
    throw new Error("Tardó demasiado. Intenta de nuevo.");
  }
  async function generar() {
    if (!imageUrl) { setNotice("Falta la imagen del concepto."); return; }
    setBusy(true); setNotice(""); setModelUrl(null); setStlUrl(null); setProgress(0); setStatusMsg("Subiendo imagen a la IA 3D…");
    try {
      const start = await fetch("/api/produccion/modelo3d", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "start", imageUrl }) }).then((x) => x.json());
      if (!start.ok || !start.taskId) throw new Error(start.error || "No se pudo iniciar el modelo 3D.");
      setBaseTaskId(start.taskId);
      const url = await pollUntilDone(start.taskId); setModelUrl(url); setStatusMsg("Modelo listo ✓");
    } catch (e: any) { setNotice(e.message); setStatusMsg(""); } finally { setBusy(false); }
  }
  async function convertirSTL() {
    if (!baseTaskId) return; setBusy(true); setNotice(""); setStatusMsg("Convirtiendo a STL…");
    try {
      const start = await fetch("/api/produccion/modelo3d", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "convert", taskId: baseTaskId }) }).then((x) => x.json());
      if (!start.ok || !start.taskId) throw new Error(start.error || "No se pudo iniciar la conversión.");
      const url = await pollUntilDone(start.taskId); setStlUrl(url); setStatusMsg("STL listo ✓");
    } catch (e: any) { setNotice(e.message); } finally { setBusy(false); }
  }

  return (
    <div style={{ ...box, marginTop: 18, textAlign: "left" }}>
      <p style={{ marginTop: 0, fontSize: 14, fontWeight: 800, color: "#c5f169" }}>Convertir a modelo 3D (STL)</p>
      <p style={{ fontSize: 12, color: "#9aa0a2", marginTop: 0 }}>Usa la imagen de arriba como base. Requiere TRIPO_API_KEY en Vercel.</p>
      {!modelUrl && <button style={btn} disabled={busy} onClick={generar} type="button">{busy ? "Generando 3D…" : "Convertir a modelo 3D ⬢"}</button>}
      {(busy || statusMsg) && <p style={{ fontSize: 13, color: "#c5f169", marginBottom: 6 }}>{statusMsg}</p>}
      {busy && <div style={{ height: 8, background: "#0b0b0b", borderRadius: 4, overflow: "hidden", maxWidth: 320 }}><div style={{ width: `${progress}%`, height: "100%", background: "#96D629", transition: "width .4s" }} /></div>}
      {modelUrl && (
        <div style={{ marginTop: 12 }}>
          {createElement("model-viewer" as any, { src: modelUrl, "camera-controls": true, "auto-rotate": true, style: { width: "100%", maxWidth: 420, height: 340, background: "#0b0b0b", borderRadius: 10 } })}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <a style={{ ...btnGhost, textDecoration: "none", display: "inline-block" }} href={modelUrl} target="_blank" rel="noreferrer">⬇ Modelo (GLB)</a>
            {!stlUrl && <button style={btn} disabled={busy} onClick={convertirSTL} type="button">{busy ? "Convirtiendo…" : "Convertir a STL"}</button>}
            {stlUrl && <a style={{ ...btn, textDecoration: "none", display: "inline-block" }} href={stlUrl} target="_blank" rel="noreferrer">⬇ STL (imprimir)</a>}
          </div>
        </div>
      )}
      {notice && <p style={{ color: "#ff8a8a", fontSize: 13 }}>{notice}</p>}
    </div>
  );
}

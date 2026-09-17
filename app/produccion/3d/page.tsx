"use client";
/* eslint-disable @next/next/no-img-element, @typescript-eslint/no-explicit-any */
import { ChangeEvent, createElement, useEffect, useRef, useState } from "react";
import { WorkspaceShell } from "../../../components/WorkspaceShell";

type DynamicQuestion = { id: string; question: string; reason: string; type: "single_choice" | "multiple_choice" | "free_text"; required: boolean; placeholder: string | null; options: string[] };
type ProjectAnalysis = { product_summary: string; questions: DynamicQuestion[] };
type CreativePlan = { concept: string; scene: string };

const box = { background: "#121517", border: "1px solid #343a3c", borderRadius: 10, color: "#f5f6f1", fontSize: 13, padding: "10px 12px", fontFamily: "inherit" } as const;
const btn = { padding: "10px 16px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, border: "1px solid #96D629", background: "rgba(150,214,41,.14)", color: "#c5f169" } as const;
const btnGhost = { ...btn, border: "1px solid #343a3c", background: "#121517", color: "#f5f6f1", fontWeight: 500 } as const;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Page() {
  const [modo, setModo] = useState<"ia" | "foto">("ia");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  // IA concepto
  const [idea, setIdea] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ProjectAnalysis | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [plan, setPlan] = useState<CreativePlan | null>(null);
  const [conceptUrl, setConceptUrl] = useState<string | null>(null); // signed supabase url del concepto
  const [iaStage, setIaStage] = useState<"input" | "questions" | "plan" | "concept">("input");

  // 3D
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState("");
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [stlUrl, setStlUrl] = useState<string | null>(null);
  const [baseTaskId, setBaseTaskId] = useState<string | null>(null);
  const mvLoaded = useRef(false);

  useEffect(() => {
    if (mvLoaded.current) return; mvLoaded.current = true;
    const s = document.createElement("script");
    s.type = "module"; s.src = "https://cdn.jsdelivr.net/npm/@google/model-viewer@4.0.0/dist/model-viewer.min.js";
    document.head.appendChild(s);
  }, []);

  function answerQ(id: string, value: string, multiple = false) {
    setAnswers((cur) => {
      if (!multiple) return { ...cur, [id]: value };
      const sel = Array.isArray(cur[id]) ? (cur[id] as string[]) : [];
      return { ...cur, [id]: sel.includes(value) ? sel.filter((x) => x !== value) : [...sel, value] };
    });
  }

  async function iaAnalizar() {
    if (idea.trim().length < 12) { setNotice("Describe qué objeto quieres y qué cambiar (ej. portadados jaguar)."); return; }
    setBusy(true); setNotice("");
    const form = new FormData();
    form.set("idea", idea.trim());
    form.set("title", idea.trim().split(/\s+/).slice(0, 6).join(" "));
    form.set("assetRoles", JSON.stringify(file ? ["reference"] : []));
    form.set("tipo", "modelo3d"); form.set("formato", "1:1");
    if (file) form.append("files", file);
    try {
      const r = await fetch("/api/projects", { method: "POST", body: form });
      const j = await r.json();
      if (!r.ok || !j.id || !j.analysis) throw new Error(j.error || "No se pudo analizar.");
      setProjectId(j.id); setAnalysis(j.analysis);
      const init: Record<string, string | string[]> = {};
      for (const q of j.analysis.questions as DynamicQuestion[]) init[q.id] = q.type === "multiple_choice" ? [] : "";
      setAnswers(init); setIaStage("questions");
    } catch (e: any) { setNotice(e.message); } finally { setBusy(false); }
  }
  async function iaPlan() {
    if (!projectId) return; setBusy(true); setNotice("");
    try {
      const r = await fetch("/api/projects", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "plan", projectId, answers, tipo: "modelo3d", formato: "1:1" }) });
      const j = await r.json();
      if (!r.ok || !j.plan) throw new Error(j.error || "No se pudo crear el plan.");
      setPlan(j.plan); setIaStage("plan");
    } catch (e: any) { setNotice(e.message); } finally { setBusy(false); }
  }
  async function iaConcepto() {
    if (!projectId || !plan) return; setBusy(true); setNotice("Generando el concepto… (10-30s)");
    try {
      const r = await fetch("/api/projects", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "approve", projectId, plan, tipo: "modelo3d", formato: "1:1" }) });
      const j = await r.json();
      if (!r.ok || !j.imageUrl) throw new Error(j.error || "No se pudo generar el concepto.");
      setConceptUrl(j.imageUrl); setIaStage("concept"); setNotice("");
    } catch (e: any) { setNotice(e.message); } finally { setBusy(false); }
  }

  async function pollUntilDone(taskId: string): Promise<string | null> {
    for (let i = 0; i < 100; i++) {
      const j = await fetch(`/api/produccion/modelo3d?taskId=${taskId}`).then((x) => x.json());
      if (j.error) throw new Error(j.error);
      setProgress(Number(j.progress) || 0);
      setStatusMsg(`${j.status} · ${j.progress ?? 0}%`);
      if (j.status === "success") return j.modelUrl as string;
      if (j.status === "failed" || j.status === "cancelled" || j.status === "error") throw new Error("La tarea 3D falló en Tripo.");
      await sleep(4000);
    }
    throw new Error("Tardó demasiado. Intenta de nuevo.");
  }

  async function generar3D(payload: { imageUrl?: string; imageDataUrl?: string }) {
    setBusy(true); setNotice(""); setModelUrl(null); setStlUrl(null); setProgress(0); setStatusMsg("Subiendo imagen a la IA 3D…");
    try {
      const start = await fetch("/api/produccion/modelo3d", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "start", ...payload }) }).then((x) => x.json());
      if (!start.ok || !start.taskId) throw new Error(start.error || "No se pudo iniciar el modelo 3D.");
      setBaseTaskId(start.taskId);
      const url = await pollUntilDone(start.taskId);
      setModelUrl(url); setStatusMsg("Modelo listo ✓");
    } catch (e: any) { setNotice(e.message); setStatusMsg(""); } finally { setBusy(false); }
  }

  async function convertirSTL() {
    if (!baseTaskId) return; setBusy(true); setNotice(""); setStatusMsg("Convirtiendo a STL…");
    try {
      const start = await fetch("/api/produccion/modelo3d", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "convert", taskId: baseTaskId }) }).then((x) => x.json());
      if (!start.ok || !start.taskId) throw new Error(start.error || "No se pudo iniciar la conversión.");
      const url = await pollUntilDone(start.taskId);
      setStlUrl(url); setStatusMsg("STL listo ✓");
    } catch (e: any) { setNotice(e.message); } finally { setBusy(false); }
  }

  function fotoDirecta(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => generar3D({ imageDataUrl: String(reader.result) });
    reader.readAsDataURL(f); e.target.value = "";
  }

  return (
    <WorkspaceShell active="prod3d" title="Foto → 3D" subtitle="Convierte una foto o un concepto en un modelo 3D imprimible (STL) usando IA de modelado.">
      <div style={{ ...box, marginBottom: 14, background: "rgba(150,214,41,.06)", borderColor: "rgba(150,214,41,.25)" }}>
        <p style={{ margin: 0, fontSize: 12.5, color: "#c5f169" }}>Requiere <b>TRIPO_API_KEY</b> en Vercel. La IA de foto→3D funciona muy bien en objetos/juguetes; el STL a veces necesita un repaso antes de imprimir.</p>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <button style={modo === "ia" ? btn : btnGhost} onClick={() => setModo("ia")} type="button">Con IA (cambiar el objeto)</button>
        <button style={modo === "foto" ? btn : btnGhost} onClick={() => setModo("foto")} type="button">Mi foto tal cual</button>
      </div>

      {modo === "foto" && (
        <section style={{ ...box, marginBottom: 18 }}>
          <p style={{ marginTop: 0, color: "#9aa0a2", fontSize: 13 }}>Sube una foto del objeto (fondo limpio, bien iluminado) y la IA lo reconstruye en 3D tal cual.</p>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={fotoDirecta} disabled={busy} />
        </section>
      )}

      {modo === "ia" && (
        <section style={{ ...box, marginBottom: 18 }}>
          {iaStage === "input" && (<>
            <p style={{ marginTop: 0, color: "#9aa0a2", fontSize: 13 }}>Describe el objeto y qué cambiar. Ej: “un portadados como este pero que sea un jaguar y que sostenga los dados en la mano”. Puedes subir una foto de referencia.</p>
            <textarea value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="Qué objeto quieres y qué cambiar de la referencia" style={{ ...box, width: "100%", minHeight: 90, marginBottom: 10 }} />
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <div style={{ marginTop: 12 }}><button style={btn} disabled={busy} onClick={iaAnalizar} type="button">{busy ? "Analizando…" : "Analizar y preguntarme →"}</button></div>
          </>)}

          {iaStage === "questions" && analysis && (<>
            <p style={{ marginTop: 0, color: "#c5f169", fontSize: 13 }}>✓ {analysis.product_summary}</p>
            {analysis.questions.map((q) => (
              <fieldset key={q.id} style={{ border: "1px solid #2a2f31", borderRadius: 10, padding: 12, marginBottom: 10 }}>
                <legend style={{ fontSize: 13, fontWeight: 700 }}>{q.question}</legend>
                <p style={{ fontSize: 12, color: "#9aa0a2", margin: "2px 0 8px" }}>{q.reason}</p>
                {q.type === "free_text" ? (
                  <textarea value={typeof answers[q.id] === "string" ? (answers[q.id] as string) : ""} onChange={(e) => answerQ(q.id, e.target.value)} placeholder={q.placeholder ?? "Escribe tu respuesta"} style={{ ...box, width: "100%", minHeight: 60 }} />
                ) : (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {q.options.map((o) => {
                      const multi = q.type === "multiple_choice";
                      const sel = multi ? (Array.isArray(answers[q.id]) && (answers[q.id] as string[]).includes(o)) : answers[q.id] === o;
                      return <button key={o} type="button" onClick={() => answerQ(q.id, o, multi)} style={{ ...(sel ? btn : btnGhost), padding: "8px 12px" }}>{o}</button>;
                    })}
                  </div>
                )}
              </fieldset>
            ))}
            <button style={btn} disabled={busy} onClick={iaPlan} type="button">{busy ? "Creando plan…" : "Crear plan →"}</button>
          </>)}

          {iaStage === "plan" && plan && (<>
            <p style={{ marginTop: 0, fontSize: 13 }}><b style={{ color: "#c5f169" }}>Concepto:</b> {plan.concept}</p>
            <p style={{ fontSize: 13, color: "#cdd3d0" }}>{plan.scene}</p>
            <button style={btn} disabled={busy} onClick={iaConcepto} type="button">{busy ? "Generando…" : "Generar concepto ✦"}</button>
          </>)}

          {iaStage === "concept" && conceptUrl && (<>
            <p style={{ marginTop: 0, fontSize: 12, color: "#9aa0a2" }}>Concepto generado:</p>
            <img src={conceptUrl} alt="concepto" style={{ maxWidth: 260, borderRadius: 8, background: "#0b0b0b" }} />
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button style={btn} disabled={busy} onClick={() => generar3D({ imageUrl: conceptUrl })} type="button">{busy ? "Generando 3D…" : "Convertir a modelo 3D ⬢"}</button>
              <button style={btnGhost} disabled={busy} onClick={() => { setIaStage("input"); setConceptUrl(null); setPlan(null); setAnalysis(null); }} type="button">Empezar de nuevo</button>
            </div>
          </>)}
        </section>
      )}

      {(busy || statusMsg || modelUrl) && (
        <section style={{ ...box, marginBottom: 18 }}>
          {statusMsg && <p style={{ marginTop: 0, fontSize: 13, color: "#c5f169" }}>{statusMsg}</p>}
          {busy && <div style={{ height: 8, background: "#0b0b0b", borderRadius: 4, overflow: "hidden", maxWidth: 320 }}><div style={{ width: `${progress}%`, height: "100%", background: "#96D629", transition: "width .4s" }} /></div>}
          {modelUrl && (
            <div style={{ marginTop: 14 }}>
              {createElement("model-viewer" as any, { src: modelUrl, "camera-controls": true, "auto-rotate": true, style: { width: "100%", maxWidth: 420, height: 340, background: "#0b0b0b", borderRadius: 10 } })}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                <a style={{ ...btnGhost, textDecoration: "none", display: "inline-block" }} href={modelUrl} target="_blank" rel="noreferrer">⬇ Modelo (GLB)</a>
                {!stlUrl && <button style={btn} disabled={busy} onClick={convertirSTL} type="button">{busy ? "Convirtiendo…" : "Convertir a STL para imprimir"}</button>}
                {stlUrl && <a style={{ ...btn, textDecoration: "none", display: "inline-block" }} href={stlUrl} target="_blank" rel="noreferrer">⬇ STL (imprimir)</a>}
              </div>
            </div>
          )}
        </section>
      )}

      {notice && <p style={{ color: "#ff8a8a", fontSize: 13 }}>{notice}</p>}
    </WorkspaceShell>
  );
}

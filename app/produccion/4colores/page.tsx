"use client";
/* eslint-disable @next/next/no-img-element, @typescript-eslint/no-explicit-any */
import { ChangeEvent, useMemo, useRef, useState } from "react";
import { WorkspaceShell } from "../../../components/WorkspaceShell";

type Filamento = { nombre: string; hex: string; on: boolean };
type DynamicQuestion = { id: string; question: string; reason: string; type: "single_choice" | "multiple_choice" | "free_text"; required: boolean; placeholder: string | null; options: string[] };
type ProjectAnalysis = { product_summary: string; questions: DynamicQuestion[] };
type CreativePlan = { concept: string; scene: string; headline?: string };

const FIL_DEFAULT: Filamento[] = [
  { nombre: "Negro", hex: "#141414", on: true },
  { nombre: "Blanco", hex: "#F2F2F2", on: true },
  { nombre: "Rojo", hex: "#C0392B", on: true },
  { nombre: "Verde", hex: "#3AA655", on: true },
];

const box = { background: "#121517", border: "1px solid #343a3c", borderRadius: 10, color: "#f5f6f1", fontSize: 13, padding: "10px 12px", fontFamily: "inherit" } as const;
const btn = { padding: "10px 16px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, border: "1px solid #96D629", background: "rgba(150,214,41,.14)", color: "#c5f169" } as const;
const btnGhost = { ...btn, border: "1px solid #343a3c", background: "#121517", color: "#f5f6f1", fontWeight: 500 } as const;

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  const v = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function nearestIndex(r: number, g: number, b: number, pal: [number, number, number][]): number {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < pal.length; i++) {
    const [pr, pg, pb] = pal[i];
    // distancia perceptual simple (más peso al verde)
    const d = 0.3 * (r - pr) ** 2 + 0.59 * (g - pg) ** 2 + 0.11 * (b - pb) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

export default function Page() {
  const [modo, setModo] = useState<"subir" | "ia">("subir");
  const [baseUrl, setBaseUrl] = useState<string | null>(null); // dataURL de la imagen a cuantizar
  const [fils, setFils] = useState<Filamento[]>(FIL_DEFAULT);
  const [quantUrl, setQuantUrl] = useState<string | null>(null);
  const [areas, setAreas] = useState<{ nombre: string; hex: string; pct: number }[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const layersRef = useRef<Record<string, string>>({});

  // ---- flujo IA (caricatura tipo sticker) ----
  const [idea, setIdea] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ProjectAnalysis | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [plan, setPlan] = useState<CreativePlan | null>(null);
  const [iaStage, setIaStage] = useState<"input" | "questions" | "plan" | "done">("input");

  const enabled = useMemo(() => fils.filter((f) => f.on), [fils]);

  function onUpload(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => { setBaseUrl(String(reader.result)); setQuantUrl(null); setAreas([]); };
    reader.readAsDataURL(f);
    e.target.value = "";
  }

  function cuantizar() {
    if (!baseUrl) { setNotice("Primero sube o genera una imagen."); return; }
    const pal = enabled.map((f) => hexToRgb(f.hex));
    if (!pal.length) { setNotice("Activa al menos un filamento."); return; }
    const img = new Image();
    img.onload = () => {
      const maxW = 1024;
      const scale = img.width > maxW ? maxW / img.width : 1;
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const cv = canvasRef.current!; cv.width = w; cv.height = h;
      const ctx = cv.getContext("2d")!;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h);
      const px = data.data;
      const count = new Array(pal.length).fill(0);
      // capas por color (cada una: ese color opaco, el resto transparente)
      const layers = pal.map(() => ctx.createImageData(w, h));
      let visibles = 0;
      for (let i = 0; i < px.length; i += 4) {
        const a = px[i + 3];
        if (a < 128) { px[i + 3] = 0; continue; } // conserva transparencia
        const idx = nearestIndex(px[i], px[i + 1], px[i + 2], pal);
        const [pr, pg, pb] = pal[idx];
        px[i] = pr; px[i + 1] = pg; px[i + 2] = pb; px[i + 3] = 255;
        count[idx]++; visibles++;
        const L = layers[idx].data; L[i] = pr; L[i + 1] = pg; L[i + 2] = pb; L[i + 3] = 255;
      }
      ctx.putImageData(data, 0, 0);
      setQuantUrl(cv.toDataURL("image/png"));
      // guardar capas
      const lmap: Record<string, string> = {};
      layers.forEach((ld, i) => {
        const lc = document.createElement("canvas"); lc.width = w; lc.height = h;
        lc.getContext("2d")!.putImageData(ld, 0, 0);
        lmap[enabled[i].nombre] = lc.toDataURL("image/png");
      });
      layersRef.current = lmap;
      setAreas(enabled.map((f, i) => ({ nombre: f.nombre, hex: f.hex, pct: visibles ? Math.round((count[i] / visibles) * 100) : 0 })));
      setNotice("");
    };
    img.onerror = () => setNotice("No pude leer la imagen.");
    img.src = baseUrl;
  }

  function descargar(dataUrl: string, nombre: string) {
    const a = document.createElement("a"); a.href = dataUrl; a.download = nombre; a.click();
  }

  // ---- IA: analizar / plan / generar ----
  async function iaAnalizar() {
    if (idea.trim().length < 12) { setNotice("Describe un poco más qué quieres (mínimo una frase)."); return; }
    if (!file) { setNotice("Sube la foto real (ej. la mascota de tu escuela)."); return; }
    setBusy(true); setNotice("");
    const form = new FormData();
    form.set("idea", idea.trim());
    form.set("title", idea.trim().split(/\s+/).slice(0, 6).join(" "));
    form.set("assetRoles", JSON.stringify(["locked"]));
    form.set("tipo", "sticker");
    form.set("formato", "1:1");
    form.append("files", file);
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
    if (!projectId) return;
    setBusy(true); setNotice("");
    try {
      const r = await fetch("/api/projects", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "plan", projectId, answers, tipo: "sticker", formato: "1:1" }) });
      const j = await r.json();
      if (!r.ok || !j.plan) throw new Error(j.error || "No se pudo crear el plan.");
      setPlan(j.plan); setIaStage("plan");
    } catch (e: any) { setNotice(e.message); } finally { setBusy(false); }
  }
  async function iaGenerar() {
    if (!projectId || !plan) return;
    setBusy(true); setNotice("Generando la caricatura… (10-30s)");
    try {
      const r = await fetch("/api/projects", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "approve", projectId, plan, tipo: "sticker", formato: "1:1" }) });
      const j = await r.json();
      if (!r.ok || !j.imageUrl) throw new Error(j.error || "No se pudo generar.");
      const pr = await fetch(`/api/produccion/imagen?url=${encodeURIComponent(j.imageUrl)}`).then((x) => x.json());
      if (!pr.dataUrl) throw new Error(pr.error || "No se pudo traer la imagen.");
      setBaseUrl(pr.dataUrl); setQuantUrl(null); setAreas([]); setIaStage("done"); setNotice("Caricatura lista. Ahora cuantízala a 4 colores abajo. 👇");
    } catch (e: any) { setNotice(e.message); } finally { setBusy(false); }
  }
  function answerQ(id: string, value: string, multiple = false) {
    setAnswers((cur) => {
      if (!multiple) return { ...cur, [id]: value };
      const sel = Array.isArray(cur[id]) ? (cur[id] as string[]) : [];
      return { ...cur, [id]: sel.includes(value) ? sel.filter((x) => x !== value) : [...sel, value] };
    });
  }

  return (
    <WorkspaceShell active="prod4" title="4 Colores" subtitle="Convierte una imagen en un diseño de pocos colores, listo para imprimir a varios filamentos en la Bambu A1.">
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <button style={modo === "subir" ? btn : btnGhost} onClick={() => setModo("subir")} type="button">Subir imagen</button>
        <button style={modo === "ia" ? btn : btnGhost} onClick={() => setModo("ia")} type="button">Generar caricatura con IA</button>
      </div>

      {modo === "subir" && (
        <section style={{ ...box, marginBottom: 18 }}>
          <p style={{ marginTop: 0, color: "#9aa0a2", fontSize: 13 }}>Sube un logo, dibujo o foto. Se reducirá a los colores de tus filamentos.</p>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onUpload} />
        </section>
      )}

      {modo === "ia" && (
        <section style={{ ...box, marginBottom: 18 }}>
          {iaStage === "input" && (<>
            <p style={{ marginTop: 0, color: "#9aa0a2", fontSize: 13 }}>Sube la foto real y dime qué quieres. La IA la vuelve caricatura tipo sticker y luego la pasamos a 4 colores. Ej: “un llavero de la mascota de mi escuela, estilo caricatura simpática”.</p>
            <textarea value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="Describe qué quieres (mascota escolar → llavero caricatura, etc.)" style={{ ...box, width: "100%", minHeight: 90, marginBottom: 10 }} />
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
            <button style={btn} disabled={busy} onClick={iaGenerar} type="button">{busy ? "Generando…" : "Generar caricatura ✦"}</button>
          </>)}

          {iaStage === "done" && <p style={{ color: "#c5f169", fontSize: 13, margin: 0 }}>✓ Caricatura lista abajo. Cuantízala a 4 colores.</p>}
        </section>
      )}

      {baseUrl && (
        <section style={{ ...box, marginBottom: 18 }}>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div>
              <p style={{ fontSize: 12, color: "#9aa0a2", margin: "0 0 6px" }}>Original</p>
              <img src={baseUrl} alt="original" style={{ maxWidth: 260, borderRadius: 8, background: "#0b0b0b" }} />
            </div>
            {quantUrl && (
              <div>
                <p style={{ fontSize: 12, color: "#9aa0a2", margin: "0 0 6px" }}>4 colores</p>
                <img src={quantUrl} alt="cuantizada" style={{ maxWidth: 260, borderRadius: 8, background: "#0b0b0b" }} />
              </div>
            )}
          </div>

          <p style={{ fontSize: 13, fontWeight: 700, margin: "18px 0 8px" }}>Filamentos (colores de salida)</p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {fils.map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, ...box, padding: "8px 10px" }}>
                <input type="checkbox" checked={f.on} onChange={() => setFils((c) => c.map((x, j) => j === i ? { ...x, on: !x.on } : x))} />
                <input type="color" value={f.hex} onChange={(e) => setFils((c) => c.map((x, j) => j === i ? { ...x, hex: e.target.value } : x))} style={{ width: 30, height: 26, border: "none", background: "none" }} />
                <input value={f.nombre} onChange={(e) => setFils((c) => c.map((x, j) => j === i ? { ...x, nombre: e.target.value } : x))} style={{ ...box, width: 90, padding: "6px 8px" }} />
              </div>
            ))}
          </div>

          <div style={{ marginTop: 14 }}>
            <button style={btn} onClick={cuantizar} type="button">Convertir a {enabled.length} colores</button>
          </div>

          {areas.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 8px" }}>Área por color (aprox. cuánto filamento usa)</p>
              {areas.map((a) => (
                <div key={a.nombre} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span style={{ width: 16, height: 16, borderRadius: 4, background: a.hex, border: "1px solid #444" }} />
                  <span style={{ fontSize: 13, width: 90 }}>{a.nombre}</span>
                  <div style={{ flex: 1, maxWidth: 240, height: 8, background: "#0b0b0b", borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${a.pct}%`, height: "100%", background: a.hex }} /></div>
                  <span style={{ fontSize: 12, color: "#9aa0a2" }}>{a.pct}%</span>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                {quantUrl && <button style={btn} onClick={() => descargar(quantUrl, "printoria-4colores.png")} type="button">⬇ PNG a 4 colores</button>}
                {enabled.map((f) => (
                  <button key={f.nombre} style={btnGhost} onClick={() => { const d = layersRef.current[f.nombre]; if (d) descargar(d, `capa-${f.nombre}.png`); }} type="button">⬇ Capa {f.nombre}</button>
                ))}
              </div>
              <p style={{ fontSize: 12, color: "#9aa0a2", marginTop: 12 }}>Tip: en OrcaSlicer importa el PNG a 4 colores y asigna cada color a un filamento del AMS; o usa las capas por color para separar zonas.</p>
            </div>
          )}
        </section>
      )}

      {notice && <p style={{ color: "#c5f169", fontSize: 13 }}>{notice}</p>}
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </WorkspaceShell>
  );
}

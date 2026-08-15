"use client";
/* eslint-disable @next/next/no-img-element -- private Supabase signed URLs expire and should not be optimized */

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Stage = "input" | "questions" | "plan" | "approved";
type DynamicQuestion = { id: string; question: string; reason: string; type: "single_choice" | "multiple_choice" | "free_text"; required: boolean; placeholder: string | null; options: string[] };
type ProjectAnalysis = { status: string; product_summary: string; objective_guess: string | null; audience_guess: string | null; primary_benefit: string | null; verified_facts: string[]; hypotheses: string[]; preservation_rules: string[]; questions: DynamicQuestion[] };
type CreativePlan = { concept: string; rationale: string; objective: string; audience: string; format: string; visual_composition: string[]; hero_asset: string; scene: string; headline: string; subheadline: string; cta: string; references_used: string[]; ai_generated_elements: string[]; preserved_real_elements: string[]; restrictions: string[]; qa_checklist: string[] };
type ImageResult = { url: string; model: string; imageCostUsd: number; totalCostUsd: number };
const steps = [
  { id: "input", label: "Entrada" },
  { id: "questions", label: "Preguntas" },
  { id: "plan", label: "Plan creativo" },
  { id: "approved", label: "Generación" },
] as const;

export default function Home() {
  const [stage, setStage] = useState<Stage>("input");
  const [idea, setIdea] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [assetLocked, setAssetLocked] = useState(true);
  const [analysis, setAnalysis] = useState<ProjectAnalysis | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [creativePlan, setCreativePlan] = useState<CreativePlan | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [imageResult, setImageResult] = useState<ImageResult | null>(null);
  const currentIndex = steps.findIndex((step) => step.id === stage);
  const projectTitle = useMemo(() => idea.trim() ? idea.trim().split(/\s+/).slice(0, 6).join(" ") : "Nuevo creativo", [idea]);
  const goal = analysis?.objective_guess ?? "orders";

  useEffect(() => {
    const existingId = new URLSearchParams(window.location.search).get("project");
    if (!existingId) return;
    fetch(`/api/projects?id=${encodeURIComponent(existingId)}`).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo abrir el proyecto.");
      const project = result.project;
      setProjectId(project.id);
      setIdea(project.idea ?? "");
      setAnswers(project.form_answers ?? {});
      setCreativePlan(project.creative_plan && Object.keys(project.creative_plan).length ? project.creative_plan : null);
      setAnalysis(result.analysis ?? null);
      if (result.imageUrl) setImageResult({ url: result.imageUrl, model: result.imageModel ?? IMAGE_MODEL_LABEL, imageCostUsd: 0, totalCostUsd: Number(project.total_cost_usd ?? 0) });
      if (result.imageUrl) setStage("approved");
      else if (project.creative_plan && Object.keys(project.creative_plan).length) setStage("plan");
      else setStage("questions");
      setNotice("Proyecto existente cargado. Puedes modificarlo y continuar.");
    }).catch((reason) => setNotice(reason.message));
  }, []);

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    setFiles(Array.from(event.target.files ?? []));
  }

  function answerQuestion(id: string, value: string, multiple = false) {
    setAnswers((current) => {
      if (!multiple) return { ...current, [id]: value };
      const selected = Array.isArray(current[id]) ? current[id] as string[] : [];
      return { ...current, [id]: selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value] };
    });
  }

  async function analyze() {
    if (idea.trim().length < 12) {
      setNotice("Cuéntame un poco más de la idea para poder analizarla.");
      return;
    }
    setBusy(true);
    setNotice("");
    const form = new FormData();
    form.set("idea", idea.trim());
    form.set("title", projectTitle);
    form.set("assetLocked", String(assetLocked));
    files.forEach((file) => form.append("files", file));
    const response = await fetch("/api/projects", { method: "POST", body: form });
    const result = await response.json();
    if (!response.ok || !result.id || !result.analysis) {
      setBusy(false);
      setNotice(result.error ?? "No se pudo guardar el proyecto.");
      return;
    }
    setProjectId(result.id);
    setAnalysis(result.analysis);
    const initialAnswers: Record<string, string | string[]> = {};
    for (const question of result.analysis.questions as DynamicQuestion[]) initialAnswers[question.id] = question.type === "multiple_choice" ? [] : "";
    setAnswers(initialAnswers);
    setBusy(false);
    setStage("questions");
  }

  async function createPlan() {
    if (!projectId) return;
    const missing = analysis?.questions.some((question) => question.required && (!answers[question.id] || (Array.isArray(answers[question.id]) && answers[question.id].length === 0)));
    if (missing) {
      setNotice("Responde las preguntas obligatorias antes de continuar.");
      return;
    }
    setBusy(true);
    const response = await fetch("/api/projects", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "plan", projectId, answers, goal }) });
    const result = await response.json();
    setBusy(false);
    if (!response.ok || !result.plan) setNotice(result.error ?? "No se pudo crear el plan.");
    else { setCreativePlan(result.plan); setNotice(""); setStage("plan"); }
  }

  async function approvePlan() {
    if (!projectId) return;
    setBusy(true);
    if (!creativePlan) return;
    const plan = creativePlan;
    const response = await fetch("/api/projects", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "approve", projectId, plan }) });
    const result = await response.json();
    setBusy(false);
    if (!response.ok || !result.imageUrl) setNotice(result.error ?? "No se pudo generar la imagen.");
    else {
      setImageResult({ url: result.imageUrl, model: result.model, imageCostUsd: result.imageCostUsd, totalCostUsd: result.totalCostUsd });
      setNotice("");
      setStage("approved");
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-cube" aria-hidden="true"><span /></div>
          <div><p className="brand-name">Printoria</p><p className="brand-product">Creative Agent</p></div>
        </div>
        <nav className="side-nav" aria-label="Navegación principal">
          <Link className="nav-item active" href="/"><span>✦</span> Nuevo creativo</Link>
          <Link className="nav-item" href="/projects"><span>▦</span> Mis proyectos</Link>
          <Link className="nav-item" href="/library"><span>◇</span> Biblioteca de marca</Link>
        </nav>
        <div className="sidebar-status">
          <div className="status-row"><span>Plan real · v0.3</span><span className="status-pill">Activo</span></div>
          <p>GPT Mini analiza y crea el brief. Seedream 4.5 genera el borrador visual después de aprobar.</p>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div><p className="eyebrow">PROYECTO NUEVO</p><h1>{projectTitle}</h1></div>
          <div className="topbar-actions"><div className="budget-card"><span>Costo estimado</span><strong>{stage === "input" ? "$0.00" : stage === "questions" ? "$0.05" : "$0.08"}</strong><small>Límite $0.80 USD</small></div><button className="logout-button" onClick={() => fetch("/api/access", { method: "DELETE" }).then(() => location.assign("/access"))} type="button">Salir</button></div>
        </header>

        <ol className="stepper" aria-label="Progreso del creativo">
          {steps.map((step, index) => (
            <li className={`${index === currentIndex ? "current" : ""} ${index < currentIndex ? "complete" : ""}`} key={step.id}>
              <span className="step-number">{index < currentIndex ? "✓" : index + 1}</span><span>{step.label}</span>
            </li>
          ))}
        </ol>

        <div className="content-wrap">
          {stage === "input" && (
            <section className="panel">
              <div className="panel-heading"><span className="section-kicker">FASE 1</span><h2>¿Qué quieres crear?</h2><p>Explícamelo como lo harías normalmente. El director analizará tu idea y tus fotografías antes de proponer algo.</p></div>
              <label className="field-label" htmlFor="idea">Tu idea o producto</label>
              <textarea id="idea" onChange={(event) => setIdea(event.target.value)} placeholder="Ejemplo: Quiero anunciar este producto para guardar cables. Se puede personalizar y quiero conseguir pedidos por WhatsApp..." value={idea} />
              <div className="text-meta"><span>Escribe con tus propias palabras</span><span>{idea.length} caracteres</span></div>
              <div className="asset-section">
                <div><label className="field-label" htmlFor="assets">Fotografías y referencias</label><p className="field-help">Producto real, pedido real, logo, mascota o referencia visual.</p></div>
                <label className="dropzone" htmlFor="assets"><span className="upload-mark">↑</span><strong>{files.length ? `${files.length} archivo(s) seleccionado(s)` : "Arrastra tus archivos aquí"}</strong><span>o haz clic para elegirlos · PNG, JPG o WEBP</span><input accept="image/png,image/jpeg,image/webp" id="assets" multiple onChange={handleFiles} type="file" /></label>
              </div>
              {files.length > 0 && <div className="asset-card"><div className="file-stack">{files.length}</div><div className="asset-copy"><strong>{files[0].name}</strong><span>{files.length > 1 ? `y ${files.length - 1} archivo(s) más` : "Producto real"}</span></div><label className="lock-toggle"><input checked={assetLocked} onChange={(event) => setAssetLocked(event.target.checked)} type="checkbox" /><span className="toggle-track"><span /></span>No modificar</label></div>}
              {notice && <p className="form-notice" role="alert">{notice}</p>}
              <div className="panel-actions"><p><span className="spark">✦</span> El análisis no generará ninguna imagen.</p><button className="primary-button" disabled={busy} onClick={analyze} type="button">{busy ? "Guardando…" : "Analizar proyecto"} <span>→</span></button></div>
            </section>
          )}

          {stage === "questions" && (
            <section className="panel">
              <div className="analysis-banner"><div className="analysis-icon">✓</div><div><strong>Análisis real completado</strong><p>{analysis?.product_summary}</p></div><span className="confidence">OpenRouter</span></div>
              <div className="panel-heading compact"><span className="section-kicker">FASE 2</span><h2>Sólo necesito confirmar esto</h2><p>Las preguntas cambian según el proyecto. No volveré a pedir información que ya proporcionaste.</p></div>
              {analysis?.questions.map((question) => <DynamicQuestionField answer={answers[question.id]} key={question.id} onAnswer={answerQuestion} question={question} />)}
              <div className="panel-actions"><button className="text-button" onClick={() => setStage("input")} type="button">← Volver</button><button className="primary-button" disabled={busy} onClick={createPlan} type="button">{busy ? "Guardando…" : "Crear plan creativo"} <span>→</span></button></div>
            </section>
          )}

          {stage === "plan" && (
            <section className="panel">
              <div className="panel-heading"><span className="section-kicker">ANTES DE GENERAR</span><h2>Esto es lo que voy a crear</h2><p>Revisa el concepto. No se gastará en generación hasta que lo apruebes.</p></div>
              <div className="plan-layout">
                <div className="creative-preview"><div className="preview-grid"/><span className="preview-tag">META AD · 4:5</span><div className="preview-copy"><strong>{creativePlan?.headline ?? "PLAN CREATIVO"}</strong><span>{creativePlan?.subheadline}</span></div><div className="product-orbit"><div className="product-placeholder"><span>LOCKED ASSET</span></div><span className="orbit one"/><span className="orbit two"/></div><div className="preview-cta">{creativePlan?.cta ?? "COTIZA EL TUYO"}</div><div className="preview-signature">Printoria <span>3D</span></div></div>
                <div className="plan-details"><article><span className="detail-label">CONCEPTO</span><h3>{creativePlan?.concept}</h3><p>{creativePlan?.rationale}</p></article><div className="detail-grid"><article><span className="detail-label">OBJETIVO</span><strong>{creativePlan?.objective}</strong></article><article><span className="detail-label">FORMATO</span><strong>{creativePlan?.format}</strong></article></div><article><span className="detail-label">COMPOSICIÓN</span><ul>{creativePlan?.visual_composition.map((item) => <li key={item}>{item}</li>)}</ul></article><article><span className="detail-label">GENERADO POR IA</span><ul>{creativePlan?.ai_generated_elements.map((item) => <li key={item}>{item}</li>)}</ul></article><div className="preservation-box"><span className="lock-symbol">⌑</span><div><strong>Elementos reales preservados</strong><p>{creativePlan?.preserved_real_elements.join(" · ")}</p></div></div></div>
              </div>
              {notice && <p className="form-notice" role="alert">{notice}</p>}
              <div className="panel-actions approval-actions"><button className="secondary-button" onClick={() => setStage("questions")} type="button">Ajustar respuestas</button><button className="primary-button" disabled={busy} onClick={approvePlan} type="button">{busy ? "Generando imagen…" : "Aprobar y generar"} <span>✓</span></button></div>
            </section>
          )}

          {stage === "approved" && (
            <section className="panel approved-panel"><div className="success-mark">✓</div><span className="section-kicker">BORRADOR GENERADO</span><h2>Tu primera imagen está lista</h2><p>Seedream creó este borrador 4:5 y el archivo quedó guardado de forma privada en Supabase.</p>{imageResult && <div className="generated-result"><img alt="Borrador publicitario generado para Printoria" src={imageResult.url}/><div><strong>{imageResult.model}</strong><span>{imageResult.imageCostUsd > 0 ? `Imagen: $${imageResult.imageCostUsd.toFixed(4)} USD · ` : ""}Total registrado: ${imageResult.totalCostUsd.toFixed(4)} USD</span><a href={imageResult.url} rel="noreferrer" target="_blank">Abrir imagen completa ↗</a></div></div>}<p className="generated-warning">Revisa producto, textos y logotipos. Este render todavía no garantiza preservación exacta de píxeles del LOCKED ASSET.</p><div className="result-actions"><button className="secondary-button" disabled={!creativePlan} onClick={() => setStage("plan")} type="button">Editar plan</button><button className="primary-button" onClick={() => { window.history.replaceState({}, "", "/"); setStage("input"); setProjectId(null); setIdea(""); setAnalysis(null); setCreativePlan(null); setImageResult(null); }} type="button">Crear otro proyecto</button></div></section>
          )}
        </div>
      </section>
    </main>
  );
}

const IMAGE_MODEL_LABEL = "bytedance-seed/seedream-4.5";

function DynamicQuestionField({ question, answer, onAnswer }: { question: DynamicQuestion; answer: string | string[] | undefined; onAnswer: (id: string, value: string, multiple?: boolean) => void }) {
  if (question.type === "free_text") return <fieldset className="question-block"><legend>{question.question}</legend><p>{question.reason}</p><textarea className="dynamic-answer" onChange={(event) => onAnswer(question.id, event.target.value)} placeholder={question.placeholder ?? "Escribe tu respuesta"} value={typeof answer === "string" ? answer : ""} /></fieldset>;
  const multiple = question.type === "multiple_choice";
  const selected = Array.isArray(answer) ? answer : [];
  return <fieldset className="question-block"><legend>{question.question}</legend><p>{question.reason}</p><div className="choice-grid three">{question.options.map((option) => { const active = multiple ? selected.includes(option) : answer === option; return <label className={`${multiple ? "check-card" : "choice-card"} ${active ? "selected" : ""}`} key={option}><input checked={active} name={multiple ? undefined : question.id} onChange={() => onAnswer(question.id, option, multiple)} type={multiple ? "checkbox" : "radio"}/>{multiple ? <span className="check-box">✓</span> : <span className="radio-dot"/>}<strong>{option}</strong></label>; })}</div></fieldset>;
}

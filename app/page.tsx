"use client";

import { ChangeEvent, useMemo, useState } from "react";

type Stage = "input" | "questions" | "plan" | "approved";
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
  const [mechanism, setMechanism] = useState("manual");
  const [goal, setGoal] = useState("orders");
  const [personalization, setPersonalization] = useState<string[]>(["name", "color"]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const currentIndex = steps.findIndex((step) => step.id === stage);
  const projectTitle = useMemo(() => idea.trim() ? idea.trim().split(/\s+/).slice(0, 6).join(" ") : "Nuevo creativo", [idea]);

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    setFiles(Array.from(event.target.files ?? []));
  }

  function togglePersonalization(value: string) {
    setPersonalization((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
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
    if (!response.ok || !result.id) {
      setBusy(false);
      setNotice(result.error ?? "No se pudo guardar el proyecto.");
      return;
    }
    setProjectId(result.id);
    setBusy(false);
    setStage("questions");
  }

  async function createPlan() {
    if (!projectId) return;
    setBusy(true);
    const answers = { mechanism, personalization, goal };
    const response = await fetch("/api/projects", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "plan", projectId, answers, goal }) });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) setNotice(result.error ?? "No se pudo guardar el plan.");
    else setStage("plan");
  }

  async function approvePlan() {
    if (!projectId) return;
    setBusy(true);
    const plan = { concept: "Del enredo al orden", format: "1080x1350", asset_preservation: assetLocked };
    const response = await fetch("/api/projects", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "approve", projectId, plan }) });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) setNotice(result.error ?? "No se pudo aprobar el plan.");
    else setStage("approved");
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-cube" aria-hidden="true"><span /></div>
          <div><p className="brand-name">Printoria</p><p className="brand-product">Creative Agent</p></div>
        </div>
        <nav className="side-nav" aria-label="Navegación principal">
          <button className="nav-item active" type="button"><span>✦</span> Nuevo creativo</button>
          <button className="nav-item" type="button"><span>▦</span> Mis proyectos</button>
          <button className="nav-item" type="button"><span>◇</span> Biblioteca de marca</button>
        </nav>
        <div className="sidebar-status">
          <div className="status-row"><span>Modo de prueba</span><span className="status-pill">Activo</span></div>
          <p>Las APIs y Supabase se conectarán en el siguiente checkpoint.</p>
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
              <div className="analysis-banner"><div className="analysis-icon">✓</div><div><strong>Tu producto ya fue analizado</strong><p>Detecté un guardacables personalizable. La fotografía se conservará como asset bloqueado.</p></div><span className="confidence">Confianza alta</span></div>
              <div className="panel-heading compact"><span className="section-kicker">FASE 2</span><h2>Sólo necesito confirmar esto</h2><p>Las preguntas cambian según el proyecto. No volveré a pedir información que ya proporcionaste.</p></div>
              <QuestionChoice title="¿Cómo funciona realmente para guardar el cable?" help="Esto define la demostración visual y evita anunciar un mecanismo inexistente." value={mechanism} onChange={setMechanism} options={[["manual","Se enrolla manualmente","La persona acomoda el cable en el centro."],["automatic","Es retráctil automático","El mecanismo recoge el cable por sí mismo."],["other","Usa otro mecanismo","Puedes explicarlo en el siguiente paso."]]} />
              <fieldset className="question-block"><legend>¿Qué puede personalizar el cliente?</legend><p>Puedes elegir más de una opción.</p><div className="choice-grid two">{[["name","Iniciales o nombre"],["color","Color del producto"],["none","No es personalizable"],["other","Otra opción"]].map(([value,label]) => <label className={`check-card ${personalization.includes(value) ? "selected" : ""}`} key={value}><input checked={personalization.includes(value)} onChange={() => togglePersonalization(value)} type="checkbox" /><span className="check-box">✓</span><strong>{label}</strong></label>)}</div></fieldset>
              <QuestionChoice title="¿Qué quieres conseguir con esta pieza?" help="El objetivo cambia el mensaje, la explicación y el CTA." value={goal} onChange={setGoal} options={[["orders","Conseguir pedidos","CTA a WhatsApp"],["showcase","Mostrar el producto","Publicación orgánica"],["explain","Explicar cómo funciona","Contenido demostrativo"]]} />
              <div className="panel-actions"><button className="text-button" onClick={() => setStage("input")} type="button">← Volver</button><button className="primary-button" disabled={busy} onClick={createPlan} type="button">{busy ? "Guardando…" : "Crear plan creativo"} <span>→</span></button></div>
            </section>
          )}

          {stage === "plan" && (
            <section className="panel">
              <div className="panel-heading"><span className="section-kicker">ANTES DE GENERAR</span><h2>Esto es lo que voy a crear</h2><p>Revisa el concepto. No se gastará en generación hasta que lo apruebes.</p></div>
              <div className="plan-layout">
                <div className="creative-preview"><div className="preview-grid"/><span className="preview-tag">META AD · 4:5</span><div className="preview-copy"><strong>CERO CABLES<br/><em>ENREDADOS</em></strong><span>Orden compacto y personalizado.</span></div><div className="product-orbit"><div className="product-placeholder"><span>FOTO REAL</span></div><span className="orbit one"/><span className="orbit two"/></div><div className="preview-cta">COTIZA EL TUYO</div><div className="preview-signature">Printoria <span>3D</span></div></div>
                <div className="plan-details"><article><span className="detail-label">CONCEPTO</span><h3>Del enredo al orden</h3><p>Una demostración clara del problema y la solución, con el guardacables real como protagonista.</p></article><div className="detail-grid"><article><span className="detail-label">OBJETIVO</span><strong>{goal === "orders" ? "Conseguir pedidos" : goal === "showcase" ? "Mostrar el producto" : "Explicar su uso"}</strong></article><article><span className="detail-label">FORMATO</span><strong>Feed 4:5 · 1080 × 1350</strong></article></div><article><span className="detail-label">COMPOSICIÓN</span><ul><li>Producto real grande y reconocible.</li><li>Cable suelto como tensión visual secundaria.</li><li>Fondo carbón con glow verde Printoria.</li><li>Headline, CTA y logo colocados por composición.</li></ul></article><div className="preservation-box"><span className="lock-symbol">⌑</span><div><strong>Fotografía protegida</strong><p>Forma, color, letras, cable y conectores permanecerán intactos.</p></div></div></div>
              </div>
              <div className="panel-actions approval-actions"><button className="secondary-button" onClick={() => setStage("questions")} type="button">Ajustar respuestas</button><button className="primary-button" disabled={busy} onClick={approvePlan} type="button">{busy ? "Guardando…" : "Aprobar plan"} <span>✓</span></button></div>
            </section>
          )}

          {stage === "approved" && (
            <section className="panel approved-panel"><div className="success-mark">✓</div><span className="section-kicker">PLAN APROBADO</span><h2>El flujo está listo para conectarse</h2><p>La siguiente versión llamará al modelo de imagen únicamente después de esta aprobación y registrará el costo real.</p><div className="connection-list"><div><span>1</span><strong>Supabase</strong><small>Proyectos, assets y versiones</small></div><div><span>2</span><strong>OpenRouter</strong><small>Análisis y brief estructurado</small></div><div><span>3</span><strong>Modelo visual</strong><small>Generación después de aprobar</small></div></div><button className="primary-button" onClick={() => setStage("input")} type="button">Crear otro proyecto</button></section>
          )}
        </div>
      </section>
    </main>
  );
}

function QuestionChoice({ title, help, value, onChange, options }: { title: string; help: string; value: string; onChange: (value: string) => void; options: string[][] }) {
  return <fieldset className="question-block"><legend>{title}</legend><p>{help}</p><div className="choice-grid three">{options.map(([option,label,description]) => <label className={`choice-card ${value === option ? "selected" : ""}`} key={option}><input checked={value === option} name={title} onChange={() => onChange(option)} type="radio"/><span className="radio-dot"/><strong>{label}</strong><small>{description}</small></label>)}</div></fieldset>;
}

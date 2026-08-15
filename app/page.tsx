"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "@/lib/supabase";

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
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const currentIndex = steps.findIndex((step) => step.id === stage);
  const projectTitle = useMemo(() => idea.trim() ? idea.trim().split(/\s+/).slice(0, 6).join(" ") : "Nuevo creativo", [idea]);

  useEffect(() => {
    if (!supabase) {
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);

  async function authenticate(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setNotice("");
    const result = authMode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (result.error) setNotice(result.error.message);
    else if (authMode === "signup" && !result.data.session) setNotice("Revisa tu correo para confirmar la cuenta y después inicia sesión.");
  }

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
    if (!supabase || !session) {
      setNotice("Inicia sesión para guardar el proyecto.");
      return;
    }
    setBusy(true);
    setNotice("");
    const { data: project, error } = await supabase.from("creative_projects").insert({
      owner_id: session.user.id,
      title: projectTitle,
      idea: idea.trim(),
      status: "questions",
    }).select("id").single();
    if (error || !project) {
      setBusy(false);
      setNotice(error?.message ?? "No se pudo guardar el proyecto.");
      return;
    }
    for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `${session.user.id}/${project.id}/${crypto.randomUUID()}-${safeName}`;
      const upload = await supabase.storage.from("creative-assets").upload(path, file);
      if (upload.error) {
        setBusy(false);
        setNotice(`El proyecto se guardó, pero falló ${file.name}: ${upload.error.message}`);
        setProjectId(project.id);
        return;
      }
      await supabase.from("creative_assets").insert({
        project_id: project.id,
        owner_id: session.user.id,
        asset_role: assetLocked ? "locked" : "reference",
        original_name: file.name,
        storage_path: path,
        mime_type: file.type,
      });
    }
    setProjectId(project.id);
    setBusy(false);
    setStage("questions");
  }

  async function createPlan() {
    if (!supabase || !projectId || !session) return;
    setBusy(true);
    const answers = { mechanism, personalization, goal };
    const { error } = await supabase.from("creative_projects").update({
      form_answers: answers,
      objective: goal,
      status: "plan",
      updated_at: new Date().toISOString(),
    }).eq("id", projectId);
    setBusy(false);
    if (error) setNotice(error.message);
    else setStage("plan");
  }

  async function approvePlan() {
    if (!supabase || !projectId || !session) return;
    setBusy(true);
    const plan = { concept: "Del enredo al orden", format: "1080x1350", asset_preservation: assetLocked };
    const { error } = await supabase.from("creative_projects").update({
      creative_plan: plan,
      status: "approved",
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", projectId);
    if (!error) await supabase.from("creative_briefs").upsert({ project_id: projectId, owner_id: session.user.id, brief: plan, approved: true }, { onConflict: "project_id" });
    setBusy(false);
    if (error) setNotice(error.message);
    else setStage("approved");
  }

  if (!authReady) return <main className="auth-screen"><div className="auth-card"><span className="auth-loader" />Conectando con Printoria…</div></main>;

  if (!supabaseConfigured) return <main className="auth-screen"><div className="auth-card"><h1>Falta conectar Supabase</h1><p>Las variables de entorno todavía no están disponibles en este despliegue.</p></div></main>;

  if (!session) return (
    <main className="auth-screen">
      <form className="auth-card" onSubmit={authenticate}>
        <div className="brand-lockup auth-brand"><div className="brand-cube" aria-hidden="true"><span /></div><div><p className="brand-name">Printoria</p><p className="brand-product">Creative Agent</p></div></div>
        <span className="section-kicker">ACCESO PRIVADO · V0.2.1</span>
        <h1>{authMode === "login" ? "Entra a tu estudio creativo" : "Crea tu acceso"}</h1>
        <p>Tus proyectos, fotografías y costos quedarán guardados de forma privada.</p>
        <label className="field-label" htmlFor="email">Correo</label>
        <input id="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
        <label className="field-label" htmlFor="password">Contraseña</label>
        <input id="password" minLength={6} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
        {notice && <p className="form-notice" role="alert">{notice}</p>}
        <button className="primary-button auth-submit" disabled={busy} type="submit">{busy ? "Procesando…" : authMode === "login" ? "Entrar" : "Crear cuenta"}</button>
        <button className="text-button" onClick={() => { setAuthMode(authMode === "login" ? "signup" : "login"); setNotice(""); }} type="button">{authMode === "login" ? "Crear mi primera cuenta" : "Ya tengo una cuenta"}</button>
      </form>
    </main>
  );

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
          <div className="topbar-actions"><div className="budget-card"><span>Costo estimado</span><strong>{stage === "input" ? "$0.00" : stage === "questions" ? "$0.05" : "$0.08"}</strong><small>Límite $0.80 USD</small></div><button className="logout-button" onClick={() => supabase?.auth.signOut()} type="button">Salir</button></div>
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

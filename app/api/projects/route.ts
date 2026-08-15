import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["READY", "NEEDS_USER_INPUT"] },
    product_summary: { type: "string" },
    objective_guess: { type: ["string", "null"] },
    audience_guess: { type: ["string", "null"] },
    primary_benefit: { type: ["string", "null"] },
    verified_facts: { type: "array", items: { type: "string" } },
    hypotheses: { type: "array", items: { type: "string" } },
    preservation_rules: { type: "array", items: { type: "string" } },
    questions: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          question: { type: "string" },
          reason: { type: "string" },
          type: { type: "string", enum: ["single_choice", "multiple_choice", "free_text"] },
          required: { type: "boolean" },
          placeholder: { type: ["string", "null"] },
          options: { type: "array", items: { type: "string" } },
        },
        required: ["id", "question", "reason", "type", "required", "placeholder", "options"],
        additionalProperties: false,
      },
    },
  },
  required: ["status", "product_summary", "objective_guess", "audience_guess", "primary_benefit", "verified_facts", "hypotheses", "preservation_rules", "questions"],
  additionalProperties: false,
} as const;

const PLAN_SCHEMA = {
  type: "object",
  properties: {
    concept: { type: "string" },
    rationale: { type: "string" },
    objective: { type: "string" },
    audience: { type: "string" },
    format: { type: "string" },
    visual_composition: { type: "array", minItems: 3, maxItems: 7, items: { type: "string" } },
    hero_asset: { type: "string" },
    scene: { type: "string" },
    headline: { type: "string" },
    subheadline: { type: "string" },
    cta: { type: "string" },
    references_used: { type: "array", items: { type: "string" } },
    ai_generated_elements: { type: "array", items: { type: "string" } },
    preserved_real_elements: { type: "array", items: { type: "string" } },
    restrictions: { type: "array", items: { type: "string" } },
    qa_checklist: { type: "array", minItems: 3, maxItems: 10, items: { type: "string" } },
  },
  required: ["concept", "rationale", "objective", "audience", "format", "visual_composition", "hero_asset", "scene", "headline", "subheadline", "cta", "references_used", "ai_generated_elements", "preserved_real_elements", "restrictions", "qa_checklist"],
  additionalProperties: false,
} as const;

async function createPlanWithOpenRouter(input: { idea: string; analysis: unknown; answers: unknown }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("Falta configurar OPENROUTER_API_KEY en Vercel.");
  const model = process.env.OPENROUTER_DIRECTOR_MODEL || "openai/gpt-4.1-mini";
  const system = `Eres el Director Creativo de Printoria 3D Studio. Convierte análisis y respuestas aprobadas en un plan ejecutable para un anuncio de Instagram/Facebook Feed 4:5, 1080 × 1350. No generes imagen todavía. No inventes precios, descuentos, materiales, compatibilidad, tiempos ni funciones. El producto real debe ser protagonista. Todo LOCKED ASSET se preserva sin regenerar, reinterpretar, cambiar texto, nombres, cantidades, color, forma o detalles. La IA sólo puede crear fondo, iluminación, ambiente y elementos decorativos que no alteren el producto. El copy debe ser español mexicano, claro, comercial, corto y con un solo CTA. Usa identidad Printoria: verde #96D629, negro #0B0B0B, carbón #202428, blanco #E1E0E0 y gris #555452. Devuelve un único plan, no alternativas.`;
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", "http-referer": "https://printoria-creative-agent.vercel.app", "x-title": "Printoria Creative Agent" },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, { role: "user", content: `IDEA ORIGINAL:\n${input.idea}\n\nANÁLISIS VERIFICADO:\n${JSON.stringify(input.analysis)}\n\nRESPUESTAS DEL USUARIO:\n${JSON.stringify(input.answers)}\n\nConstruye el brief y plan creativo final previo a generación.` }],
      response_format: { type: "json_schema", json_schema: { name: "printoria_creative_plan", strict: true, schema: PLAN_SCHEMA } },
      provider: { require_parameters: true },
      temperature: 0.35,
    }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message ?? "OpenRouter no pudo crear el plan.");
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("OpenRouter devolvió un plan vacío.");
  return { plan: JSON.parse(content), usage: payload.usage ?? {}, model: payload.model ?? model };
}

async function analyzeWithOpenRouter(idea: string, files: File[]) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("Falta configurar OPENROUTER_API_KEY en Vercel.");
  const imageParts = await Promise.all(files.slice(0, 4).map(async (file) => ({
    type: "image_url",
    image_url: { url: `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}` },
  })));
  const system = `Eres el Director Creativo y Analista Multimodal de Printoria 3D Studio, negocio local de Ciudad Victoria, Tamaulipas. Analiza antes de crear. Nunca generes una imagen en esta fase. Nunca inventes precio, material, promoción, función, compatibilidad, disponibilidad ni tiempo de entrega. Distingue hechos visibles, datos proporcionados e hipótesis. Si una foto es producto real o pedido real, trátala como LOCKED: puede escalarse, rotarse, recortarse y posicionarse, pero no regenerarse ni cambiar textos, nombres, cantidades, colores o detalles. Marca: cercana, profesional, creativa; vende beneficios y soluciones, no tecnología abstracta. Paleta: #96D629, #E1E0E0, #0B0B0B, #555452, #202428. El objetivo de tu respuesta es producir pocas preguntas realmente necesarias y específicas para este proyecto. Evita preguntas cuya respuesta ya esté en la idea o imagen. Usa opciones concretas cuando sea posible y free_text sólo cuando haga falta. Máximo 6 preguntas.`;
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", "http-referer": "https://printoria-creative-agent.vercel.app", "x-title": "Printoria Creative Agent" },
    body: JSON.stringify({
      model: process.env.OPENROUTER_DIRECTOR_MODEL || "openai/gpt-4.1-mini",
      messages: [{ role: "system", content: system }, { role: "user", content: [{ type: "text", text: `IDEA DEL USUARIO:\n${idea}\n\nAnaliza la idea y los archivos adjuntos. Devuelve sólo el JSON solicitado.` }, ...imageParts] }],
      response_format: { type: "json_schema", json_schema: { name: "printoria_project_analysis", strict: true, schema: ANALYSIS_SCHEMA } },
      provider: { require_parameters: true },
      temperature: 0.2,
    }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message ?? "OpenRouter no pudo analizar el proyecto.");
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("OpenRouter devolvió una respuesta vacía.");
  return { analysis: JSON.parse(content), usage: payload.usage ?? {}, generationId: payload.id ?? null, model: payload.model ?? "openai/gpt-4.1-mini" };
}

function adminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Falta configurar SUPABASE_SECRET_KEY en Vercel.");
  return createClient("https://sjstuvixonakpjezkmpk.supabase.co", key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET() {
  try {
    const { data, error } = await adminClient().from("creative_projects").select("id,title,idea,status,total_cost_usd,created_at,updated_at").order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ projects: data ?? [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error al cargar proyectos." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = adminClient();
    const form = await request.formData();
    const idea = String(form.get("idea") ?? "").trim();
    const title = String(form.get("title") ?? "Nuevo creativo");
    const locked = form.get("assetLocked") === "true";
    if (idea.length < 12) return NextResponse.json({ error: "La idea es demasiado corta." }, { status: 400 });
    const { data: project, error } = await supabase.from("creative_projects").insert({ title, idea, status: "questions" }).select("id").single();
    if (error || !project) throw error ?? new Error("No se creó el proyecto.");
    const files = form.getAll("files").filter((entry): entry is File => entry instanceof File);
    for (const entry of files) {
      if (!(entry instanceof File)) continue;
      const safeName = entry.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `private/${project.id}/${crypto.randomUUID()}-${safeName}`;
      const upload = await supabase.storage.from("creative-assets").upload(path, entry, { contentType: entry.type });
      if (upload.error) throw upload.error;
      const asset = await supabase.from("creative_assets").insert({ project_id: project.id, asset_role: locked ? "locked" : "reference", original_name: entry.name, storage_path: path, mime_type: entry.type });
      if (asset.error) throw asset.error;
    }
    const ai = await analyzeWithOpenRouter(idea, files);
    await supabase.from("creative_generations").insert({
      project_id: project.id,
      kind: "analysis",
      provider: "openrouter",
      model: ai.model,
      status: "completed",
      output_data: ai.analysis,
      input_tokens: ai.usage.prompt_tokens ?? 0,
      output_tokens: ai.usage.completion_tokens ?? 0,
      cost_usd: ai.usage.cost ?? 0,
      completed_at: new Date().toISOString(),
    });
    return NextResponse.json({ id: project.id, analysis: ai.analysis });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error al guardar." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = adminClient();
    const body = await request.json();
    if (!body.projectId) return NextResponse.json({ error: "Falta el proyecto." }, { status: 400 });
    if (body.action === "plan") {
      const { data: project, error: projectError } = await supabase.from("creative_projects").select("idea").eq("id", body.projectId).single();
      if (projectError || !project) throw projectError ?? new Error("No se encontró el proyecto.");
      const { data: analysisRow } = await supabase.from("creative_generations").select("output_data").eq("project_id", body.projectId).eq("kind", "analysis").order("created_at", { ascending: false }).limit(1).maybeSingle();
      const ai = await createPlanWithOpenRouter({ idea: project.idea, analysis: analysisRow?.output_data ?? {}, answers: body.answers });
      const { error } = await supabase.from("creative_projects").update({ form_answers: body.answers, objective: ai.plan.objective, creative_plan: ai.plan, status: "plan", updated_at: new Date().toISOString() }).eq("id", body.projectId);
      if (error) throw error;
      const brief = await supabase.from("creative_briefs").upsert({ project_id: body.projectId, brief: ai.plan, approved: false, updated_at: new Date().toISOString() }, { onConflict: "project_id" });
      if (brief.error) throw brief.error;
      await supabase.from("creative_generations").insert({ project_id: body.projectId, kind: "brief", provider: "openrouter", model: ai.model, status: "completed", output_data: ai.plan, input_tokens: ai.usage.prompt_tokens ?? 0, output_tokens: ai.usage.completion_tokens ?? 0, cost_usd: ai.usage.cost ?? 0, completed_at: new Date().toISOString() });
      return NextResponse.json({ ok: true, plan: ai.plan });
    } else if (body.action === "approve") {
      const { error } = await supabase.from("creative_projects").update({ creative_plan: body.plan, status: "approved", approved_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", body.projectId);
      if (error) throw error;
      const brief = await supabase.from("creative_briefs").upsert({ project_id: body.projectId, brief: body.plan, approved: true }, { onConflict: "project_id" });
      if (brief.error) throw brief.error;
    } else return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error al actualizar." }, { status: 500 });
  }
}

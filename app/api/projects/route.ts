import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const maxDuration = 120;

const IMAGE_MODEL = "openai/gpt-image-2";
const IMAGE_ESTIMATED_COST_USD = 0.13;

const MARKETING_SKILL = `MÓDULO DE ESTRATEGIA DE MARKETING:
- No describas simplemente lo que hace el producto. Vende la recompensa que obtiene el cliente.
- Traduce función → beneficio → resultado emocional o comercial.
- Prioriza claridad inmediata, deseo, confianza, prueba social y una promesa concreta verificable.
- Para productos de reseñas, el territorio creativo es: más confianza, mejor reputación, más reseñas y menor fricción. Ejemplos de tono, no para copiar literalmente: "Reseñas al instante", "Convierte visitas en confianza", "Más reseñas. Más confianza."
- Evita titulares explicativos como "Facilita que tus clientes..." y frases largas de manual.
- Aplica la prueba de comprensión en 2 segundos: el público debe identificar qué producto es, qué hace y qué recompensa obtiene.
- El headline vende el beneficio; el subheadline identifica el producto y explica el mecanismo con palabras simples. Ejemplo de estructura: "Llavero NFC: acerca tu teléfono y abre tu enlace".
- Nunca sacrifiques la identificación del producto por una frase aspiracional demasiado vaga.
- No prometas resultados garantizados ni inventes datos.`;

const DESIGN_SKILL = `MÓDULO DE DIRECCIÓN DE ARTE:
- El concepto visual debe relacionarse específicamente con el producto y el beneficio, no usar una composición genérica.
- Identifica la silueta real del producto y conviértela en protagonista; no la sustituyas por figuras geométricas de otro proyecto.
- Construye una escena que explique el uso en menos de dos segundos: contexto pertinente, interacción clara y jerarquía visual.
- Si el funcionamiento no es evidente por la forma del producto, muestra una demostración visual clara: producto en primer plano, teléfono acercándose, señal NFC entre ambos y resultado visible en pantalla. Evita manos o elementos que oculten el producto.
- Incluye una etiqueta descriptiva breve cuando sea necesaria para identificar la categoría, por ejemplo "LLAVERO NFC".
- Usa un solo punto focal, suficiente espacio negativo y máximo tres niveles de texto.
- La previsualización es un mapa de composición, pero debe mostrar la fotografía real del producto cuando exista.
- Logo oficial visible, legible y separado del CTA. Mascota sólo si aporta a la idea y no compite con el producto.`;

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
      minItems: 3,
      maxItems: 8,
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

async function createPlanWithOpenRouter(input: { idea: string; analysis: unknown; answers: unknown; brandContext: string }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("Falta configurar OPENROUTER_API_KEY en Vercel.");
  const model = process.env.OPENROUTER_DIRECTOR_MODEL || "openai/gpt-4.1-mini";
  const system = `Eres el Director Creativo senior de Printoria 3D Studio. Convierte el análisis y las respuestas aprobadas en un plan visual ejecutable para Instagram/Facebook Feed 4:5, 1080 × 1350. No generes imagen todavía. Debes tomar decisiones explícitas de dirección de arte: jerarquía, encuadre, escala del producto, escenario, iluminación, profundidad, ubicación del logo, densidad de texto y CTA. No inventes precios, descuentos, materiales, compatibilidad, tiempos ni funciones. El producto real debe ser protagonista. Todo LOCKED ASSET se preserva sin regenerar, reinterpretar, cambiar texto, nombres, cantidades, color, forma o detalles. Los REFERENCE ASSETS sólo inspiran estilo y composición; nunca sustituyen al producto real. Incluye siempre el logo oficial cuando haya uno disponible. La IA sólo puede crear fondo, iluminación, ambiente y elementos decorativos que no alteren el producto. El copy debe ser español mexicano, claro y comercial. REGLA DE COPY: headline de 2 a 6 palabras (máximo absoluto 8), subheadline de máximo 12 palabras y CTA de máximo 4 palabras. El beneficio debe ser directo; no conviertas una explicación en titular. Un solo CTA. Identidad Printoria: verde #96D629, negro #0B0B0B, carbón #202428, blanco #E1E0E0 y gris #555452. Devuelve un único plan, no alternativas.\n\n${MARKETING_SKILL}\n\n${DESIGN_SKILL}`;
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", "http-referer": "https://printoria-creative-agent.vercel.app", "x-title": "Printoria Creative Agent" },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, { role: "user", content: `IDEA ORIGINAL:\n${input.idea}\n\nANÁLISIS VERIFICADO:\n${JSON.stringify(input.analysis)}\n\nRESPUESTAS DEL USUARIO:\n${JSON.stringify(input.answers)}\n\nBIBLIOTECA DE MARCA:\n${input.brandContext}\n\nConstruye el brief y plan creativo final previo a generación. En references_used menciona por nombre únicamente los assets que realmente usarás.` }],
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

async function revisePlanWithOpenRouter(input: { idea: string; analysis: unknown; answers: unknown; plan: unknown; correction: string; brandContext: string }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("Falta configurar OPENROUTER_API_KEY en Vercel.");
  const model = process.env.OPENROUTER_DIRECTOR_MODEL || "openai/gpt-4.1-mini";
  const system = `Eres el Director Creativo senior de Printoria 3D Studio. Corrige un plan creativo existente siguiendo exactamente la solicitud del usuario. No generes imagen. Conserva todo lo que el usuario no pidió cambiar. No inventes información comercial. Mantén las reglas LOCKED/REFERENCE, la identidad de marca y el formato 4:5. El headline debe tener de 2 a 6 palabras (máximo absoluto 8), el subheadline máximo 12 palabras y el CTA máximo 4 palabras, incluso si estás corrigiendo otra parte del plan. Devuelve el plan completo corregido usando el esquema solicitado.\n\n${MARKETING_SKILL}\n\n${DESIGN_SKILL}`;
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", "http-referer": "https://printoria-creative-agent.vercel.app", "x-title": "Printoria Creative Agent" },
    body: JSON.stringify({ model, messages: [{ role: "system", content: system }, { role: "user", content: `IDEA ORIGINAL:\n${input.idea}\n\nANÁLISIS:\n${JSON.stringify(input.analysis)}\n\nRESPUESTAS:\n${JSON.stringify(input.answers)}\n\nBIBLIOTECA DE MARCA:\n${input.brandContext}\n\nPLAN ACTUAL:\n${JSON.stringify(input.plan)}\n\nCORRECCIÓN SOLICITADA:\n${input.correction}\n\nDevuelve el plan completo ya corregido.` }], response_format: { type: "json_schema", json_schema: { name: "printoria_revised_plan", strict: true, schema: PLAN_SCHEMA } }, provider: { require_parameters: true }, temperature: 0.2 }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message ?? "OpenRouter no pudo corregir el plan.");
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("OpenRouter devolvió una corrección vacía.");
  return { plan: JSON.parse(content), usage: payload.usage ?? {}, model: payload.model ?? model };
}

async function analyzeWithOpenRouter(idea: string, files: File[], roles: string[], brandContext: string, brandVisuals: { name: string; url: string }[]) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("Falta configurar OPENROUTER_API_KEY en Vercel.");
  const imageParts: Array<Record<string, unknown>> = [];
  for (const [index, file] of files.slice(0, 4).entries()) {
    imageParts.push({ type: "text", text: `ARCHIVO DEL PROYECTO ${index + 1}: ${file.name} · CLASIFICACIÓN: ${(roles[index] ?? "reference").toUpperCase()}` });
    imageParts.push({ type: "image_url", image_url: { url: `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}` } });
  }
  for (const visual of brandVisuals) {
    imageParts.push({ type: "text", text: `REFERENCIA VISUAL APROBADA DE LA BIBLIOTECA: ${visual.name}. Analiza su jerarquía, escena, escala, iluminación y relación texto-producto.` });
    imageParts.push({ type: "image_url", image_url: { url: visual.url } });
  }
  const system = `Eres el Director Creativo y Analista Multimodal de Printoria 3D Studio, negocio local de Ciudad Victoria, Tamaulipas. Analiza antes de crear. Nunca generes una imagen en esta fase. Nunca inventes precio, material, promoción, función, compatibilidad, disponibilidad ni tiempo de entrega. Distingue hechos visibles, datos proporcionados e hipótesis. Si una foto es producto real o pedido real, trátala como LOCKED: puede escalarse, rotarse, recortarse y posicionarse, pero no regenerarse ni cambiar textos, nombres, cantidades, colores o detalles. Los REFERENCE ASSETS sólo inspiran dirección visual; no son evidencia del producto. Debes mirar y comparar realmente las referencias visuales adjuntas. Marca: cercana, profesional y creativa; vende beneficios y soluciones. Paleta: #96D629, #E1E0E0, #0B0B0B, #555452, #202428. Produce entre 5 y 8 preguntas específicas. OBLIGATORIO: incluye preguntas con ids visual_reference, scene_and_context, interaction_or_demo y message_angle. Pregunta qué referencia desea seguir y con qué grado de fidelidad; qué escenario/contexto debe verse; qué interacción demostrará el uso; y qué recompensa/beneficio debe dominar el headline. Si por la fotografía no resulta evidente qué es el producto o cómo funciona, la pregunta interaction_or_demo debe confirmar exactamente cómo hacerlo comprensible en dos segundos. Las opciones deben describir decisiones concretas basadas en este producto y las referencias observadas, no opciones genéricas. También pregunta uso de logo/mascota si no está claro. No preguntes algo ya respondido. Para single_choice y multiple_choice ofrece opciones concretas e incluye 'Otro' cuando tenga sentido. Usa free_text sólo si una lista cerrada no basta.\n\n${MARKETING_SKILL}\n\n${DESIGN_SKILL}`;
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", "http-referer": "https://printoria-creative-agent.vercel.app", "x-title": "Printoria Creative Agent" },
    body: JSON.stringify({
      model: process.env.OPENROUTER_DIRECTOR_MODEL || "openai/gpt-4.1-mini",
      messages: [{ role: "system", content: system }, { role: "user", content: [{ type: "text", text: `IDEA DEL USUARIO:\n${idea}\n\nBIBLIOTECA DE MARCA DISPONIBLE:\n${brandContext}\n\nAnaliza la idea y los archivos adjuntos. Haz preguntas de diseño útiles antes de proponer el plan. Devuelve sólo el JSON solicitado.` }, ...imageParts] }],
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

function imagePrompt(plan: Record<string, unknown>) {
  const list = (value: unknown) => Array.isArray(value) ? value.join("; ") : String(value ?? "");
  return `Diseña una pieza publicitaria premium terminada para Instagram/Facebook Feed, relación 4:5, para Printoria 3D Studio. Debe parecer trabajo de un director de arte profesional, no una plantilla automática.

CONCEPTO: ${String(plan.concept ?? "")}
ESCENARIO: ${String(plan.scene ?? "")}
COMPOSICIÓN: ${list(plan.visual_composition)}
PRODUCTO PROTAGONISTA: ${String(plan.hero_asset ?? "producto real de la imagen de referencia")}
HEADLINE EXACTO: ${String(plan.headline ?? "")}
SUBHEADLINE EXACTO: ${String(plan.subheadline ?? "")}
CTA EXACTO: ${String(plan.cta ?? "")}
REFERENCIAS UTILIZADAS: ${list(plan.references_used)}

Dirección visual: fotografía publicitaria limpia, moderna, profesional y comercial; jerarquía clara; producto protagonista; iluminación de estudio; alto contraste; espacio negativo; diseño listo para Meta Ads. Identidad visual: negro y carbón dominantes, acentos verde lima brillante, blanco y gris neutro. Incluye el logo oficial de Printoria visible y con respiración, sin redibujarlo ni alterar texto, proporciones o colores. IMPORTANTE: los nombres y códigos de colores son instrucciones internas; jamás los escribas dentro del anuncio. No muestres códigos HEX, nombres de colores, guías, retículas, etiquetas técnicas ni texto de relleno. Usa solamente el headline, subheadline y CTA indicados arriba, perfectamente legibles y bien escritos. No inventes precios, descuentos, promociones, materiales, funciones ni datos.

PRUEBA OBLIGATORIA DE COMPRENSIÓN: al ver la pieza durante dos segundos debe quedar claro qué objeto se vende, cómo se usa y qué resultado produce. No permitas que una mano, un teléfono, el fondo o el texto oculten el producto. Si el producto es tecnológico o su mecanismo no es visible, representa la interacción de forma inequívoca y usa el subheadline para nombrar la categoría y explicar la acción.

${DESIGN_SKILL}

Las imágenes adjuntas son referencias reales del producto. Mantén al máximo su identidad visual, forma, color, conectores, letras, cantidades y detalles. No agregues productos inexistentes ni cambies nombres. Restricciones adicionales: ${list(plan.restrictions)}.`;
}

async function generateImageWithOpenRouter(prompt: string, references: string[]) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("Falta configurar OPENROUTER_API_KEY en Vercel.");
  const response = await fetch("https://openrouter.ai/api/v1/images", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", "http-referer": "https://printoria-creative-agent.vercel.app", "x-title": "Printoria Creative Agent" },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt,
      aspect_ratio: "3:4",
      quality: "high",
      n: 1,
      input_references: references.map((url) => ({ type: "image_url", image_url: { url } })),
    }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message ?? "OpenRouter no pudo generar la imagen.");
  const image = payload?.data?.[0];
  if (!image?.b64_json) throw new Error("Seedream devolvió una imagen vacía.");
  return {
    bytes: Buffer.from(image.b64_json, "base64"),
    mediaType: image.media_type || "image/png",
    cost: Number(payload?.usage?.cost ?? IMAGE_ESTIMATED_COST_USD),
    usage: payload?.usage ?? {},
  };
}

function adminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Falta configurar SUPABASE_SECRET_KEY en Vercel.");
  return createClient("https://sjstuvixonakpjezkmpk.supabase.co", key, { auth: { persistSession: false, autoRefreshToken: false } });
}

type BrandAsset = { id: string; name: string; category: string; asset_class: "reference" | "locked"; notes: string | null; storage_path: string; mime_type: string };

function describeBrandAssets(assets: BrandAsset[]) {
  if (!assets.length) return "No hay assets de marca cargados.";
  return assets.map((asset) => `- ${asset.name} | ${asset.asset_class.toUpperCase()} | ${asset.category} | ${asset.notes?.trim() || "sin descripción"}`).join("\n");
}

async function loadBrandAssets(supabase: ReturnType<typeof adminClient>) {
  const { data, error } = await supabase.from("creative_brand_assets").select("id,name,category,asset_class,notes,storage_path,mime_type").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BrandAsset[];
}

export async function GET(request: Request) {
  try {
    const supabase = adminClient();
    const projectId = new URL(request.url).searchParams.get("id");
    if (projectId) {
      const { data: project, error } = await supabase.from("creative_projects").select("id,title,idea,status,objective,form_answers,creative_plan,total_cost_usd,cost_limit_usd,created_at,updated_at").eq("id", projectId).single();
      if (error || !project) throw error ?? new Error("No se encontró el proyecto.");
      const { data: analysisRow } = await supabase.from("creative_generations").select("output_data").eq("project_id", projectId).eq("kind", "analysis").eq("status", "completed").order("created_at", { ascending: false }).limit(1).maybeSingle();
      const { data: generatedAsset } = await supabase.from("creative_assets").select("storage_path,metadata").eq("project_id", projectId).eq("asset_role", "generated").order("created_at", { ascending: false }).limit(1).maybeSingle();
      const { data: sourceAsset } = await supabase.from("creative_assets").select("storage_path").eq("project_id", projectId).in("asset_role", ["locked", "reference"]).order("created_at", { ascending: true }).limit(1).maybeSingle();
      let imageUrl: string | null = null;
      let sourceAssetUrl: string | null = null;
      if (generatedAsset?.storage_path) {
        const signed = await supabase.storage.from("creative-assets").createSignedUrl(generatedAsset.storage_path, 3600);
        imageUrl = signed.data?.signedUrl ?? null;
      }
      if (sourceAsset?.storage_path) {
        const signed = await supabase.storage.from("creative-assets").createSignedUrl(sourceAsset.storage_path, 3600);
        sourceAssetUrl = signed.data?.signedUrl ?? null;
      }
      return NextResponse.json({ project, analysis: analysisRow?.output_data ?? null, imageUrl, sourceAssetUrl, imageModel: generatedAsset?.metadata?.model ?? null });
    }
    const { data, error } = await supabase.from("creative_projects").select("id,title,idea,status,total_cost_usd,created_at,updated_at").order("created_at", { ascending: false });
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
    let assetRoles: string[] = [];
    try { assetRoles = JSON.parse(String(form.get("assetRoles") ?? "[]")); } catch { assetRoles = []; }
    if (idea.length < 12) return NextResponse.json({ error: "La idea es demasiado corta." }, { status: 400 });
    const { data: project, error } = await supabase.from("creative_projects").insert({ title, idea, status: "questions" }).select("id").single();
    if (error || !project) throw error ?? new Error("No se creó el proyecto.");
    const files = form.getAll("files").filter((entry): entry is File => entry instanceof File);
    for (const [index, entry] of files.entries()) {
      if (!(entry instanceof File)) continue;
      const safeName = entry.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `private/${project.id}/${crypto.randomUUID()}-${safeName}`;
      const upload = await supabase.storage.from("creative-assets").upload(path, entry, { contentType: entry.type });
      if (upload.error) throw upload.error;
      const assetRole = assetRoles[index] === "locked" ? "locked" : "reference";
      const asset = await supabase.from("creative_assets").insert({ project_id: project.id, asset_role: assetRole, original_name: entry.name, storage_path: path, mime_type: entry.type });
      if (asset.error) throw asset.error;
    }
    const brandAssets = await loadBrandAssets(supabase);
    const brandVisuals: { name: string; url: string }[] = [];
    for (const asset of brandAssets.filter((item) => item.category === "visual_reference").slice(0, 2)) {
      const signed = await supabase.storage.from("creative-assets").createSignedUrl(asset.storage_path, 600);
      if (signed.data?.signedUrl) brandVisuals.push({ name: asset.name, url: signed.data.signedUrl });
    }
    const ai = await analyzeWithOpenRouter(idea, files, assetRoles, describeBrandAssets(brandAssets), brandVisuals);
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
      const brandAssets = await loadBrandAssets(supabase);
      const ai = await createPlanWithOpenRouter({ idea: project.idea, analysis: analysisRow?.output_data ?? {}, answers: body.answers, brandContext: describeBrandAssets(brandAssets) });
      const { error } = await supabase.from("creative_projects").update({ form_answers: body.answers, objective: ai.plan.objective, creative_plan: ai.plan, status: "plan", updated_at: new Date().toISOString() }).eq("id", body.projectId);
      if (error) throw error;
      const brief = await supabase.from("creative_briefs").upsert({ project_id: body.projectId, brief: ai.plan, approved: false, updated_at: new Date().toISOString() }, { onConflict: "project_id" });
      if (brief.error) throw brief.error;
      await supabase.from("creative_generations").insert({ project_id: body.projectId, kind: "brief", provider: "openrouter", model: ai.model, status: "completed", output_data: ai.plan, input_tokens: ai.usage.prompt_tokens ?? 0, output_tokens: ai.usage.completion_tokens ?? 0, cost_usd: ai.usage.cost ?? 0, completed_at: new Date().toISOString() });
      return NextResponse.json({ ok: true, plan: ai.plan });
    } else if (body.action === "revise_plan") {
      const correction = String(body.correction ?? "").trim();
      if (correction.length < 3) return NextResponse.json({ error: "Escribe qué quieres corregir." }, { status: 400 });
      const { data: project, error: projectError } = await supabase.from("creative_projects").select("idea,form_answers,creative_plan").eq("id", body.projectId).single();
      if (projectError || !project) throw projectError ?? new Error("No se encontró el proyecto.");
      const { data: analysisRow } = await supabase.from("creative_generations").select("output_data").eq("project_id", body.projectId).eq("kind", "analysis").order("created_at", { ascending: false }).limit(1).maybeSingle();
      const brandAssets = await loadBrandAssets(supabase);
      const ai = await revisePlanWithOpenRouter({ idea: project.idea, analysis: analysisRow?.output_data ?? {}, answers: project.form_answers ?? {}, plan: body.plan ?? project.creative_plan ?? {}, correction, brandContext: describeBrandAssets(brandAssets) });
      const { error } = await supabase.from("creative_projects").update({ creative_plan: ai.plan, status: "plan", updated_at: new Date().toISOString() }).eq("id", body.projectId);
      if (error) throw error;
      const brief = await supabase.from("creative_briefs").upsert({ project_id: body.projectId, brief: ai.plan, approved: false, updated_at: new Date().toISOString() }, { onConflict: "project_id" });
      if (brief.error) throw brief.error;
      await supabase.from("creative_generations").insert({ project_id: body.projectId, kind: "brief", provider: "openrouter", model: ai.model, status: "completed", prompt_text: correction, output_data: ai.plan, input_tokens: ai.usage.prompt_tokens ?? 0, output_tokens: ai.usage.completion_tokens ?? 0, cost_usd: ai.usage.cost ?? 0, completed_at: new Date().toISOString() });
      return NextResponse.json({ ok: true, plan: ai.plan });
    } else if (body.action === "approve") {
      const { data: project, error: projectError } = await supabase.from("creative_projects").select("cost_limit_usd,total_cost_usd").eq("id", body.projectId).single();
      if (projectError || !project) throw projectError ?? new Error("No se encontró el proyecto.");
      if (Number(project.total_cost_usd) + IMAGE_ESTIMATED_COST_USD > Number(project.cost_limit_usd)) {
        return NextResponse.json({ error: `Generar excedería el límite de $${Number(project.cost_limit_usd).toFixed(2)} USD.` }, { status: 402 });
      }
      const { error } = await supabase.from("creative_projects").update({ creative_plan: body.plan, status: "generating", approved_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", body.projectId);
      if (error) throw error;
      const brief = await supabase.from("creative_briefs").upsert({ project_id: body.projectId, brief: body.plan, approved: true }, { onConflict: "project_id" });
      if (brief.error) throw brief.error;
      const prompt = imagePrompt(body.plan ?? {});
      const { data: generation, error: generationError } = await supabase.from("creative_generations").insert({ project_id: body.projectId, kind: "image", provider: "openrouter", model: IMAGE_MODEL, status: "running", prompt_text: prompt }).select("id").single();
      if (generationError || !generation) throw generationError ?? new Error("No se registró la generación.");
      try {
        const { data: assets, error: assetsError } = await supabase.from("creative_assets").select("storage_path").eq("project_id", body.projectId).in("asset_role", ["locked", "reference"]).limit(2);
        if (assetsError) throw assetsError;
        const references: string[] = [];
        for (const asset of assets ?? []) {
          const signed = await supabase.storage.from("creative-assets").createSignedUrl(asset.storage_path, 600);
          if (signed.data?.signedUrl) references.push(signed.data.signedUrl);
        }
        const libraryAssets = await loadBrandAssets(supabase);
        const requestedNames = Array.isArray(body.plan?.references_used) ? body.plan.references_used.map((item: unknown) => String(item).toLowerCase()) : [];
        const officialLogo = libraryAssets.find((asset) => asset.category === "logo" && asset.name.toLowerCase().includes("sin fondo")) ?? libraryAssets.find((asset) => asset.category === "logo");
        const requestedAssets = libraryAssets.filter((asset) => asset.category !== "logo" && requestedNames.some((name: string) => name.includes(asset.name.toLowerCase()) || asset.name.toLowerCase().includes(name)));
        const selectedLibraryAssets = [officialLogo, ...requestedAssets].filter((asset): asset is BrandAsset => Boolean(asset)).slice(0, Math.max(0, 4 - references.length));
        for (const asset of selectedLibraryAssets) {
          const signed = await supabase.storage.from("creative-assets").createSignedUrl(asset.storage_path, 600);
          if (signed.data?.signedUrl) references.push(signed.data.signedUrl);
        }
        const rendered = await generateImageWithOpenRouter(prompt, references);
        const extension = rendered.mediaType === "image/jpeg" ? "jpg" : rendered.mediaType === "image/webp" ? "webp" : "png";
        const outputPath = `generated/${body.projectId}/${generation.id}.${extension}`;
        const upload = await supabase.storage.from("creative-assets").upload(outputPath, rendered.bytes, { contentType: rendered.mediaType, upsert: false });
        if (upload.error) throw upload.error;
        const assetInsert = await supabase.from("creative_assets").insert({ project_id: body.projectId, asset_role: "generated", original_name: `${generation.id}.${extension}`, storage_path: outputPath, mime_type: rendered.mediaType, metadata: { model: IMAGE_MODEL, generation_id: generation.id, aspect_ratio: "3:4", target_aspect_ratio: "4:5", quality: "high" } });
        if (assetInsert.error) throw assetInsert.error;
        const completed = await supabase.from("creative_generations").update({ status: "completed", output_data: { storage_path: outputPath, aspect_ratio: "3:4", target_aspect_ratio: "4:5", quality: "high" }, input_tokens: rendered.usage.prompt_tokens ?? 0, output_tokens: rendered.usage.completion_tokens ?? 0, cost_usd: rendered.cost, completed_at: new Date().toISOString() }).eq("id", generation.id);
        if (completed.error) throw completed.error;
        const { data: costs } = await supabase.from("creative_generations").select("cost_usd").eq("project_id", body.projectId).eq("status", "completed");
        const totalCost = (costs ?? []).reduce((sum, row) => sum + Number(row.cost_usd || 0), 0);
        await supabase.from("creative_projects").update({ status: "qa", total_cost_usd: totalCost, updated_at: new Date().toISOString() }).eq("id", body.projectId);
        const signedOutput = await supabase.storage.from("creative-assets").createSignedUrl(outputPath, 3600);
        return NextResponse.json({ ok: true, imageUrl: signedOutput.data?.signedUrl, model: IMAGE_MODEL, imageCostUsd: rendered.cost, totalCostUsd: totalCost });
      } catch (generationFailure) {
        await supabase.from("creative_generations").update({ status: "failed", output_data: { error: generationFailure instanceof Error ? generationFailure.message : "Error desconocido" }, completed_at: new Date().toISOString() }).eq("id", generation.id);
        await supabase.from("creative_projects").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", body.projectId);
        throw generationFailure;
      }
    } else return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error al actualizar." }, { status: 500 });
  }
}

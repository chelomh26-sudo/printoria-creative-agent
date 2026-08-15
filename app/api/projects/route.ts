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
      const { error } = await supabase.from("creative_projects").update({ form_answers: body.answers, objective: body.goal, status: "plan", updated_at: new Date().toISOString() }).eq("id", body.projectId);
      if (error) throw error;
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

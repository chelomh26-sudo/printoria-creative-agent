import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const maxDuration = 60;
const SUPA_URL = "https://sjstuvixonakpjezkmpk.supabase.co";
const BUCKET = "posts";

function adminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Falta configurar SUPABASE_SECRET_KEY en Vercel.");
  return createClient(SUPA_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
type SB = ReturnType<typeof adminClient>;

const VOZ: Record<string, string> = {
  marikekas:
    "Marikekas: fonda de quesadillas en Ciudad Victoria, Tamaulipas, desde 1995 (fundada por Dona Marcia). Producto estrella: 'kekas' = quesadillas fritas tipo empanada (tambien suaves), en tortilla de harina, maiz blanco, rojo y azul. Eslogan: 'Quesadillas con y sin queso'. Voz: calida, de barrio, con antojo, cercana y familiar. Maximo 2 emojis. Publico: senoras 40+, familias, estudiantes, trabajadores.",
  printoria:
    "Printoria 3D Studio: negocio de impresion 3D en Ciudad Victoria. NO vende 'impresion 3D', vende productos utiles y personalizados. Voz: clara, comercial, cercana y creativa; vende el beneficio, no la funcion. Sin inventar precios ni datos.",
};

async function productContext(supabase: SB, negocio: string): Promise<string> {
  if (negocio !== "printoria") {
    return "Menu Marikekas: kekas (quesadillas fritas) con y sin queso, en tortilla de harina, maiz blanco, rojo y azul; tambien suaves. Precio promedio 100-200 MXN.";
  }
  try {
    const { data } = await supabase.from("printoria_store").select("data").eq("key", "printoria_products").single();
    const arr = Array.isArray(data?.data) ? data!.data : [];
    if (!arr.length) return "Sin catalogo de productos cargado.";
    return "Catalogo Printoria (para reconocer el producto):\n" + arr.slice(0, 40).map((p: Record<string, unknown>) => `- ${p.nombre ?? p.id}${p.descripcion ? ": " + String(p.descripcion).slice(0, 120) : ""}`).join("\n");
  } catch {
    return "No se pudo leer el catalogo de productos.";
  }
}

async function orFetch(body: unknown) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("Falta OPENROUTER_API_KEY en Vercel.");
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", "http-referer": "https://printoria-creative-agent.vercel.app", "x-title": "Printoria Redes" },
    body: JSON.stringify(body),
  });
  const p = await r.json();
  if (!r.ok) throw new Error(p?.error?.message ?? "OpenRouter fallo.");
  return p;
}
const model = () => process.env.OPENROUTER_DIRECTOR_MODEL || "openai/gpt-4.1-mini";

const ANALYZE_SCHEMA = {
  type: "object",
  properties: {
    tema: { type: "string" },
    questions: {
      type: "array", minItems: 2, maxItems: 4,
      items: { type: "object", properties: { id: { type: "string" }, question: { type: "string" }, options: { type: "array", items: { type: "string" } } }, required: ["id", "question", "options"], additionalProperties: false },
    },
  },
  required: ["tema", "questions"], additionalProperties: false,
} as const;

async function analizar(negocio: string, red: string, nota: string, imageUrl: string | null, ctx: string) {
  const sys = `Eres el social media manager de ${VOZ[negocio] || VOZ.marikekas}\n\n${ctx}\n\nVas a preparar un post para ${red === "fb" ? "Facebook" : red === "tiktok" ? "TikTok" : "Instagram"}. Mira la imagen (si hay) y detecta de que se trata. Devuelve un 'tema' corto (3-6 palabras) y de 2 a 4 preguntas rapidas para afinar la descripcion (que producto/antojo es, beneficio o gancho, y llamado a la accion). Cada pregunta con 3-4 opciones concretas basadas en lo que ves; incluye 'Otro'. No inventes precios ni datos.`;
  const userContent: Array<Record<string, unknown>> = [{ type: "text", text: `Negocio: ${negocio}. Nota del usuario: ${nota || "(ninguna)"}` }];
  if (imageUrl) userContent.push({ type: "image_url", image_url: { url: imageUrl } });
  const p = await orFetch({
    model: model(),
    messages: [{ role: "system", content: sys }, { role: "user", content: userContent }],
    response_format: { type: "json_schema", json_schema: { name: "analisis_post", strict: true, schema: ANALYZE_SCHEMA } },
    temperature: 0.3,
  });
  return JSON.parse(p.choices[0].message.content);
}

async function describir(negocio: string, red: string, tema: string, answers: Record<string, string>, ctx: string) {
  const sys = `Eres el social media manager de ${VOZ[negocio] || VOZ.marikekas}\n\n${ctx}\n\nEscribe la descripcion (caption) para ${red === "fb" ? "Facebook" : red === "tiktok" ? "TikTok" : "Instagram"} en espanol mexicano, con la voz de marca, 1-2 emojis, y 8-12 hashtags locales de Ciudad Victoria al final. Corto y con antojo/beneficio. No inventes precios ni datos. Devuelve SOLO el caption.`;
  const p = await orFetch({
    model: model(),
    messages: [{ role: "system", content: sys }, { role: "user", content: `Tema: ${tema}\nRespuestas: ${JSON.stringify(answers)}` }],
    temperature: 0.7,
  });
  return String(p.choices[0].message.content ?? "").trim();
}

async function captionProyecto(negocio: string, red: string, base: string, instruccion: string, copyActual: string, ctx: string) {
  const sys = `Eres el social media manager de ${VOZ[negocio] || VOZ.printoria}\n\n${ctx}\n\nEscribe la descripcion (caption) para ${red === "fb" ? "Facebook" : red === "tiktok" ? "TikTok" : "Instagram"} en espanol mexicano, con la voz de marca, 1-2 emojis, y 8-12 hashtags locales de Ciudad Victoria al final. Corto y con antojo/beneficio. No inventes precios ni datos. Devuelve SOLO el caption.`;
  const user = instruccion
    ? `Anuncio: ${base}\n\nCaption actual:\n${copyActual}\n\nAjuste solicitado: ${instruccion}\nReescribe el caption aplicando el ajuste.`
    : `Anuncio: ${base}\n\nEscribe el caption.`;
  const p = await orFetch({ model: model(), messages: [{ role: "system", content: sys }, { role: "user", content: user }], temperature: 0.7 });
  return String(p.choices[0].message.content ?? "").trim();
}

export async function GET() {
  try {
    const supabase = adminClient();
    const { data, error } = await supabase.from("contenido").select("*").order("fecha", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ items: data ?? [] });
  } catch (e) {
    return NextResponse.json({ items: [], error: e instanceof Error ? e.message : "error" });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = adminClient();
    const ctype = request.headers.get("content-type") || "";
    if (ctype.includes("multipart/form-data")) {
      const form = await request.formData();
      const negocio = String(form.get("negocio") || "marikekas");
      const red = String(form.get("red") || "ig");
      const tipo = String(form.get("tipo") || "post");
      const nota = String(form.get("nota") || "");
      const file = form.get("file");
      let asset_url: string | null = null;
      let esImagen = false;
      if (file instanceof File && file.size > 0) {
        esImagen = file.type.startsWith("image/");
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const path = `redes/${crypto.randomUUID()}-${safe}`;
        const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
        if (up.error) throw new Error(`No se pudo subir el archivo (bucket '${BUCKET}' publico?). ${up.error.message}`);
        asset_url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      }
      const ctx = await productContext(supabase, negocio);
      const ai = await analizar(negocio, red, nota, esImagen ? asset_url : null, ctx);
      const { data: row, error } = await supabase.from("contenido").insert({ negocio, red, tipo, tema: ai.tema, asset_url, estado: "proceso" }).select("*").single();
      if (error) throw error;
      return NextResponse.json({ id: row.id, tema: ai.tema, questions: ai.questions, asset_url });
    }
    const body = await request.json();
    if (body.action === "caption_proyecto") {
      const { data: proj } = await supabase.from("creative_projects").select("title,idea,creative_plan").eq("id", body.projectId).single();
      const plan = (proj?.creative_plan || {}) as Record<string, unknown>;
      const base = `Producto/idea: ${proj?.idea || proj?.title || ""}. Concepto: ${plan.concept || ""}. Headline: ${plan.headline || ""}. Beneficio: ${plan.subheadline || ""}. CTA: ${plan.cta || ""}.`;
      const ctx = await productContext(supabase, body.negocio || "printoria");
      const copy = await captionProyecto(body.negocio || "printoria", body.red || "ig", base, body.instruccion || "", body.copyActual || "", ctx);
      return NextResponse.json({ ok: true, copy });
    }
    if (body.action === "desde_proyecto") {
      const { data: proj } = await supabase.from("creative_projects").select("title,idea,creative_plan").eq("id", body.projectId).single();
      const { data: gen } = await supabase.from("creative_assets").select("storage_path,mime_type").eq("project_id", body.projectId).eq("asset_role", "generated").order("created_at", { ascending: false }).limit(1).maybeSingle();
      let asset_url: string | null = null;
      if (gen?.storage_path) {
        const dl = await supabase.storage.from("creative-assets").download(gen.storage_path);
        if (dl.data) {
          const ext = gen.storage_path.split(".").pop() || "png";
          const path = `redes/${crypto.randomUUID()}.${ext}`;
          const buf = Buffer.from(await dl.data.arrayBuffer());
          const up = await supabase.storage.from(BUCKET).upload(path, buf, { contentType: gen.mime_type || "image/png", upsert: false });
          if (!up.error) asset_url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
        }
      }
      const plan = (proj?.creative_plan || {}) as Record<string, unknown>;
      const copy = (body.copy && String(body.copy).trim()) ? String(body.copy) : [plan.headline, plan.subheadline, plan.cta].filter(Boolean).join("\n");
      const tema = (proj?.title as string) || String(proj?.idea || "Anuncio").slice(0, 60);
      const estado = body.fecha ? "programado" : "listo";
      const { data: row, error } = await supabase.from("contenido").insert({ negocio: body.negocio || "printoria", red: body.red || "ig", tipo: body.tipo || "post", tema, copy, asset_url, estado, fecha: body.fecha || null }).select("id").single();
      if (error) throw error;
      return NextResponse.json({ ok: true, id: row.id, asset_url });
    }
    if (body.action === "describir") {
      const ctx = await productContext(supabase, body.negocio || "marikekas");
      const copy = await describir(body.negocio || "marikekas", body.red || "ig", body.tema || "", body.answers || {}, ctx);
      const { error } = await supabase.from("contenido").update({ copy, estado: "listo" }).eq("id", body.id);
      if (error) throw error;
      return NextResponse.json({ ok: true, copy });
    }
    const row = { negocio: body.negocio ?? "marikekas", red: body.red ?? "ig", tipo: body.tipo ?? "post", tema: body.tema ?? "", copy: body.copy ?? "", estado: body.estado ?? "idea", fecha: body.fecha ?? null, asset_url: body.asset_url ?? null };
    const { data, error } = await supabase.from("contenido").insert(row).select("*").single();
    if (error) throw error;
    return NextResponse.json({ ok: true, item: data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = adminClient();
    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
    const patch: Record<string, unknown> = {};
    for (const k of ["estado", "fecha", "copy", "tema", "red", "tipo", "negocio", "link", "alcance", "likes"]) if (k in body) patch[k] = body[k];
    const { error } = await supabase.from("contenido").update(patch).eq("id", body.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}

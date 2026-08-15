import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

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
    for (const entry of form.getAll("files")) {
      if (!(entry instanceof File)) continue;
      const safeName = entry.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `private/${project.id}/${crypto.randomUUID()}-${safeName}`;
      const upload = await supabase.storage.from("creative-assets").upload(path, entry, { contentType: entry.type });
      if (upload.error) throw upload.error;
      const asset = await supabase.from("creative_assets").insert({ project_id: project.id, asset_role: locked ? "locked" : "reference", original_name: entry.name, storage_path: path, mime_type: entry.type });
      if (asset.error) throw asset.error;
    }
    return NextResponse.json({ id: project.id });
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

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function adminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Falta configurar SUPABASE_SECRET_KEY en Vercel.");
  return createClient("https://sjstuvixonakpjezkmpk.supabase.co", key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET() {
  try {
    const supabase = adminClient();
    const { data, error } = await supabase.from("creative_brand_assets").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    const assets = await Promise.all((data ?? []).map(async (asset) => {
      const signed = await supabase.storage.from("creative-assets").createSignedUrl(asset.storage_path, 3600);
      return { ...asset, preview_url: signed.data?.signedUrl ?? null };
    }));
    return NextResponse.json({ assets });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error al cargar la biblioteca." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = adminClient();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Selecciona un archivo." }, { status: 400 });
    const assetClass = form.get("assetClass") === "locked" ? "locked" : "reference";
    const category = String(form.get("category") ?? "other");
    const notes = String(form.get("notes") ?? "").trim();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `brand-library/${crypto.randomUUID()}-${safeName}`;
    const upload = await supabase.storage.from("creative-assets").upload(path, file, { contentType: file.type });
    if (upload.error) throw upload.error;
    const { data, error } = await supabase.from("creative_brand_assets").insert({ name: file.name, storage_path: path, mime_type: file.type, asset_class: assetClass, category, notes }).select("*").single();
    if (error) throw error;
    return NextResponse.json({ asset: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error al subir el archivo." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = adminClient();
    const body = await request.json();
    const id = String(body.id ?? "");
    if (!id) return NextResponse.json({ error: "Falta el asset." }, { status: 400 });
    const assetClass = body.asset_class === "locked" ? "locked" : "reference";
    const allowedCategories = ["logo", "mascot", "product", "order", "visual_reference", "document", "other"];
    const category = allowedCategories.includes(body.category) ? body.category : "other";
    const name = String(body.name ?? "").trim();
    const notes = String(body.notes ?? "").trim();
    if (!name) return NextResponse.json({ error: "Escribe un nombre para distinguir el asset." }, { status: 400 });
    const { data, error } = await supabase.from("creative_brand_assets").update({ name, asset_class: assetClass, category, notes }).eq("id", id).select("*").single();
    if (error) throw error;
    return NextResponse.json({ asset: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error al editar el asset." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = adminClient();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });
    const { data, error } = await supabase.from("creative_brand_assets").select("storage_path").eq("id", id).single();
    if (error) throw error;
    await supabase.storage.from("creative-assets").remove([data.storage_path]);
    const removed = await supabase.from("creative_brand_assets").delete().eq("id", id);
    if (removed.error) throw removed.error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error al eliminar." }, { status: 500 });
  }
}

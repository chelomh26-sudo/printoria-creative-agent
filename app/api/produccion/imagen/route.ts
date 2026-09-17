import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/produccion/imagen?url=<signed supabase url>
// Baja la imagen del lado servidor y la regresa como dataURL (mismo origen),
// para que el canvas del navegador NO se "envenene" (taint) al cuantizar.
export async function GET(request: Request) {
  try {
    const url = new URL(request.url).searchParams.get("url");
    if (!url) return NextResponse.json({ error: "Falta el parámetro url." }, { status: 400 });
    let host = "";
    try { host = new URL(url).host; } catch { return NextResponse.json({ error: "URL inválida." }, { status: 400 }); }
    if (!host.endsWith(".supabase.co")) return NextResponse.json({ error: "Host no permitido." }, { status: 400 });
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return NextResponse.json({ error: `No se pudo bajar la imagen (${r.status}).` }, { status: 502 });
    const buf = Buffer.from(await r.arrayBuffer());
    const type = r.headers.get("content-type") || "image/png";
    return NextResponse.json({ dataUrl: `data:${type};base64,${buf.toString("base64")}` });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error." }, { status: 500 });
  }
}

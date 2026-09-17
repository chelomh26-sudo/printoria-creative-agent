import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Integración con Tripo (image-to-3D). Necesita TRIPO_API_KEY en Vercel.
// No bloquea: arranca la tarea y el cliente consulta el estado por GET.
const TRIPO = "https://api.tripo3d.ai/v2/openapi";

function key() {
  const k = process.env.TRIPO_API_KEY;
  if (!k) throw new Error("Falta configurar TRIPO_API_KEY en Vercel.");
  return k;
}
const H = () => ({ authorization: `Bearer ${key()}` });

async function bytesFrom(imageUrl?: string, imageDataUrl?: string): Promise<{ buf: Buffer; ext: string; mime: string }> {
  if (imageDataUrl && imageDataUrl.startsWith("data:")) {
    const m = imageDataUrl.match(/^data:([^;]+);base64,(.*)$/);
    if (!m) throw new Error("dataURL inválida.");
    const mime = m[1]; const buf = Buffer.from(m[2], "base64");
    return { buf, mime, ext: mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : "png" };
  }
  if (imageUrl) {
    const r = await fetch(imageUrl, { cache: "no-store" });
    if (!r.ok) throw new Error(`No se pudo bajar la imagen (${r.status}).`);
    const mime = r.headers.get("content-type") || "image/png";
    const buf = Buffer.from(await r.arrayBuffer());
    return { buf, mime, ext: mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : "png" };
  }
  throw new Error("Falta imageUrl o imageDataUrl.");
}

async function uploadImage(buf: Buffer, ext: string, mime: string): Promise<string> {
  const fd = new FormData();
  fd.append("file", new Blob([new Uint8Array(buf)], { type: mime }), `input.${ext}`);
  const r = await fetch(`${TRIPO}/upload`, { method: "POST", headers: H(), body: fd });
  const j = await r.json();
  if (!r.ok || (j.code !== 0 && j.code !== undefined && j.code !== 200)) throw new Error(`Tripo upload: ${j.message || r.status}`);
  const token = j?.data?.image_token || j?.data?.file_token || j?.data?.token;
  if (!token) throw new Error("Tripo no devolvió token de imagen.");
  return token;
}

async function createTask(body: Record<string, unknown>): Promise<string> {
  const r = await fetch(`${TRIPO}/task`, { method: "POST", headers: { ...H(), "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok || !j?.data?.task_id) throw new Error(`Tripo task: ${j.message || r.status}`);
  return j.data.task_id as string;
}

export async function POST(request: Request) {
  try {
    const b = await request.json();
    if (b.action === "start") {
      const { buf, ext, mime } = await bytesFrom(b.imageUrl, b.imageDataUrl);
      const token = await uploadImage(buf, ext, mime);
      const taskId = await createTask({ type: "image_to_model", file: { type: ext === "jpg" ? "jpg" : "png", file_token: token } });
      return NextResponse.json({ ok: true, taskId, kind: "model" });
    }
    if (b.action === "convert") {
      if (!b.taskId) return NextResponse.json({ error: "Falta taskId." }, { status: 400 });
      const taskId = await createTask({ type: "convert_model", format: "STL", original_model_task_id: b.taskId });
      return NextResponse.json({ ok: true, taskId, kind: "stl" });
    }
    return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error." }, { status: 500 });
  }
}

// GET ?taskId=... -> estado + urls de salida (sirve para model y para convert/STL)
export async function GET(request: Request) {
  try {
    const taskId = new URL(request.url).searchParams.get("taskId");
    if (!taskId) return NextResponse.json({ error: "Falta taskId." }, { status: 400 });
    const r = await fetch(`${TRIPO}/task/${taskId}`, { headers: H(), cache: "no-store" });
    const j = await r.json();
    if (!r.ok || !j?.data) throw new Error(`Tripo estado: ${j.message || r.status}`);
    const d = j.data;
    const out = d.output || {};
    const modelUrl = out.pbr_model || out.model || out.base_model || null;
    const rendered = out.rendered_image || out.rendered || null;
    return NextResponse.json({ status: d.status, progress: d.progress ?? 0, modelUrl, rendered });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error." }, { status: 500 });
  }
}

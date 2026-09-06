import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { loadPrompts, PROMPT_DEFAULTS, PROMPT_META } from "../../../lib/prompts";

function adminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Falta configurar SUPABASE_SECRET_KEY en Vercel.");
  return createClient("https://sjstuvixonakpjezkmpk.supabase.co", key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET() {
  try {
    const supabase = adminClient();
    const prompts = await loadPrompts(supabase);
    return NextResponse.json({ prompts, defaults: PROMPT_DEFAULTS, meta: PROMPT_META });
  } catch (e) {
    return NextResponse.json({ prompts: PROMPT_DEFAULTS, defaults: PROMPT_DEFAULTS, meta: PROMPT_META, error: e instanceof Error ? e.message : "error" });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = adminClient();
    const body = await request.json();
    const incoming = (body && body.prompts && typeof body.prompts === "object") ? body.prompts : {};
    const clean: Record<string, string> = {};
    for (const m of PROMPT_META) if (typeof incoming[m.key] === "string") clean[m.key] = incoming[m.key];
    const { error } = await supabase.from("printoria_store").upsert({ key: "prompts", data: clean, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}

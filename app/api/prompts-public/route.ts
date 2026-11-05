import { NextResponse } from "next/server";
import { PROMPT_DEFAULTS, PROMPT_META } from "../../../lib/prompts";

// Público y de solo lectura: los prompts DEFAULT del código + su lista (meta).
// Lo usa Atlas (/panel/creativo) para mostrar el texto base. Los overrides
// (lo que Marcelo edita) viven en Supabase printoria_store.prompts y NO salen aquí.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ defaults: PROMPT_DEFAULTS, meta: PROMPT_META });
}

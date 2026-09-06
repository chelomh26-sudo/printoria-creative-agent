/* eslint-disable @typescript-eslint/no-explicit-any */
export const PROMPT_DEFAULTS: Record<string, string> = {
  voz_marikekas:
    "Marikekas: fonda de quesadillas en Ciudad Victoria, Tamaulipas, desde 1995 (fundada por Dona Marcia). Producto estrella: 'kekas' = quesadillas fritas tipo empanada (tambien suaves), en tortilla de harina, maiz blanco, rojo y azul. Eslogan: 'Quesadillas con y sin queso'. Voz: calida, de barrio, con antojo, cercana y familiar. Maximo 2 emojis. Publico: senoras 40+, familias, estudiantes, trabajadores.",
  voz_printoria:
    "Printoria 3D Studio: negocio de impresion 3D en Ciudad Victoria. NO vende 'impresion 3D', vende productos utiles y personalizados. Voz: clara, comercial, cercana y creativa; vende el beneficio, no la funcion. Sin inventar precios ni datos.",
  redes_preguntas:
    "Devuelve un 'tema' corto (3-6 palabras) y de 2 a 4 preguntas rapidas para afinar la descripcion (que producto/antojo es, beneficio o gancho, y llamado a la accion). Cada pregunta con 3-4 opciones concretas basadas en lo que ves; incluye 'Otro'. No inventes precios ni datos.",
  redes_descripcion:
    "Escribe la descripcion (caption) en espanol mexicano, con la voz de marca, 1-2 emojis, y 8-12 hashtags locales de Ciudad Victoria al final. Corto y con antojo/beneficio. No inventes precios ni datos. Devuelve SOLO el caption.",
  img_marketing:
    "MODULO DE ESTRATEGIA DE MARKETING:\n- No describas simplemente lo que hace el producto. Vende la recompensa que obtiene el cliente.\n- Traduce funcion -> beneficio -> resultado emocional o comercial.\n- Prioriza claridad inmediata, deseo, confianza, prueba social y una promesa concreta verificable.\n- El headline vende el beneficio; el subheadline identifica el producto y explica el mecanismo con palabras simples.\n- Aplica la prueba de comprension en 2 segundos: que se identifique que producto es, que hace y que recompensa da.\n- No prometas resultados garantizados ni inventes datos.",
  img_design:
    "MODULO DE DIRECCION DE ARTE:\n- El concepto visual debe relacionarse con el producto y el beneficio, no una composicion generica.\n- El producto real es protagonista; no lo sustituyas por figuras de otro proyecto.\n- La escena explica el uso en menos de 2 segundos: contexto, interaccion clara y jerarquia visual.\n- Un solo punto focal, espacio negativo y maximo tres niveles de texto.\n- Logo oficial visible, legible y separado del CTA.",
};

export const PROMPT_META: { key: string; label: string; grupo: string }[] = [
  { key: "voz_marikekas", label: "Voz de marca — Marikekas", grupo: "Voz de marca" },
  { key: "voz_printoria", label: "Voz de marca — Printoria", grupo: "Voz de marca" },
  { key: "redes_preguntas", label: "Descripciones — reglas de las preguntas", grupo: "Descripciones (Publicaciones)" },
  { key: "redes_descripcion", label: "Descripciones — reglas del caption", grupo: "Descripciones (Publicaciones)" },
  { key: "img_marketing", label: "Imágenes — estrategia de marketing", grupo: "Imágenes (Nuevo creativo)" },
  { key: "img_design", label: "Imágenes — dirección de arte", grupo: "Imágenes (Nuevo creativo)" },
];

export async function loadPrompts(supabase: any): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.from("printoria_store").select("data").eq("key", "prompts").single();
    const o = (data && data.data && typeof data.data === "object") ? data.data : {};
    return { ...PROMPT_DEFAULTS, ...o };
  } catch {
    return { ...PROMPT_DEFAULTS };
  }
}

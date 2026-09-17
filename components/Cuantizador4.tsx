"use client";
/* eslint-disable @next/next/no-img-element */
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

type Filamento = { nombre: string; hex: string; on: boolean };
const FIL_DEFAULT: Filamento[] = [
  { nombre: "Negro", hex: "#141414", on: true },
  { nombre: "Blanco", hex: "#F2F2F2", on: true },
  { nombre: "Rojo", hex: "#C0392B", on: true },
  { nombre: "Verde", hex: "#3AA655", on: true },
];
const box = { background: "#121517", border: "1px solid #343a3c", borderRadius: 10, color: "#f5f6f1", fontSize: 13, padding: "10px 12px", fontFamily: "inherit" } as const;
const btn = { padding: "10px 16px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, border: "1px solid #96D629", background: "rgba(150,214,41,.14)", color: "#c5f169" } as const;
const btnGhost = { ...btn, border: "1px solid #343a3c", background: "#121517", color: "#f5f6f1", fontWeight: 500 } as const;

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace("#", ""); const v = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const n = parseInt(v, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function nearestIndex(r: number, g: number, b: number, pal: [number, number, number][]): number {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < pal.length; i++) { const [pr, pg, pb] = pal[i]; const d = 0.3 * (r - pr) ** 2 + 0.59 * (g - pg) ** 2 + 0.11 * (b - pb) ** 2; if (d < bestD) { bestD = d; best = i; } }
  return best;
}

export function Cuantizador4({ imageUrl }: { imageUrl?: string }) {
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [fils, setFils] = useState<Filamento[]>(FIL_DEFAULT);
  const [quantUrl, setQuantUrl] = useState<string | null>(null);
  const [areas, setAreas] = useState<{ nombre: string; hex: string; pct: number }[]>([]);
  const [notice, setNotice] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const layersRef = useRef<Record<string, string>>({});
  const enabled = useMemo(() => fils.filter((f) => f.on), [fils]);

  useEffect(() => {
    let cancel = false;
    if (imageUrl) {
      fetch(`/api/produccion/imagen?url=${encodeURIComponent(imageUrl)}`).then((x) => x.json()).then((j) => {
        if (!cancel && j.dataUrl) { setBaseUrl(j.dataUrl); setQuantUrl(null); setAreas([]); }
      }).catch(() => {});
    }
    return () => { cancel = true; };
  }, [imageUrl]);

  function onUpload(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => { setBaseUrl(String(reader.result)); setQuantUrl(null); setAreas([]); };
    reader.readAsDataURL(f); e.target.value = "";
  }
  function cuantizar() {
    if (!baseUrl) { setNotice("Primero sube o genera una imagen."); return; }
    const pal = enabled.map((f) => hexToRgb(f.hex));
    if (!pal.length) { setNotice("Activa al menos un filamento."); return; }
    const img = new Image();
    img.onload = () => {
      const maxW = 1024; const scale = img.width > maxW ? maxW / img.width : 1;
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const cv = canvasRef.current!; cv.width = w; cv.height = h;
      const ctx = cv.getContext("2d")!; ctx.clearRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h); const px = data.data;
      const count = new Array(pal.length).fill(0);
      const layers = pal.map(() => ctx.createImageData(w, h));
      let visibles = 0;
      for (let i = 0; i < px.length; i += 4) {
        const a = px[i + 3]; if (a < 128) { px[i + 3] = 0; continue; }
        const idx = nearestIndex(px[i], px[i + 1], px[i + 2], pal); const [pr, pg, pb] = pal[idx];
        px[i] = pr; px[i + 1] = pg; px[i + 2] = pb; px[i + 3] = 255; count[idx]++; visibles++;
        const L = layers[idx].data; L[i] = pr; L[i + 1] = pg; L[i + 2] = pb; L[i + 3] = 255;
      }
      ctx.putImageData(data, 0, 0); setQuantUrl(cv.toDataURL("image/png"));
      const lmap: Record<string, string> = {};
      layers.forEach((ld, i) => { const lc = document.createElement("canvas"); lc.width = w; lc.height = h; lc.getContext("2d")!.putImageData(ld, 0, 0); lmap[enabled[i].nombre] = lc.toDataURL("image/png"); });
      layersRef.current = lmap;
      setAreas(enabled.map((f, i) => ({ nombre: f.nombre, hex: f.hex, pct: visibles ? Math.round((count[i] / visibles) * 100) : 0 })));
      setNotice("");
    };
    img.onerror = () => setNotice("No pude leer la imagen.");
    img.src = baseUrl;
  }
  function descargar(dataUrl: string, nombre: string) { const a = document.createElement("a"); a.href = dataUrl; a.download = nombre; a.click(); }

  return (
    <div style={{ ...box, marginTop: 18, textAlign: "left" }}>
      <p style={{ marginTop: 0, fontSize: 14, fontWeight: 800, color: "#c5f169" }}>Convertir a 4 colores (para imprimir)</p>
      {!imageUrl && <div style={{ marginBottom: 12 }}><input type="file" accept="image/png,image/jpeg,image/webp" onChange={onUpload} /></div>}
      {baseUrl && (
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div><p style={{ fontSize: 12, color: "#9aa0a2", margin: "0 0 6px" }}>Original</p><img src={baseUrl} alt="original" style={{ maxWidth: 220, borderRadius: 8, background: "#0b0b0b" }} /></div>
          {quantUrl && <div><p style={{ fontSize: 12, color: "#9aa0a2", margin: "0 0 6px" }}>4 colores</p><img src={quantUrl} alt="4 colores" style={{ maxWidth: 220, borderRadius: 8, background: "#0b0b0b" }} /></div>}
        </div>
      )}
      <p style={{ fontSize: 13, fontWeight: 700, margin: "16px 0 8px" }}>Filamentos</p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {fils.map((f, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, ...box, padding: "8px 10px" }}>
            <input type="checkbox" checked={f.on} onChange={() => setFils((c) => c.map((x, j) => j === i ? { ...x, on: !x.on } : x))} />
            <input type="color" value={f.hex} onChange={(e) => setFils((c) => c.map((x, j) => j === i ? { ...x, hex: e.target.value } : x))} style={{ width: 30, height: 26, border: "none", background: "none" }} />
            <input value={f.nombre} onChange={(e) => setFils((c) => c.map((x, j) => j === i ? { ...x, nombre: e.target.value } : x))} style={{ ...box, width: 84, padding: "6px 8px" }} />
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14 }}><button style={btn} onClick={cuantizar} type="button">Convertir a {enabled.length} colores</button></div>
      {areas.length > 0 && (
        <div style={{ marginTop: 16 }}>
          {areas.map((a) => (
            <div key={a.nombre} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{ width: 16, height: 16, borderRadius: 4, background: a.hex, border: "1px solid #444" }} />
              <span style={{ fontSize: 13, width: 84 }}>{a.nombre}</span>
              <div style={{ flex: 1, maxWidth: 220, height: 8, background: "#0b0b0b", borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${a.pct}%`, height: "100%", background: a.hex }} /></div>
              <span style={{ fontSize: 12, color: "#9aa0a2" }}>{a.pct}%</span>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {quantUrl && <button style={btn} onClick={() => descargar(quantUrl, "printoria-4colores.png")} type="button">⬇ PNG 4 colores</button>}
            {enabled.map((f) => <button key={f.nombre} style={btnGhost} onClick={() => { const d = layersRef.current[f.nombre]; if (d) descargar(d, `capa-${f.nombre}.png`); }} type="button">⬇ Capa {f.nombre}</button>)}
          </div>
        </div>
      )}
      {notice && <p style={{ color: "#c5f169", fontSize: 13 }}>{notice}</p>}
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}

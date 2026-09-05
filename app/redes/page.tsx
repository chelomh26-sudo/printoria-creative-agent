"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { WorkspaceShell } from "../../components/WorkspaceShell";

type Item = { id: string | number; negocio: string; red: string; tipo: string; tema: string; copy?: string | null; estado: string; fecha?: string | null; asset_url?: string | null; link?: string | null };
type Q = { id: string; question: string; options: string[] };

const NET: Record<string, { c: string; color: string }> = { ig: { c: "IG", color: "#E1306C" }, fb: { c: "FB", color: "#1877F2" }, tiktok: { c: "TT", color: "#c9cdcf" } };
const EST: Record<string, { l: string; color: string }> = { idea: { l: "Idea", color: "#9da4a6" }, proceso: { l: "En proceso", color: "#e0a53a" }, listo: { l: "Listo", color: "#8bc0ff" }, programado: { l: "Programado", color: "#5fd0e0" }, publicado: { l: "Publicado", color: "#96d629" } };
const NEG: Record<string, string> = { marikekas: "Marikekas", printoria: "Printoria" };
const FILTROS = ["todos", "idea", "proceso", "listo", "programado", "publicado"];

const card = { background: "rgba(27,31,33,.88)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 14 } as const;
const btn = { background: "rgba(150,214,41,.1)", border: "1px solid rgba(150,214,41,.28)", color: "#c5f169", borderRadius: 9, fontSize: 12, fontWeight: 700, padding: "8px 12px", cursor: "pointer" } as const;
const btnP = { ...btn, background: "#96d629", color: "#0b0b0b", border: "1px solid #96d629" } as const;
const inp = { background: "#0f1214", border: "1px solid #343a3c", borderRadius: 9, color: "#f5f6f1", fontSize: 12.5, padding: "10px 11px", fontFamily: "inherit" } as const;
const net = (r: string) => ({ width: 18, height: 18, borderRadius: 5, background: NET[r]?.color || "#555", color: r === "tiktok" ? "#0b0b0b" : "#fff", fontSize: 9, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" });
const estp = (e: string) => ({ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 700, color: EST[e]?.color, background: "rgba(255,255,255,.04)", border: `1px solid ${EST[e]?.color}44`, borderRadius: 999, padding: "3px 9px" });

export default function PublicacionesPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [neg, setNeg] = useState("todas");
  const [filtro, setFiltro] = useState("todos");
  const [open, setOpen] = useState(false);

  const cargar = () => { fetch("/api/redes?t=" + Date.now(), { cache: "no-store" }).then((r) => r.json()).then((d) => setItems(d.items || [])).finally(() => setLoading(false)); };
  useEffect(() => { cargar(); }, []);

  const vis = useMemo(() => items.filter((x) => (neg === "todas" || x.negocio === neg) && (filtro === "todos" || x.estado === filtro)), [items, neg, filtro]);

  const patch = async (it: Item, body: Record<string, unknown>) => {
    setItems((s) => s.map((x) => (x.id === it.id ? { ...x, ...body } : x)));
    await fetch("/api/redes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: it.id, ...body }) });
  };

  return (
    <WorkspaceShell active="redes" title="Publicaciones" subtitle="Sube el material, el agente arma la descripcion con tu voz de marca y lo dejas listo. El calendario esta en su propio modulo.">
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 6, background: "rgba(10,12,13,.6)", padding: 4, borderRadius: 12, border: "1px solid rgba(255,255,255,.08)" }}>
          {[["todas", "Todas"], ["marikekas", "Marikekas"], ["printoria", "Printoria"]].map(([k, l]) => (
            <button key={k} onClick={() => setNeg(k)} style={{ border: "none", borderRadius: 9, padding: "8px 13px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", background: neg === k ? "rgba(150,214,41,.13)" : "transparent", color: neg === k ? "#c5f169" : "#a6abad" }}>{l}</button>
          ))}
        </div>
        <button style={{ ...btnP, marginLeft: "auto" }} onClick={() => setOpen(true)}>+ Publicar algo nuevo</button>
      </div>

      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 20 }}>
        {FILTROS.map((k) => (
          <button key={k} onClick={() => setFiltro(k)} style={{ border: `1px solid ${filtro === k ? (k === "todos" ? "#96d629" : EST[k].color) : "rgba(255,255,255,.12)"}`, background: filtro === k ? "rgba(150,214,41,.08)" : "transparent", color: filtro === k ? (k === "todos" ? "#96d629" : EST[k].color) : "#8a9296", fontSize: 11.5, fontWeight: 700, borderRadius: 999, padding: "6px 13px", cursor: "pointer" }}>
            {k === "todos" ? "Todos" : EST[k].l}
          </button>
        ))}
      </div>

      {loading ? <div className="empty-state">Cargando…</div> : vis.length === 0 ? <div className="empty-state"><strong>Nada por aqui</strong><p>Dale a “Publicar algo nuevo” para empezar.</p></div> : (
        <div style={{ display: "grid", gap: 12 }}>
          {vis.map((it) => (
            <div key={it.id} style={{ ...card, padding: 14, display: "flex", gap: 14 }}>
              {it.asset_url ? <img src={it.asset_url} alt="" style={{ width: 78, height: 78, objectFit: "cover", borderRadius: 10, flex: "none" }} /> : <div style={{ width: 78, height: 78, borderRadius: 10, flex: "none", background: "rgba(150,214,41,.06)", border: "1px solid rgba(150,214,41,.18)", display: "flex", alignItems: "center", justifyContent: "center", color: "#96d629", fontSize: 24 }}>◎</div>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
                  <span style={net(it.red)}>{NET[it.red]?.c}</span>
                  <span style={estp(it.estado)}><span style={{ width: 8, height: 8, borderRadius: "50%", background: EST[it.estado]?.color }} />{EST[it.estado]?.l}</span>
                  <span style={{ color: "#8a9296", fontSize: 11 }}>{NEG[it.negocio] || it.negocio}</span>
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 650, color: "#f5f6f1" }}>{it.tema}</div>
                {it.copy ? <div style={{ color: "#9da4a6", fontSize: 11.5, lineHeight: 1.5, marginTop: 5, maxHeight: 46, overflow: "hidden", whiteSpace: "pre-wrap" }}>{it.copy}</div> : null}
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
                  <input type="datetime-local" value={it.fecha ? String(it.fecha).slice(0, 16) : ""} onChange={(e) => patch(it, { fecha: e.target.value, estado: it.estado === "publicado" ? "publicado" : "programado" })} style={inp} />
                  {it.estado !== "publicado" && <button style={btn} onClick={() => patch(it, { estado: "publicado" })}>✓ Marcar publicado</button>}
                  {it.estado === "publicado" && it.link ? <a href={it.link} target="_blank" rel="noreferrer" style={{ ...btn, textDecoration: "none" }}>Ver ↗</a> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && <NuevoPost onClose={() => setOpen(false)} onDone={() => { setOpen(false); cargar(); }} />}
    </WorkspaceShell>
  );
}

function NuevoPost({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [step, setStep] = useState(1);
  const [neg, setNeg] = useState("marikekas");
  const [red, setRed] = useState("ig");
  const [tipo, setTipo] = useState("post");
  const [nota, setNota] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [id, setId] = useState<string | number | null>(null);
  const [tema, setTema] = useState("");
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [copy, setCopy] = useState("");
  const [fecha, setFecha] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const pickFile = (f: File | null) => { setFile(f); setPreview(f && f.type.startsWith("image/") ? URL.createObjectURL(f) : null); };

  const analizar = async () => {
    setErr(""); setBusy(true);
    try {
      const fd = new FormData();
      fd.append("negocio", neg); fd.append("red", red); fd.append("tipo", tipo); fd.append("nota", nota);
      if (file) fd.append("file", file);
      const r = await fetch("/api/redes", { method: "POST", body: fd }).then((x) => x.json());
      if (r.error) throw new Error(r.error);
      setId(r.id); setTema(r.tema); setQuestions(r.questions || []); setStep(2);
    } catch (e) { setErr(e instanceof Error ? e.message : "Error al analizar"); } finally { setBusy(false); }
  };
  const generar = async () => {
    setErr(""); setBusy(true);
    try {
      const r = await fetch("/api/redes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "describir", id, negocio: neg, red, tema, answers }) }).then((x) => x.json());
      if (r.error) throw new Error(r.error);
      setCopy(r.copy || ""); setStep(3);
    } catch (e) { setErr(e instanceof Error ? e.message : "Error al generar"); } finally { setBusy(false); }
  };
  const confirmar = async () => {
    setBusy(true);
    await fetch("/api/redes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, copy, fecha, estado: "programado" }) });
    setBusy(false); onDone();
  };

  const ov = { position: "fixed", inset: 0, background: "rgba(3,6,4,.72)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflow: "auto", zIndex: 50 } as const;
  const modal = { width: "min(680px,100%)", background: "#141719", border: "1px solid rgba(255,255,255,.1)", borderRadius: 20, overflow: "hidden" } as const;
  const lab = { display: "block", fontSize: 11, color: "#9da4a6", fontWeight: 700, margin: "0 0 7px" } as const;

  return (
    <div style={ov} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modal}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 22px", borderBottom: "1px solid rgba(255,255,255,.1)" }}>
          <strong style={{ fontSize: 15 }}>Publicar algo nuevo</strong>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#9da4a6", fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ display: "flex", gap: 6, padding: "14px 22px 0" }}>
          {[1, 2, 3, 4].map((n) => <div key={n} style={{ flex: 1, height: 4, borderRadius: 3, background: n <= step ? "#96d629" : "#2a3032" }} />)}
        </div>

        <div style={{ padding: "20px 22px 4px" }}>
          {step === 1 && (<>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
              <div><span style={lab}>Negocio</span><select value={neg} onChange={(e) => setNeg(e.target.value)} style={inp}><option value="marikekas">Marikekas</option><option value="printoria">Printoria</option></select></div>
              <div><span style={lab}>Red</span><select value={red} onChange={(e) => setRed(e.target.value)} style={inp}><option value="ig">Instagram</option><option value="fb">Facebook</option><option value="tiktok">TikTok</option></select></div>
              <div><span style={lab}>Tipo</span><select value={tipo} onChange={(e) => setTipo(e.target.value)} style={inp}><option value="post">Post</option><option value="reel">Reel</option></select></div>
            </div>
            <span style={lab}>Foto o video</span>
            <div onClick={() => fileRef.current?.click()} style={{ border: "1px dashed #48524f", borderRadius: 14, padding: 22, textAlign: "center", color: "#8a9296", fontSize: 13, cursor: "pointer", background: "#0f1214" }}>
              {file ? `✓ ${file.name}` : "📸 Haz clic para subir foto/video"}
            </div>
            <input ref={fileRef} type="file" accept="image/*,video/*" style={{ display: "none" }} onChange={(e) => pickFile(e.target.files?.[0] || null)} />
            {preview && <img src={preview} alt="" style={{ width: 92, height: 112, objectFit: "cover", borderRadius: 10, marginTop: 12 }} />}
            <div style={{ marginTop: 14 }}><span style={lab}>Nota rapida (opcional)</span><input type="text" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej: promo de la semana, sabor nuevo…" style={{ ...inp, width: "100%" }} /></div>
          </>)}

          {step === 2 && (<>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(150,214,41,.1)", border: "1px solid rgba(150,214,41,.25)", color: "#c5f169", fontSize: 11, borderRadius: 999, padding: "5px 10px", marginBottom: 14 }}>🔎 Detecté: <b style={{ marginLeft: 4 }}>{tema}</b></div>
            {questions.map((q) => (
              <div key={q.id} style={{ borderTop: "1px solid rgba(255,255,255,.1)", padding: "16px 0 4px" }}>
                <p style={{ margin: "0 0 8px", fontSize: 13, color: "#e6e8e3", fontWeight: 600 }}>{q.question}</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {q.options.map((o) => {
                    const sel = answers[q.id] === o;
                    return <button key={o} onClick={() => setAnswers((a) => ({ ...a, [q.id]: o }))} style={{ border: `1px solid ${sel ? "#96d629" : "#343a3c"}`, background: sel ? "rgba(150,214,41,.1)" : "#0f1214", color: sel ? "#c5f169" : "#cdd3d0", fontSize: 12, borderRadius: 9, padding: "8px 12px", cursor: "pointer" }}>{o}</button>;
                  })}
                </div>
              </div>
            ))}
          </>)}

          {step === 3 && (<>
            <span style={lab}>Descripcion (puedes editarla)</span>
            <textarea value={copy} onChange={(e) => setCopy(e.target.value)} style={{ ...inp, width: "100%", minHeight: 150, resize: "vertical", lineHeight: 1.5 }} />
            <button style={{ ...btn, marginTop: 10 }} disabled={busy} onClick={generar}>{busy ? "…" : "↻ Regenerar"}</button>
          </>)}

          {step === 4 && (<>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(150,214,41,.1)", border: "1px solid rgba(150,214,41,.25)", color: "#c5f169", fontSize: 11, borderRadius: 999, padding: "5px 10px", marginBottom: 14 }}>✓ Descripcion lista</div>
            <span style={lab}>¿Que dia y hora se programa?</span>
            <input type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} style={{ ...inp, width: "100%" }} />
            <p style={{ color: "#8a9296", fontSize: 12, margin: "14px 0 0" }}>Al confirmar se guarda como <b style={{ color: "#5fd0e0" }}>programado</b> y aparece en el Calendario. La publicacion automatica se conecta despues.</p>
          </>)}

          {err && <p className="form-notice" style={{ marginTop: 14 }}>{err}</p>}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "16px 22px", borderTop: "1px solid rgba(255,255,255,.1)", marginTop: 14 }}>
          <button onClick={() => step > 1 ? setStep(step - 1) : onClose()} style={{ background: "transparent", border: "none", color: "#8a9296", fontSize: 12, cursor: "pointer" }}>{step > 1 ? "‹ Atras" : "Cancelar"}</button>
          {step === 1 && <button style={busy ? { ...btnP, opacity: .6 } : btnP} disabled={busy} onClick={analizar}>{busy ? "Analizando…" : "Analizar ›"}</button>}
          {step === 2 && <button style={busy ? { ...btnP, opacity: .6 } : btnP} disabled={busy} onClick={generar}>{busy ? "Escribiendo…" : "Generar descripcion ›"}</button>}
          {step === 3 && <button style={btnP} onClick={() => setStep(4)}>Continuar ›</button>}
          {step === 4 && <button style={busy ? { ...btnP, opacity: .6 } : btnP} disabled={busy || !fecha} onClick={confirmar}>{busy ? "…" : "✓ Confirmar y programar"}</button>}
        </div>
      </div>
    </div>
  );
}

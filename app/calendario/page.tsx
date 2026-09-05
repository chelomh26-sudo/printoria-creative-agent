"use client";

import { useEffect, useMemo, useState } from "react";
import { WorkspaceShell } from "../../components/WorkspaceShell";

type Item = { id: string | number; negocio: string; red: string; tipo: string; tema: string; estado: string; fecha?: string | null; asset_url?: string | null; link?: string | null };

const NET: Record<string, { c: string; color: string }> = { ig: { c: "IG", color: "#E1306C" }, fb: { c: "FB", color: "#1877F2" }, tiktok: { c: "TT", color: "#c9cdcf" } };
const EST: Record<string, { l: string; color: string }> = { idea: { l: "Idea", color: "#9da4a6" }, proceso: { l: "En proceso", color: "#e0a53a" }, listo: { l: "Listo", color: "#8bc0ff" }, programado: { l: "Programado", color: "#5fd0e0" }, publicado: { l: "Publicado", color: "#96d629" } };
const NEG: Record<string, string> = { marikekas: "Marikekas", printoria: "Printoria" };
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DOW = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];

const net = (r: string) => ({ width: 16, height: 16, borderRadius: 4, background: NET[r]?.color || "#555", color: r === "tiktok" ? "#0b0b0b" : "#fff", fontSize: 8, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" });

export default function CalendarioPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [neg, setNeg] = useState("todas");
  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth());
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [sel, setSel] = useState<string | null>(null);

  useEffect(() => { fetch("/api/redes?t=" + Date.now(), { cache: "no-store" }).then((r) => r.json()).then((d) => setItems(d.items || [])).finally(() => setLoading(false)); }, []);

  const conFecha = useMemo(() => items.filter((x) => x.fecha && (neg === "todas" || x.negocio === neg)), [items, neg]);
  const porDia = useMemo(() => {
    const m: Record<string, Item[]> = {};
    for (const it of conFecha) {
      const d = new Date(it.fecha as string);
      if (d.getMonth() === mes && d.getFullYear() === anio) { const k = String(d.getDate()); (m[k] ||= []).push(it); }
    }
    return m;
  }, [conFecha, mes, anio]);

  const primer = (new Date(anio, mes, 1).getDay() + 6) % 7;
  const dias = new Date(anio, mes + 1, 0).getDate();
  const celdas: (number | null)[] = [];
  for (let i = 0; i < primer; i++) celdas.push(null);
  for (let d = 1; d <= dias; d++) celdas.push(d);

  const prev = () => (mes === 0 ? (setMes(11), setAnio(anio - 1)) : setMes(mes - 1));
  const next = () => (mes === 11 ? (setMes(0), setAnio(anio + 1)) : setMes(mes + 1));

  const esHoy = (d: number) => d === hoy.getDate() && mes === hoy.getMonth() && anio === hoy.getFullYear();
  const selItems = sel ? (porDia[sel] || []) : [];

  const cell = { background: "rgba(10,12,13,.5)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 10, minHeight: 92, padding: 6, cursor: "pointer", display: "flex", flexDirection: "column", gap: 4 } as const;

  return (
    <WorkspaceShell active="calendario" title="Calendario" subtitle="Lo que esta planeado por dia: ideas, listos, programados y publicados.">
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 6, background: "rgba(10,12,13,.6)", padding: 4, borderRadius: 12, border: "1px solid rgba(255,255,255,.08)" }}>
          {[["todas", "Todas"], ["marikekas", "Marikekas"], ["printoria", "Printoria"]].map(([k, l]) => (
            <button key={k} onClick={() => setNeg(k)} style={{ border: "none", borderRadius: 9, padding: "8px 13px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", background: neg === k ? "rgba(150,214,41,.13)" : "transparent", color: neg === k ? "#c5f169" : "#a6abad" }}>{l}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: "auto" }}>
          <button onClick={prev} style={{ background: "transparent", border: "1px solid rgba(255,255,255,.15)", color: "#c5f169", borderRadius: 8, width: 30, height: 30, cursor: "pointer" }}>‹</button>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#f5f6f1", minWidth: 150, textAlign: "center" }}>{MESES[mes]} {anio}</div>
          <button onClick={next} style={{ background: "transparent", border: "1px solid rgba(255,255,255,.15)", color: "#c5f169", borderRadius: 8, width: 30, height: 30, cursor: "pointer" }}>›</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
        {Object.entries(EST).map(([k, v]) => <span key={k} style={{ display: "flex", alignItems: "center", gap: 6, color: "#8a9296", fontSize: 11 }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: v.color }} />{v.l}</span>)}
      </div>

      {loading ? <div className="empty-state">Cargando…</div> : (<>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6 }}>
          {DOW.map((d) => <div key={d} style={{ textAlign: "center", color: "#687073", fontSize: 10, fontWeight: 700, padding: "2px 0" }}>{d}</div>)}
          {celdas.map((d, i) => {
            if (!d) return <div key={i} />;
            const its = porDia[String(d)] || [];
            const hoyCell = esHoy(d);
            return (
              <div key={i} onClick={() => setSel(String(d))} style={{ ...cell, ...(sel === String(d) ? { borderColor: "rgba(150,214,41,.6)", background: "rgba(150,214,41,.06)" } : {}) }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: hoyCell ? "#0b0b0b" : "#cfd4d2", background: hoyCell ? "#96d629" : "transparent", width: 22, height: 22, lineHeight: "22px", borderRadius: "50%", textAlign: "center" }}>{d}</div>
                {its.slice(0, 3).map((it) => (
                  <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 4, background: `${EST[it.estado]?.color}22`, borderLeft: `3px solid ${EST[it.estado]?.color}`, borderRadius: 4, padding: "2px 4px", overflow: "hidden" }}>
                    <span style={net(it.red)}>{NET[it.red]?.c}</span>
                    <span style={{ fontSize: 9.5, color: "#d7dcd9", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.tema}</span>
                  </div>
                ))}
                {its.length > 3 && <span style={{ fontSize: 9, color: "#7f8789" }}>+{its.length - 3} más</span>}
              </div>
            );
          })}
        </div>

        {sel && (
          <div style={{ marginTop: 20 }}>
            <div style={{ color: "#96d629", fontSize: 11, fontWeight: 800, letterSpacing: ".1em", marginBottom: 10 }}>{sel} {MESES[mes].toUpperCase()} — {selItems.length} pieza{selItems.length !== 1 ? "s" : ""}</div>
            {selItems.length === 0 ? <p style={{ color: "#7f8789", fontSize: 12 }}>Nada este día.</p> : (
              <div style={{ display: "grid", gap: 10 }}>
                {selItems.map((it) => (
                  <div key={it.id} style={{ background: "rgba(27,31,33,.88)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, padding: 12, display: "flex", gap: 12, alignItems: "center" }}>
                    {it.asset_url ? <img src={it.asset_url} alt="" style={{ width: 46, height: 46, objectFit: "cover", borderRadius: 8, flex: "none" }} /> : <div style={{ width: 46, height: 46, borderRadius: 8, flex: "none", background: "rgba(150,214,41,.06)", display: "flex", alignItems: "center", justifyContent: "center", color: "#96d629" }}>◎</div>}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 7, alignItems: "center", marginBottom: 3 }}><span style={net(it.red)}>{NET[it.red]?.c}</span><span style={{ fontSize: 10, fontWeight: 700, color: EST[it.estado]?.color }}>{EST[it.estado]?.l}</span><span style={{ fontSize: 10, color: "#8a9296" }}>{NEG[it.negocio] || it.negocio}</span></div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#f5f6f1" }}>{it.tema}</div>
                    </div>
                    <span style={{ fontSize: 11, color: "#8a9296" }}>{it.fecha ? new Date(it.fecha).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" }) : ""}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </>)}
    </WorkspaceShell>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { WorkspaceShell } from "../../components/WorkspaceShell";

type Item = { id: string | number; negocio: string; red: string; tipo: string; tema: string; copy?: string | null; estado: string; fecha?: string | null; asset_url?: string | null; link?: string | null };

const NET: Record<string, { c: string; color: string }> = { ig: { c: "IG", color: "#E1306C" }, fb: { c: "FB", color: "#1877F2" }, tiktok: { c: "TT", color: "#c9cdcf" } };
const EST: Record<string, { l: string; color: string }> = { idea: { l: "Idea", color: "#9da4a6" }, proceso: { l: "En proceso", color: "#e0a53a" }, listo: { l: "Listo", color: "#8bc0ff" }, programado: { l: "Programado", color: "#5fd0e0" }, publicado: { l: "Publicado", color: "#96d629" } };
const NEG: Record<string, string> = { marikekas: "Marikekas", printoria: "Printoria" };
const FILTROS = ["todos", "idea", "proceso", "listo", "programado", "publicado"];
const net = (r: string) => ({ width: 18, height: 18, borderRadius: 5, background: NET[r]?.color || "#555", color: r === "tiktok" ? "#0b0b0b" : "#fff", fontSize: 9, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" });

export default function ArchivoPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [neg, setNeg] = useState("todas");
  const [filtro, setFiltro] = useState("todos");

  useEffect(() => { fetch("/api/redes?t=" + Date.now(), { cache: "no-store" }).then((r) => r.json()).then((d) => setItems(d.items || [])).finally(() => setLoading(false)); }, []);

  const vis = useMemo(() => items.filter((x) => (neg === "todas" || x.negocio === neg) && (filtro === "todos" || x.estado === filtro)).sort((a, b) => String(b.fecha || b.id).localeCompare(String(a.fecha || a.id))), [items, neg, filtro]);

  return (
    <WorkspaceShell active="archivo" title="Biblioteca de publicaciones" subtitle="Todo lo que has creado, en un solo lugar. Filtra por cuenta o etapa y reutiliza lo que quieras.">
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 6, background: "rgba(10,12,13,.6)", padding: 4, borderRadius: 12, border: "1px solid rgba(255,255,255,.08)" }}>
          {[["todas", "Todas"], ["marikekas", "Marikekas"], ["printoria", "Printoria"]].map(([k, l]) => (
            <button key={k} onClick={() => setNeg(k)} style={{ border: "none", borderRadius: 9, padding: "8px 13px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", background: neg === k ? "rgba(150,214,41,.13)" : "transparent", color: neg === k ? "#c5f169" : "#a6abad" }}>{l}</button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 20 }}>
        {FILTROS.map((k) => (
          <button key={k} onClick={() => setFiltro(k)} style={{ border: `1px solid ${filtro === k ? (k === "todos" ? "#96d629" : EST[k].color) : "rgba(255,255,255,.12)"}`, background: filtro === k ? "rgba(150,214,41,.08)" : "transparent", color: filtro === k ? (k === "todos" ? "#96d629" : EST[k].color) : "#8a9296", fontSize: 11.5, fontWeight: 700, borderRadius: 999, padding: "6px 13px", cursor: "pointer" }}>{k === "todos" ? "Todos" : EST[k].l}</button>
        ))}
      </div>

      {loading ? <div className="empty-state">Cargando…</div> : vis.length === 0 ? <div className="empty-state"><strong>Aún no hay publicaciones</strong><p>Lo que prepares en Publicaciones o mandes desde Nuevo creativo aparece aquí.</p></div> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 14 }}>
          {vis.map((it) => (
            <div key={it.id} style={{ background: "rgba(27,31,33,.88)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              {it.asset_url ? <img src={it.asset_url} alt="" style={{ width: "100%", aspectRatio: "4 / 5", objectFit: "cover", display: "block" }} /> : <div style={{ width: "100%", aspectRatio: "4 / 5", background: "rgba(150,214,41,.06)", display: "flex", alignItems: "center", justifyContent: "center", color: "#96d629", fontSize: 30 }}>◎</div>}
              <div style={{ padding: 11, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={net(it.red)}>{NET[it.red]?.c}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: EST[it.estado]?.color }}>{EST[it.estado]?.l}</span>
                  <span style={{ fontSize: 10, color: "#8a9296", marginLeft: "auto" }}>{it.fecha ? new Date(it.fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : ""}</span>
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 650, color: "#f5f6f1", lineHeight: 1.25 }}>{it.tema}</div>
                {it.copy ? <div style={{ fontSize: 10.5, color: "#9da4a6", lineHeight: 1.45, maxHeight: 46, overflow: "hidden" }}>{it.copy}</div> : null}
                {it.estado === "publicado" && it.link ? <a href={it.link} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#c5f169", textDecoration: "none" }}>Ver publicación ↗</a> : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </WorkspaceShell>
  );
}

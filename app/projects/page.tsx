"use client";

import { useEffect, useState } from "react";
import { WorkspaceShell } from "@/components/WorkspaceShell";

type Project = { id: string; title: string; idea: string; status: string; total_cost_usd: number; created_at: string; sourceUrl?: string | null; imageUrl?: string | null };

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/projects").then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.error); setProjects(result.projects); }).catch((reason) => setError(reason.message)).finally(() => setLoading(false)); }, []);
  return <WorkspaceShell active="projects" subtitle="Todos los proyectos guardados, su etapa actual y el costo acumulado." title="Mis proyectos">{loading ? <div className="empty-state">Cargando proyectos…</div> : error ? <p className="form-notice">{error}</p> : projects.length === 0 ? <div className="empty-state"><strong>Aún no hay proyectos</strong><p>Crea tu primer anuncio desde Nuevo creativo.</p></div> : <div className="project-grid">{projects.map((project) => <article className="project-card" key={project.id}><div className="project-photos" style={{ display: "flex", gap: 8, marginBottom: 12 }}>{project.sourceUrl ? <img src={project.sourceUrl} alt="Foto original" style={{ flex: 1, minWidth: 0, aspectRatio: "4 / 5", objectFit: "cover", borderRadius: 10 }} /> : null}{project.imageUrl ? <img src={project.imageUrl} alt="Foto editada" style={{ flex: 1, minWidth: 0, aspectRatio: "4 / 5", objectFit: "cover", borderRadius: 10 }} /> : null}{!project.sourceUrl && !project.imageUrl ? <div style={{ flex: 1, aspectRatio: "4 / 5", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(150,214,41,.08)", color: "#96D629", fontSize: 12 }}>Sin foto aún</div> : null}</div><div className="project-card-top"><span className="status-pill">{project.status}</span><strong>${Number(project.total_cost_usd).toFixed(4)}</strong></div><h3>{project.title}</h3><div className="project-card-footer"><small>{new Date(project.created_at).toLocaleDateString("es-MX", { dateStyle: "medium" })}</small><a className="project-open" href={`/?project=${project.id}`}>Abrir / editar →</a></div></article>)}</div>}</WorkspaceShell>;
}

"use client";

import { useEffect, useState } from "react";
import { WorkspaceShell } from "@/components/WorkspaceShell";

type Project = { id: string; title: string; idea: string; status: string; total_cost_usd: number; created_at: string };

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/projects").then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.error); setProjects(result.projects); }).catch((reason) => setError(reason.message)).finally(() => setLoading(false)); }, []);
  return <WorkspaceShell active="projects" subtitle="Todos los proyectos guardados, su etapa actual y el costo acumulado." title="Mis proyectos">{loading ? <div className="empty-state">Cargando proyectos…</div> : error ? <p className="form-notice">{error}</p> : projects.length === 0 ? <div className="empty-state"><strong>Aún no hay proyectos</strong><p>Crea tu primer anuncio desde Nuevo creativo.</p></div> : <div className="project-grid">{projects.map((project) => <article className="project-card" key={project.id}><div className="project-card-top"><span className="status-pill">{project.status}</span><strong>${Number(project.total_cost_usd).toFixed(4)}</strong></div><h3>{project.title}</h3><p>{project.idea}</p><small>{new Date(project.created_at).toLocaleDateString("es-MX", { dateStyle: "medium" })}</small></article>)}</div>}</WorkspaceShell>;
}

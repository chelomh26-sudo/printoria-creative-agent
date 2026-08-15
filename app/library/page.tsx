"use client";
/* eslint-disable @next/next/no-img-element -- signed private URLs expire and should not pass through the image optimizer */

import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";
import { WorkspaceShell } from "@/components/WorkspaceShell";

type Asset = { id: string; name: string; mime_type: string; asset_class: "reference" | "locked"; category: string; notes: string | null; preview_url: string | null; created_at: string };
type Draft = Pick<Asset, "name" | "asset_class" | "category"> & { notes: string };

const categories = [
  ["logo", "Logo"], ["mascot", "Mascota"], ["product", "Producto"], ["order", "Pedido real"],
  ["visual_reference", "Referencia visual"], ["document", "Documento"], ["other", "Otro"],
] as const;

export default function LibraryPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [assetClass, setAssetClass] = useState("reference");
  const [category, setCategory] = useState("visual_reference");
  const [notes, setNotes] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => fetch("/api/library").then((response) => response.json()).then((result) => {
    if (result.error) throw new Error(result.error);
    setAssets(result.assets);
  }).catch((error) => setNotice(error.message)), []);
  useEffect(() => { load(); }, [load]);

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    setBusy(true); setNotice("");
    const form = new FormData();
    form.set("file", file); form.set("assetClass", assetClass); form.set("category", category); form.set("notes", notes);
    const response = await fetch("/api/library", { method: "POST", body: form });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) setNotice(result.error);
    else { setFile(null); setNotes(""); setNotice("Archivo guardado en la biblioteca."); await load(); }
  }

  function beginEdit(asset: Asset) {
    setEditingId(asset.id);
    setDraft({ name: asset.name, asset_class: asset.asset_class, category: asset.category, notes: asset.notes ?? "" });
    setNotice("");
  }

  async function saveEdit() {
    if (!editingId || !draft) return;
    setBusy(true); setNotice("");
    const response = await fetch("/api/library", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: editingId, ...draft }) });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) setNotice(result.error);
    else { setEditingId(null); setDraft(null); setNotice("Descripción y clasificación actualizadas."); await load(); }
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar este archivo de la biblioteca?")) return;
    await fetch(`/api/library?id=${id}`, { method: "DELETE" });
    await load();
  }

  return <WorkspaceShell active="library" subtitle="Pon nombres y descripciones claras para que la IA sepa qué es cada archivo y cómo debe usarlo." title="Biblioteca de marca">
    <form className="library-uploader" onSubmit={upload}>
      <label className="library-file"><span>↑</span><strong>{file?.name ?? "Seleccionar archivo"}</strong><input onChange={(event: ChangeEvent<HTMLInputElement>) => setFile(event.target.files?.[0] ?? null)} type="file" /></label>
      <label>Clasificación<select onChange={(event) => setAssetClass(event.target.value)} value={assetClass}><option value="reference">REFERENCE · inspira</option><option value="locked">LOCKED · preservar</option></select></label>
      <label>Categoría<select onChange={(event) => setCategory(event.target.value)} value={category}>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="library-description">Descripción para la IA<textarea onChange={(event) => setNotes(event.target.value)} placeholder="Ejemplo: Logo horizontal oficial. Usar completo, sin cambiar colores ni texto." value={notes}/></label>
      <button className="primary-button" disabled={!file || busy} type="submit">{busy ? "Guardando…" : "Guardar asset"}</button>
    </form>
    {notice && <p className="form-notice" role="alert">{notice}</p>}
    <div className="asset-grid">{assets.map((asset) => {
      const editing = editingId === asset.id ? draft : null;
      return <article className="brand-asset-card" key={asset.id}>
        {asset.preview_url && asset.mime_type?.startsWith("image/") ? <img alt={asset.name} src={asset.preview_url} /> : <div className="document-preview">DOC</div>}
        {editing ? <div className="asset-editor">
          <label>Nombre<input onChange={(event) => setDraft({ ...editing, name: event.target.value })} value={editing.name}/></label>
          <div className="asset-editor-row"><label>Clasificación<select onChange={(event) => setDraft({ ...editing, asset_class: event.target.value as Draft["asset_class"] })} value={editing.asset_class}><option value="reference">REFERENCE</option><option value="locked">LOCKED</option></select></label><label>Categoría<select onChange={(event) => setDraft({ ...editing, category: event.target.value })} value={editing.category}>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
          <label>Descripción para la IA<textarea onChange={(event) => setDraft({ ...editing, notes: event.target.value })} placeholder="Qué aparece, cuándo usarlo y qué no debe modificar." value={editing.notes}/></label>
          <div className="asset-editor-actions"><button className="text-button" onClick={() => { setEditingId(null); setDraft(null); }} type="button">Cancelar</button><button className="primary-button" disabled={busy} onClick={saveEdit} type="button">Guardar cambios</button></div>
        </div> : <div className="asset-summary"><span className={`asset-badge ${asset.asset_class}`}>{asset.asset_class.toUpperCase()}</span><h3>{asset.name}</h3><p>{categories.find(([value]) => value === asset.category)?.[1] ?? asset.category}</p><small>{asset.notes || "Sin descripción. Edítalo para que la IA pueda diferenciarlo."}</small></div>}
        {!editing && <div className="asset-card-actions"><button onClick={() => beginEdit(asset)} type="button">Editar</button><button className="danger" onClick={() => remove(asset.id)} type="button">Eliminar</button></div>}
      </article>;
    })}</div>
  </WorkspaceShell>;
}

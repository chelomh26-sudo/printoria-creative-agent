"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";

export function MicButton({ onText, title = "Dictar por voz" }: { onText: (t: string) => void; title?: string }) {
  const [on, setOn] = useState(false);
  const recRef = useRef<any>(null);
  const onRef = useRef(false);

  const start = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Tu navegador no soporta dictado por voz. Usa Google Chrome."); onRef.current = false; setOn(false); return; }
    const rec = new SR();
    rec.lang = "es-MX";
    rec.interimResults = false;
    rec.continuous = true;
    rec.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) { const t = String(r[0].transcript).trim(); if (t) onText(t); }
      }
    };
    rec.onend = () => { if (onRef.current) { try { rec.start(); } catch { /* reintento */ } } else setOn(false); };
    rec.onerror = (ev: any) => { if (ev && (ev.error === "no-speech" || ev.error === "aborted")) return; onRef.current = false; setOn(false); };
    recRef.current = rec;
    try { rec.start(); } catch { /* ya iniciado */ }
  };

  const toggle = () => {
    if (on) { onRef.current = false; setOn(false); try { recRef.current && recRef.current.stop(); } catch { /* noop */ } }
    else { onRef.current = true; setOn(true); start(); }
  };

  useEffect(() => () => { onRef.current = false; try { recRef.current && recRef.current.stop(); } catch { /* noop */ } }, []);

  return (
    <button type="button" onClick={toggle} title={title} aria-label={title}
      style={{ border: `1px solid ${on ? "#96d629" : "#343a3c"}`, background: on ? "rgba(150,214,41,.15)" : "#121517", color: on ? "#c5f169" : "#9da4a6", borderRadius: 9, padding: "8px 12px", cursor: "pointer", fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap" }}>
      {on ? "● Grabando… (clic para parar)" : "🎤 Hablar"}
    </button>
  );
}

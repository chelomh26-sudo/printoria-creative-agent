"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useState } from "react";

export function MicButton({ onText, title = "Dictar por voz" }: { onText: (t: string) => void; title?: string }) {
  const [on, setOn] = useState(false);
  const recRef = useRef<any>(null);

  const toggle = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Tu navegador no soporta dictado por voz. Usa Google Chrome."); return; }
    if (on && recRef.current) { recRef.current.stop(); return; }
    const rec = new SR();
    rec.lang = "es-MX";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e: any) => {
      const t = Array.from(e.results).map((r: any) => r[0].transcript).join(" ").trim();
      if (t) onText(t);
    };
    rec.onend = () => setOn(false);
    rec.onerror = () => setOn(false);
    recRef.current = rec;
    setOn(true);
    rec.start();
  };

  return (
    <button type="button" onClick={toggle} title={title} aria-label={title}
      style={{ border: `1px solid ${on ? "#96d629" : "#343a3c"}`, background: on ? "rgba(150,214,41,.15)" : "#121517", color: on ? "#c5f169" : "#9da4a6", borderRadius: 9, padding: "8px 12px", cursor: "pointer", fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap" }}>
      {on ? "● Grabando… (clic para parar)" : "🎤 Hablar"}
    </button>
  );
}

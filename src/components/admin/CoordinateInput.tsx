"use client";
import { useState } from "react";
import { parseCoords } from "@/lib/coords";

export default function CoordinateInput({ lat, lng }: { lat?: number | null; lng?: number | null }) {
  const [la, setLa] = useState(lat?.toString() ?? "");
  const [ln, setLn] = useState(lng?.toString() ?? "");
  const [msg, setMsg] = useState<string | null>(null);

  function onPaste(v: string) {
    if (!v.trim()) return setMsg(null);
    const c = parseCoords(v);
    if (c) { setLa(String(c[0])); setLn(String(c[1])); setMsg("Koordinat terisi dari link."); }
    else setMsg("Koordinat tidak ditemukan. Buka lokasi di Google Maps versi web, lalu salin link dari address bar.");
  }

  return (
    <div className="space-y-3 md:col-span-2">
      <div>
        <label htmlFor="maps_link" className="label">Link Google Maps (opsional)</label>
        <input id="maps_link" placeholder="Tempel link Google Maps atau &quot;-6.99, 110.42&quot;" className="input" onChange={(e) => onPaste(e.target.value)} />
        {msg && <p className="mt-1.5 text-xs text-muted">{msg}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label htmlFor="lat" className="label">Latitude</label><input id="lat" name="lat" step="any" type="number" value={la} onChange={(e) => setLa(e.target.value)} className="input" /></div>
        <div><label htmlFor="lng" className="label">Longitude</label><input id="lng" name="lng" step="any" type="number" value={ln} onChange={(e) => setLn(e.target.value)} className="input" /></div>
      </div>
    </div>
  );
}

"use client";
import { useState } from "react";

export default function CopyButton({ value, label = "Salin" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn-ghost !px-3 !py-1.5 text-sm text-ink"
      onClick={async () => { try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1800); } catch {} }}>
      {done ? "Tersalin" : label}
    </button>
  );
}

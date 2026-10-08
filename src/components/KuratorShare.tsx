"use client";
import { useState } from "react";
import Icon from "./Icon";

/** Menu kartu Kurator di halaman author (hanya untuk pemilik profil). */
export default function KuratorShare({ base, slug, levelName, profileUrl }: { base: string; slug: string; levelName: string; profileUrl: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const text = `Aku resmi jadi ${levelName} di WFC Hunters! ☕ Cek kafe-kafe rekomendasiku buat kerja: ${profileUrl}`;

  async function share(format: "story" | "post") {
    setBusy(format); setMsg(null);
    try {
      const res = await fetch(`${base}?f=${format}`);
      if (!res.ok) throw new Error("Kartu belum bisa dibuat.");
      const file = new File([await res.blob()], `kartu-${levelName.toLowerCase().replace(/\s+/g, "-")}-${slug}-${format}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
      } else {
        // Komputer / browser tanpa fitur bagikan: unduh saja
        const a = document.createElement("a");
        a.href = URL.createObjectURL(file); a.download = file.name; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        setMsg("Kartu terunduh. Unggah ke Instagram Story atau feed dari galerimu.");
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function copyCaption() {
    try { await navigator.clipboard.writeText(text); setMsg("Caption disalin. Tempel saat posting ya."); } catch { setMsg(text); }
  }

  return (
    <section id="kartu" className="mt-8 scroll-mt-24 overflow-hidden rounded-3xl border border-line bg-surface">
      <div className="grid gap-6 p-6 md:grid-cols-[260px_1fr] md:items-center md:p-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${base}?f=post`} alt={`Kartu ${levelName}`} className="mx-auto w-full max-w-[260px] rounded-2xl shadow-lg" loading="lazy" />
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-tan">Khusus kamu</p>
          <h2 className="mt-1 text-2xl font-bold">Kartu {levelName} kamu sudah jadi 🎉</h2>
          <p className="mt-2 max-w-md text-muted">Pamerkan ke teman-temanmu di Instagram, WhatsApp, atau media sosial lain. Link profilmu sudah ada di kartunya.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={() => share("story")} disabled={!!busy} className="btn-primary">
              <Icon name="instagram" className="h-4 w-4" />{busy === "story" ? "Menyiapkan…" : "Bagikan ke Story"}
            </button>
            <button onClick={() => share("post")} disabled={!!busy} className="btn-ghost">
              <Icon name="image" className="h-4 w-4" />{busy === "post" ? "Menyiapkan…" : "Bagikan ke Feed"}
            </button>
            <button onClick={copyCaption} className="btn-ghost"><Icon name="edit" className="h-4 w-4" />Salin caption</button>
          </div>
          <p className="mt-3 text-xs text-muted">
            Atau unduh langsung: <a href={`${base}?f=story`} download className="font-semibold text-brand hover:underline">Story (1080×1920)</a> · <a href={`${base}?f=post`} download className="font-semibold text-brand hover:underline">Feed (1080×1350)</a>
          </p>
          {msg && <p role="status" className="mt-3 rounded-xl bg-tint px-3 py-2 text-sm">{msg}</p>}
        </div>
      </div>
    </section>
  );
}

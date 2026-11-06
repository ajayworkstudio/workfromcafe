"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressImage, uniqueName } from "@/lib/compressImage";

/** Unggah satu gambar (dikompres) ke Storage; URL dikirim lewat input hidden `name`. */
export default function ImageUploader({ name, initial, folder, label = "Unggah gambar", allowLink = false }: {
  name: string; initial?: string | null; folder: string; label?: string;
  /** Tampilkan kolom untuk menempel link gambar sebagai ganti unggah */
  allowLink?: boolean;
}) {
  const [url, setUrl] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function upload(file?: File) {
    if (!file) return;
    setBusy(true); setErr(null);
    try {
      const supabase = createClient();
      const blob = await compressImage(file);
      const path = uniqueName(folder);
      const { error } = await supabase.storage.from("cafe-photos").upload(path, blob, { contentType: "image/webp" });
      if (error) throw error;
      setUrl(supabase.storage.from("cafe-photos").getPublicUrl(path).data.publicUrl);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="relative aspect-[2/1] overflow-hidden rounded-xl border border-line bg-tint">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-sm text-muted">Belum ada gambar</div>}
      </div>
      <div className="flex flex-wrap gap-2">
        <label className="btn-dark min-h-11 cursor-pointer !py-2 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand">
          {busy ? "Mengunggah…" : url ? "Ganti gambar" : label}
          <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        {url && <button type="button" onClick={() => setUrl("")} className="btn-ghost min-h-11 !py-2 text-sm">Hapus</button>}
      </div>
      {allowLink && (
        <input type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value.trim())} aria-label="Atau tempel link gambar" placeholder="Atau tempel link gambar: https://…" className="input" />
      )}
      {err && <p role="alert" className="text-sm text-red-700">Gambar gagal diunggah: {err}</p>}
      <input type="hidden" name={name} value={url} />
    </div>
  );
}

"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressImage, uniqueName } from "@/lib/compressImage";

/** Unggah satu gambar (dikompres) ke Storage; URL dikirim lewat input hidden `name`. */
export default function ImageUploader({ name, initial, folder, label = "Unggah gambar" }: { name: string; initial?: string | null; folder: string; label?: string }) {
  const [url, setUrl] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function upload(file?: File) {
    if (!file) return;
    setBusy(true); setErr(null);
    try {
      const supabase = createClient();
      const blob = await compressImage(file, 1600, 0.82);
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
        <label className="btn-dark cursor-pointer !py-2 text-sm">
          {busy ? "Mengunggah…" : url ? "Ganti gambar" : label}
          <input type="file" accept="image/*" hidden disabled={busy} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        {url && <button type="button" onClick={() => setUrl("")} className="btn-ghost !py-2 text-sm">Hapus</button>}
      </div>
      {err && <p className="text-sm text-red-700">{err}</p>}
      <input type="hidden" name={name} value={url} />
    </div>
  );
}

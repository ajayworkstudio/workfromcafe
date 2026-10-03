"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Unggah gambar QRIS ke Storage. URL-nya disimpan saat form Pengaturan disimpan. */
export default function QrisUploader({ initial }: { initial: string }) {
  const [url, setUrl] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return setErr("Ukuran maksimal 3 MB.");
    setBusy(true); setErr(null);
    const supabase = createClient();
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `settings/qris-${Date.now()}.${ext}`;
    // Tanpa kompresi: kode QR harus tetap tajam agar bisa di-scan
    const { error } = await supabase.storage.from("cafe-photos").upload(path, file, { contentType: file.type });
    if (error) setErr(error.message);
    else setUrl(supabase.storage.from("cafe-photos").getPublicUrl(path).data.publicUrl);
    setBusy(false);
  }

  return (
    <div className="flex flex-wrap items-start gap-4">
      <div className="grid h-40 w-40 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url ? <img src={url} alt="QRIS" className="h-full w-full object-contain" /> : <span className="px-3 text-center text-xs text-muted">Belum ada gambar QRIS</span>}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <label className="btn-dark cursor-pointer">
          {busy ? "Mengunggah…" : url ? "Ganti gambar QRIS" : "Unggah gambar QRIS"}
          <input type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={busy} onChange={(e) => upload(e.target.files?.[0])} />
        </label>
        <p className="text-sm text-muted">Download QRIS dari aplikasi DANA Bisnis, lalu unggah di sini. Klik Simpan pengaturan setelah gambar muncul.</p>
        {err && <p className="text-sm text-red-700">{err}</p>}
      </div>
      <input type="hidden" name="qris_image_url" value={url} />
    </div>
  );
}

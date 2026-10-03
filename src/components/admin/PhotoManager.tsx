"use client";
import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { compressImage, uniqueName } from "@/lib/compressImage";
import type { Photo } from "@/lib/types";

export default function PhotoManager({ cafeId, initial }: { cafeId: string; initial: Photo[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [photos, setPhotos] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setErr(null);
    try {
      let order = photos.length;
      for (const file of Array.from(files)) {
        const blob = await compressImage(file);
        const path = uniqueName(cafeId);
        const { error } = await supabase.storage.from("cafe-photos").upload(path, blob, { contentType: "image/webp" });
        if (error) throw error;
        const url = supabase.storage.from("cafe-photos").getPublicUrl(path).data.publicUrl;
        const { data, error: e2 } = await supabase
          .from("cafe_photos")
          .insert({ cafe_id: cafeId, url, is_cover: photos.length === 0 && order === 0, sort_order: order++ })
          .select()
          .single();
        if (e2) throw e2;
        setPhotos((p) => [...p, data as Photo]);
      }
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function setCover(id: string) {
    await supabase.from("cafe_photos").update({ is_cover: false }).eq("cafe_id", cafeId);
    await supabase.from("cafe_photos").update({ is_cover: true }).eq("id", id);
    setPhotos((p) => p.map((x) => ({ ...x, is_cover: x.id === id })));
    router.refresh();
  }

  async function remove(photo: Photo) {
    if (!confirm("Hapus foto ini?")) return;
    const path = photo.url.split("/cafe-photos/")[1];
    if (path) await supabase.storage.from("cafe-photos").remove([path]);
    await supabase.from("cafe_photos").delete().eq("id", photo.id);
    setPhotos((p) => p.filter((x) => x.id !== photo.id));
    router.refresh();
  }

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">Foto ({photos.length})</h2>
        <label className="btn-dark cursor-pointer !py-1.5">
          {busy ? "Mengunggah…" : "+ Unggah foto"}
          <input type="file" accept="image/*" multiple hidden disabled={busy} onChange={(e) => upload(e.target.files)} />
        </label>
      </div>
      {err && <p className="mt-2 text-sm text-brand-dark">{err}</p>}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {photos.map((p) => (
          <div key={p.id} className="group relative aspect-square overflow-hidden rounded-xl bg-tint">
            <Image src={p.url} alt="" fill sizes="200px" className="object-cover" />
            {p.is_cover && <span className="absolute left-2 top-2 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white">SAMPUL</span>}
            <div className="absolute inset-x-0 bottom-0 flex gap-1 bg-ink/70 p-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100">
              {!p.is_cover && <button onClick={() => setCover(p.id)} className="flex-1 rounded bg-canvas px-1 py-1 text-[11px] font-semibold">Jadikan sampul</button>}
              <button onClick={() => remove(p)} className="rounded bg-brand px-2 py-1 text-[11px] font-semibold text-white">Hapus</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

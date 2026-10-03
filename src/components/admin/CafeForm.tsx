import { saveCafe } from "@/app/admin/kafe/actions";
import type { Cafe, CafeDetails, City, Tag } from "@/lib/types";
import { DAYS, priceLabel } from "@/lib/utils";
import SubmitButton from "./SubmitButton";

export default function CafeForm({
  cafe, details, cities, tags, selectedTagIds,
}: { cafe?: Cafe; details?: CafeDetails | null; cities: City[]; tags: Tag[]; selectedTagIds: string[] }) {
  const h = cafe?.opening_hours ?? {};
  return (
    <form action={saveCafe} className="space-y-6">
      {cafe && <input type="hidden" name="id" value={cafe.id} />}

      <section className="card grid gap-4 p-5 md:grid-cols-2">
        <h2 className="font-display text-lg font-bold md:col-span-2">Info dasar (publik)</h2>
        <div><label className="label">Nama kafe *</label><input name="name" required defaultValue={cafe?.name} className="input" /></div>
        <div><label className="label">Slug URL (kosongkan = otomatis)</label><input name="slug" defaultValue={cafe?.slug} className="input" /></div>
        <div>
          <label className="label">Kota *</label>
          <select name="city_id" required defaultValue={cafe?.city_id} className="input">
            {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div><label className="label">Area / kecamatan</label><input name="area" defaultValue={cafe?.area ?? ""} className="input" /></div>
        <div className="md:col-span-2"><label className="label">Alamat</label><input name="address" defaultValue={cafe?.address ?? ""} className="input" /></div>
        <div className="flex gap-2">
          <div className="flex-1"><label className="label">Latitude</label><input name="lat" step="any" type="number" defaultValue={cafe?.lat ?? ""} className="input" /></div>
          <div className="flex-1"><label className="label">Longitude</label><input name="lng" step="any" type="number" defaultValue={cafe?.lng ?? ""} className="input" /></div>
        </div>
        <p className="self-end text-xs text-muted/60">Tip: di Google Maps, klik kanan titik kafe lalu klik angka koordinat untuk menyalin.</p>
        <div>
          <label className="label">Kisaran harga</label>
          <select name="price_range" defaultValue={cafe?.price_range ?? 2} className="input">
            {[1, 2, 3, 4].map((p) => <option key={p} value={p}>{priceLabel(p)}</option>)}
          </select>
        </div>
        <div><label className="label">Rating aku (0–5)</label><input name="my_rating" type="number" step="0.1" min="0" max="5" defaultValue={cafe?.my_rating ?? ""} className="input" /></div>
        <div><label className="label">Tanggal kunjungan</label><input name="visited_at" type="date" defaultValue={cafe?.visited_at ?? ""} className="input" /></div>
        <div className="flex items-end gap-5 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" name="is_featured" defaultChecked={cafe?.is_featured} className="accent-brand" /> Favorit pribadi</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="is_published" defaultChecked={cafe?.is_published ?? true} className="accent-brand" /> Tayang</label>
        </div>
        <div className="md:col-span-2"><label className="label">Ulasan singkat (cuplikan publik)</label><textarea name="short_review" rows={2} defaultValue={cafe?.short_review ?? ""} className="input" /></div>
      </section>

      <section className="card grid gap-4 p-5">
        <h2 className="font-display text-lg font-bold">Konten khusus pelanggan</h2>
        <div><label className="label">Ulasan lengkap</label><textarea name="full_review" rows={6} defaultValue={details?.full_review ?? ""} className="input" /></div>
        <div className="grid gap-4 md:grid-cols-2">
          <div><label className="label">Tips</label><input name="tips" defaultValue={details?.tips ?? ""} className="input" /></div>
          <div><label className="label">Waktu terbaik</label><input name="best_time" defaultValue={details?.best_time ?? ""} className="input" /></div>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-display text-lg font-bold">Tag</h2>
        {(["vibe", "facility"] as const).map((type) => (
          <div key={type} className="mt-3">
            <p className="label">{type === "vibe" ? "Suasana" : "Fasilitas"}</p>
            <div className="flex flex-wrap gap-1.5">
              {tags.filter((t) => t.type === type).map((t) => (
                <label key={t.id} className="cursor-pointer">
                  <input type="checkbox" name="tags" value={t.id} defaultChecked={selectedTagIds.includes(t.id)} className="peer sr-only" />
                  <span className="chip peer-checked:bg-brand peer-checked:text-white">{t.name}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="card p-5">
        <h2 className="font-display text-lg font-bold">Jam buka</h2>
        <div className="mt-3 space-y-2">
          {DAYS.map(({ key, label }) => {
            const slot = h[key];
            return (
              <div key={key} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-20 font-medium">{label}</span>
                <input type="time" name={`open_${key}`} defaultValue={slot?.[0] ?? "08:00"} className="input !w-32" />
                <span>–</span>
                <input type="time" name={`close_${key}`} defaultValue={slot?.[1] ?? "22:00"} className="input !w-32" />
                <label className="flex items-center gap-1.5 text-muted/70">
                  <input type="checkbox" name={`closed_${key}`} defaultChecked={cafe ? slot === null : false} className="accent-brand" /> Tutup
                </label>
              </div>
            );
          })}
        </div>
      </section>

      <SubmitButton>{cafe ? "Simpan perubahan" : "Simpan & lanjut tambah foto/menu"}</SubmitButton>
    </form>
  );
}

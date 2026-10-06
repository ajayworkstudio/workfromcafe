import { saveEvent } from "@/app/admin/event/actions";
import { EVENT_KINDS, isoToWib, type WfcEvent } from "@/lib/events";
import type { City } from "@/lib/types";
import CityOptions from "@/components/CityOptions";
import SubmitButton from "./SubmitButton";
import ImageUploader from "./ImageUploader";

export default function EventForm({ event, cities, cafes }: { event?: WfcEvent | null; cities: City[]; cafes: { id: string; name: string; city: { name: string } | null }[] }) {
  return (
    <form action={saveEvent} className="space-y-5">
      {event && <input type="hidden" name="id" value={event.id} />}
      <section className="card space-y-4 p-5 md:p-6">
        <div>
          <label htmlFor="title" className="label">Judul event</label>
          <input id="title" name="title" required maxLength={120} defaultValue={event?.title} placeholder="Kerja Bareng Sabtu Pagi di Semarang" className="input" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="kind" className="label">Jenis</label>
            <select id="kind" name="kind" defaultValue={event?.kind ?? "kerja_bareng"} className="input">
              {EVENT_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="slug" className="label">Alamat halaman</label>
            <input id="slug" name="slug" defaultValue={event?.slug} placeholder="Otomatis dari judul" className="input" />
          </div>
          <div>
            <label htmlFor="starts_at" className="label">Mulai (WIB)</label>
            <input id="starts_at" name="starts_at" type="datetime-local" required defaultValue={isoToWib(event?.starts_at ?? null)} className="input" />
          </div>
          <div>
            <label htmlFor="ends_at" className="label">Selesai (WIB, opsional)</label>
            <input id="ends_at" name="ends_at" type="datetime-local" defaultValue={isoToWib(event?.ends_at ?? null)} className="input" />
          </div>
        </div>
        <div>
          <label htmlFor="description" className="label">Deskripsi</label>
          <textarea id="description" name="description" rows={6} defaultValue={event?.description ?? ""} placeholder="Agenda, siapa yang cocok ikut, apa yang perlu dibawa…" className="input" />
        </div>
      </section>

      <section className="card space-y-4 p-5 md:p-6">
        <h2 className="text-lg font-bold">Tempat</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="cafe_id" className="label">Kafe (dari database)</label>
            <select id="cafe_id" name="cafe_id" defaultValue={event?.cafe_id ?? ""} className="input">
              <option value="">Bukan kafe di database</option>
              {cafes.map((c) => <option key={c.id} value={c.id}>{c.name}{c.city ? ` (${c.city.name})` : ""}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="city_id" className="label">Kota</label>
            <select id="city_id" name="city_id" defaultValue={event?.city_id ?? ""} className="input">
              <option value="">Pilih kota</option>
              <CityOptions cities={cities} />
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="venue" className="label">Nama tempat lain (opsional)</label>
            <input id="venue" name="venue" defaultValue={event?.venue ?? ""} placeholder="Diisi kalau tempatnya belum ada di database" className="input" />
          </div>
        </div>
      </section>

      <section className="card space-y-4 p-5 md:p-6">
        <h2 className="text-lg font-bold">Pendaftaran</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="register_url" className="label">Link daftar</label>
            <input id="register_url" name="register_url" type="url" defaultValue={event?.register_url ?? ""} placeholder="https://wa.me/… atau link Google Form" className="input" />
          </div>
          <div>
            <label htmlFor="price" className="label">Biaya</label>
            <input id="price" name="price" defaultValue={event?.price ?? ""} placeholder="Gratis / Rp25.000 termasuk 1 minuman" className="input" />
          </div>
          <div>
            <label htmlFor="quota" className="label">Kuota peserta</label>
            <input id="quota" name="quota" type="number" min={1} defaultValue={event?.quota ?? ""} placeholder="Tanpa batas" className="input" />
          </div>
        </div>
      </section>

      <section className="card space-y-4 p-5 md:p-6">
        <h2 className="text-lg font-bold">Gambar sampul</h2>
        <ImageUploader name="cover_url" initial={event?.cover_url} folder="events" label="Unggah sampul" />
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-4 py-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
          <input type="checkbox" name="is_published" defaultChecked={event?.is_published ?? false} className="h-4 w-4 accent-brand" />
          <span><span className="block text-sm font-semibold">Tayang</span><span className="block text-xs text-muted">Terlihat umum setelah menu Event dibuka di Pengaturan</span></span>
        </label>
      </section>

      <div className="sticky bottom-20 z-10 flex justify-end rounded-2xl border border-line bg-surface/95 p-3 shadow-lg backdrop-blur md:bottom-4">
        <SubmitButton>{event ? "Simpan perubahan" : "Buat event"}</SubmitButton>
      </div>
    </form>
  );
}

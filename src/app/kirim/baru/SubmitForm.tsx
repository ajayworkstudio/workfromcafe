"use client";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { compressImage, uniqueName } from "@/lib/compressImage";
import { parseCoords } from "@/lib/coords";
import { PRICE_RANGES } from "@/lib/utils";
import { MAX_MENU, MAX_PHOTOS, RELATIONS } from "@/lib/submission";
import { submitRecommendation, type SubmitState } from "../actions";
import { AmenityFields, ScoreFields } from "@/components/ReviewFields";
import OpeningHoursInput from "@/components/admin/OpeningHoursInput";
import Icon from "@/components/Icon";
import CityOptions from "@/components/CityOptions";
import type { City } from "@/lib/types";

type MenuRow = { name: string; price: string; note: string; is_must_try: boolean };
const emptyMenu = (): MenuRow => ({ name: "", price: "", note: "", is_must_try: false });

const Req = () => <span className="text-[#b4533a]"> *</span>;

/** 3 aspek terpenting, dinilai sekali ketuk di bagian "Kirim cepat". */
const QUICK = [
  { key: "internet", label: "Wifi", icon: "wifi", opts: ["Lemot", "Oke", "Kencang"] },
  { key: "colokan", label: "Colokan", icon: "plug", opts: ["Jarang", "Ada", "Banyak"] },
  { key: "ketenangan", label: "Suasana", icon: "volume", opts: ["Ramai", "Lumayan", "Tenang"] },
] as const;
const QUICK_VALUES = [2, 3.5, 5];
const QUICK_FACES = ["😕", "🙂", "😍"];

function Block({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-line pt-5 first:border-t-0 first:pt-0">
      <h3 className="font-sans text-base font-bold tracking-normal">{title}</h3>
      {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

export default function SubmitForm({ userId, defaultName, cities }: { userId: string; defaultName: string; cities: City[] }) {
  const [state, action] = useActionState<SubmitState, FormData>(submitRecommendation, null);
  const supabase = createClient();

  const [cityId, setCityId] = useState("");
  const [mapsMsg, setMapsMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [knowHours, setKnowHours] = useState(false);
  const [menu, setMenu] = useState<MenuRow[]>([emptyMenu()]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(0);
  const [photoErr, setPhotoErr] = useState<string | null>(null);
  const [quick, setQuick] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [why, setWhy] = useState("");
  const [maps, setMaps] = useState("");
  const [address, setAddress] = useState("");
  const [showAddress, setShowAddress] = useState(false);
  const [cityOther, setCityOther] = useState("");
  const done = [name.trim().length > 1, !!cityId && (cityId !== "__other" || cityOther.trim().length > 1), !!(maps.trim() || address.trim()), why.trim().length >= 10];
  const doneCount = done.filter(Boolean).length;

  function onMaps(v: string) {
    setMaps(v);
    if (!v.trim()) return setMapsMsg(null);
    if (parseCoords(v)) setMapsMsg({ ok: true, text: "Lokasi terbaca dari link." });
    else if (/maps\.app\.goo\.gl|goo\.gl\/maps/.test(v)) setMapsMsg({ ok: true, text: "Link tersimpan. Titik lokasi akan dicek admin." });
    else setMapsMsg({ ok: false, text: "Sepertinya bukan link Google Maps. Buka kafenya di Google Maps, tekan Bagikan, lalu salin link." });
  }

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setPhotoErr(null);
    const list = Array.from(files).slice(0, MAX_PHOTOS - photos.length);
    if (files.length > list.length) setPhotoErr(`Maksimal ${MAX_PHOTOS} foto.`);
    setUploading((u) => u + list.length);
    for (const file of list) {
      try {
        if (!file.type.startsWith("image/")) throw new Error(`${file.name} bukan gambar.`);
        const blob = await compressImage(file);
        const path = uniqueName(`submissions/${userId}`);
        const { error } = await supabase.storage.from("cafe-photos").upload(path, blob, { contentType: "image/webp" });
        if (error) throw new Error(/row-level|policy|security/i.test(error.message) ? "Unggah foto belum diizinkan. Admin perlu menjalankan migrasi 0008." : error.message);
        const url = supabase.storage.from("cafe-photos").getPublicUrl(path).data.publicUrl;
        setPhotos((p) => [...p, url]);
      } catch (e) {
        setPhotoErr((e as Error).message);
      } finally {
        setUploading((u) => u - 1);
      }
    }
  }

  async function removePhoto(url: string) {
    setPhotos((p) => p.filter((x) => x !== url));
    const marker = "/cafe-photos/";
    await supabase.storage.from("cafe-photos").remove([url.slice(url.indexOf(marker) + marker.length)]);
  }

  const setRow = (i: number, patch: Partial<MenuRow>) => setMenu((m) => m.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="menu_json" value={JSON.stringify(menu.filter((m) => m.name.trim()))} />
      <input type="hidden" name="photos_json" value={JSON.stringify(photos)} />
      <input type="hidden" name="consent" value="on" />
      {QUICK.map((q) => quick[q.key] != null && <input key={q.key} type="hidden" name={`score_${q.key}`} value={quick[q.key]} />)}

      {/* ================= KIRIM CEPAT ================= */}
      <section className="card p-5 md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold">Kirim cepat</h2>
          <span className="flex items-center gap-2 text-xs font-semibold text-muted">
            <span className="flex gap-1">{done.map((d, i) => <span key={i} className={`h-1.5 w-6 rounded-full ${d ? "bg-brand" : "bg-tint"}`} />)}</span>
            {doneCount === 4 ? "Siap dikirim" : `${doneCount}/4 wajib`}
          </span>
        </div>

        <div className="mt-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
            <div>
              <label htmlFor="name" className="label">Nama kafe<Req /></label>
              <input id="name" name="name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Kopi Tembalang" className="input" />
            </div>
            <div>
              <label htmlFor="city_id" className="label">Kota<Req /></label>
              <input type="hidden" name="city_id" value={cityId === "__other" ? "" : cityId} />
              <select id="city_id" required value={cityId} onChange={(e) => setCityId(e.target.value)} className="input">
                <option value="" disabled>Pilih kota</option>
                <CityOptions cities={cities} />
                <option value="__other">Kota lain…</option>
              </select>
              {cityId === "__other" && <input name="city_other" required value={cityOther} onChange={(e) => setCityOther(e.target.value)} aria-label="Nama kota" placeholder="Tulis nama kotanya" maxLength={60} className="input mt-2" />}
            </div>
          </div>

          <div>
            <label htmlFor="maps_link" className="label">Link Google Maps<Req /></label>
            <input id="maps_link" name="maps_link" type="url" value={maps} placeholder="Tempel link dari tombol Bagikan di Google Maps" className="input" onChange={(e) => onMaps(e.target.value)} />
            <p className={`mt-1.5 text-xs ${mapsMsg && !mapsMsg.ok ? "text-[#b4533a]" : "text-muted"}`}>
              {mapsMsg?.text ?? "Buka kafenya di Google Maps → Bagikan → Salin link."}{" "}
              {!showAddress && <button type="button" onClick={() => setShowAddress(true)} className="font-semibold text-brand hover:underline">Nggak ada link? Tulis alamat</button>}
            </p>
            {showAddress && <input name="address" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} placeholder="Alamat atau patokan, mis. Jl. Banjarsari Raya dekat Undip" aria-label="Alamat" className="input mt-2" />}
          </div>

          <fieldset>
            <legend className="label">Gimana buat kerja? <span className="font-normal">(sekali ketuk, boleh dilewati)</span></legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {QUICK.map((q) => (
                <div key={q.key} className="rounded-2xl border border-line p-3">
                  <p className="flex items-center gap-1.5 text-sm font-semibold"><Icon name={q.icon} className="h-4 w-4 text-brand" />{q.label}</p>
                  <div className="mt-2 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={q.label}>
                    {q.opts.map((label, i) => {
                      const active = quick[q.key] === QUICK_VALUES[i];
                      return (
                        <button key={label} type="button" role="radio" aria-checked={active}
                          onClick={() => setQuick((v) => ({ ...v, [q.key]: active ? (undefined as unknown as number) : QUICK_VALUES[i] }))}
                          className={`flex flex-col items-center rounded-xl py-2 text-[11px] font-semibold transition-colors ${active ? "bg-brand text-white" : "bg-tint text-muted hover:bg-brand-soft"}`}>
                          <span className="text-lg leading-none">{QUICK_FACES[i]}</span>
                          <span className="mt-1">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="short_review" className="label">Kenapa enak buat kerja di sini?<Req /></label>
            <textarea id="short_review" name="short_review" required minLength={10} maxLength={200} rows={2} value={why} onChange={(e) => setWhy(e.target.value)}
              placeholder="Contoh: Lantai 2 sepi pagi hari, colokan di tiap meja, kopi susunya enak." className="input" />
          </div>

          <div>
            <p className="label">Foto <span className="font-normal">(opsional, foto pertama jadi sampul)</span></p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {photos.map((url, i) => (
                <div key={url} className="relative aspect-square overflow-hidden rounded-xl bg-tint">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  {i === 0 && <span className="absolute left-1 top-1 rounded-full bg-ink/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">Sampul</span>}
                  <button type="button" onClick={() => removePhoto(url)} aria-label="Hapus foto"
                    className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-surface/90 shadow"><Icon name="x" className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              {Array.from({ length: uploading }).map((_, i) => <div key={`u${i}`} className="aspect-square animate-pulse rounded-xl bg-tint" />)}
              {photos.length + uploading < MAX_PHOTOS && (
                <label className="grid aspect-square cursor-pointer place-items-center rounded-xl border-2 border-dashed border-line text-center text-xs text-muted hover:border-brand hover:text-brand">
                  <span><Icon name="image" className="mx-auto h-5 w-5" /><span className="mt-0.5 block">Tambah</span></span>
                  <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
                </label>
              )}
            </div>
            {photoErr && <p className="mt-2 text-sm text-[#b4533a]">{photoErr}</p>}
          </div>
        </div>
      </section>

      {/* ================= DETAIL OPSIONAL ================= */}
      <details className="group card overflow-hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 md:px-7 [&::-webkit-details-marker]:hidden">
          <span>
            <span className="block text-lg font-bold">Tambah detail <span className="font-normal text-muted">(opsional)</span></span>
            <span className="block text-sm text-muted">Penilaian lain, fasilitas, jam buka, menu andalan, dan namamu sebagai author. Boleh dilewati, admin yang melengkapi.</span>
          </span>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-tint transition-transform group-open:rotate-45"><Icon name="plus" className="h-4 w-4" /></span>
        </summary>

        <div className="space-y-6 border-t border-line p-5 md:p-7">
          <Block title="Tampil sebagai author">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="author_name" className="label">Nama yang ditampilkan</label>
                <input id="author_name" name="author_name" maxLength={60} defaultValue={defaultName} placeholder="Namamu" className="input" />
              </div>
              <div>
                <label htmlFor="author_instagram" className="label">Instagram kamu</label>
                <input id="author_instagram" name="author_instagram" maxLength={40} placeholder="tanpa @" className="input" />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {RELATIONS.map((r, i) => (
                <label key={r.value} className="cursor-pointer">
                  <input type="radio" name="relation" value={r.value} defaultChecked={i === 0} className="peer sr-only" />
                  <span className="chip !px-3 !py-1.5 !text-sm peer-checked:bg-brand peer-checked:text-white" title={r.hint}>{r.label}</span>
                </label>
              ))}
            </div>
          </Block>

          <Block title="Info tambahan">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label htmlFor="area" className="label">Area / kecamatan</label><input id="area" name="area" maxLength={80} placeholder="Tembalang" className="input" /></div>
              <div>
                <label htmlFor="price_range" className="label">Kisaran harga per orang</label>
                <select id="price_range" name="price_range" defaultValue={2} className="input">
                  {PRICE_RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div><label htmlFor="visited_at" className="label">Terakhir kamu datang</label><input id="visited_at" name="visited_at" type="date" max={new Date().toISOString().slice(0, 10)} className="input" /></div>
              <div><label htmlFor="instagram" className="label">Instagram kafe</label><input id="instagram" name="instagram" maxLength={60} placeholder="namakafe" className="input" /></div>
              <div className="sm:col-span-2"><label htmlFor="menu_url" className="label">Link buku menu</label><input id="menu_url" name="menu_url" type="url" placeholder="https://…" className="input" /></div>
            </div>
          </Block>

          <Block title="Penilaian lain" hint="Nilai 1–5, lewati yang tidak kamu tahu.">
            <ScoreFields exclude={QUICK.map((q) => q.key)} />
          </Block>

          <Block title="Fasilitas" hint="Pilih Ada, Tidak, atau ? kalau tidak yakin.">
            <AmenityFields />
          </Block>

          <Block title="Cerita lengkap">
            <div className="space-y-3">
              <textarea name="full_review" maxLength={3000} rows={4} aria-label="Ulasan lengkap" placeholder="Suasananya, kondisi saat ramai, pengalamanmu kerja di sana…" className="input" />
              <div className="grid gap-3 sm:grid-cols-2">
                <input name="tips" maxLength={300} aria-label="Tips tempat duduk" placeholder="Tips duduk: meja dekat jendela lantai 2" className="input" />
                <input name="best_time" maxLength={120} aria-label="Waktu terbaik" placeholder="Waktu terbaik: pagi 08.00–11.00" className="input" />
              </div>
            </div>
          </Block>

          <Block title="Jam buka">
            <label className="flex cursor-pointer items-center gap-3">
              <input type="checkbox" name="know_hours" checked={knowHours} onChange={(e) => setKnowHours(e.target.checked)} className="h-4 w-4 accent-brand" />
              <span className="text-sm font-medium">Aku tahu jam bukanya</span>
            </label>
            {knowHours && <div className="mt-4"><OpeningHoursInput isNew /></div>}
          </Block>

          <Block title="Menu andalan">
            <div className="space-y-2">
              {menu.map((m, i) => (
                <div key={i} className="grid grid-cols-[1fr_110px_auto] items-center gap-2">
                  <input value={m.name} onChange={(e) => setRow(i, { name: e.target.value })} maxLength={80} placeholder="Nama menu" aria-label="Nama menu" className="input !py-2" />
                  <input value={m.price} onChange={(e) => setRow(i, { price: e.target.value.replace(/\D/g, "") })} inputMode="numeric" placeholder="Harga" aria-label="Harga" className="input !py-2 tabular-nums" />
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium" title="Wajib coba">
                    <input type="checkbox" checked={m.is_must_try} onChange={(e) => setRow(i, { is_must_try: e.target.checked })} className="h-4 w-4 accent-brand" />⭐
                  </label>
                </div>
              ))}
              {menu.length < MAX_MENU && (
                <button type="button" onClick={() => setMenu((x) => [...x, emptyMenu()])} className="text-sm font-semibold text-brand hover:underline">+ Tambah menu</button>
              )}
            </div>
          </Block>
        </div>
      </details>

      <div className="rounded-2xl border border-line bg-surface p-4">
        {state?.error && <p role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="order-2 max-w-md text-xs text-muted sm:order-1">Dengan mengirim, kamu setuju ulasan &amp; foto ini milikmu dan boleh ditampilkan WorkFromCafe dengan namamu sebagai author.</p>
          <Submit disabled={uploading > 0} />
        </div>
      </div>
    </form>
  );
}

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending || disabled} className="btn-primary order-1 w-full sm:order-2 sm:w-auto">
      <Icon name="send" className="h-4 w-4" />
      {pending ? "Mengirim…" : disabled ? "Tunggu foto…" : "Kirim rekomendasi"}
    </button>
  );
}

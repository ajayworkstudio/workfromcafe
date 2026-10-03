"use client";
import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { compressImage, uniqueName } from "@/lib/compressImage";
import type { MenuItem } from "@/lib/types";
import { rupiah } from "@/lib/utils";

type Draft = { name: string; price: string; note: string; is_must_try: boolean; file: File | null };
const empty: Draft = { name: "", price: "", note: "", is_must_try: false, file: null };

export default function MenuEditor({ cafeId, initial }: { cafeId: string; initial: MenuItem[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [draft, setDraft] = useState<Draft>(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      let photo_url: string | undefined;
      if (draft.file) {
        const blob = await compressImage(draft.file, 800);
        const path = uniqueName(`${cafeId}/menu`);
        const { error } = await supabase.storage.from("cafe-photos").upload(path, blob, { contentType: "image/webp" });
        if (error) throw error;
        photo_url = supabase.storage.from("cafe-photos").getPublicUrl(path).data.publicUrl;
      }
      const row = {
        name: draft.name,
        price: draft.price ? Number(draft.price) : null,
        note: draft.note || null,
        is_must_try: draft.is_must_try,
        ...(photo_url ? { photo_url } : {}),
      };
      if (editing) {
        const { data, error } = await supabase.from("menu_items").update(row).eq("id", editing).select().single();
        if (error) throw error;
        setItems((xs) => xs.map((x) => (x.id === editing ? (data as MenuItem) : x)));
      } else {
        const { data, error } = await supabase
          .from("menu_items")
          .insert({ ...row, cafe_id: cafeId, sort_order: items.length })
          .select()
          .single();
        if (error) throw error;
        setItems((xs) => [...xs, data as MenuItem]);
      }
      setDraft(empty);
      setEditing(null);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Hapus menu ini?")) return;
    await supabase.from("menu_items").delete().eq("id", id);
    setItems((xs) => xs.filter((x) => x.id !== id));
    router.refresh();
  }

  async function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[index], next[j]] = [next[j], next[index]];
    setItems(next);
    await Promise.all(next.map((m, i) => supabase.from("menu_items").update({ sort_order: i }).eq("id", m.id)));
  }

  return (
    <section className="card p-5">
      <h2 className="font-display text-lg font-bold">Menu rekomendasi ({items.length}) 🔒</h2>
      <div className="mt-4 space-y-2">
        {items.map((m, i) => (
          <div key={m.id} className="flex items-center gap-3 rounded-xl border border-roast/10 p-2">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-foam">
              {m.photo_url && <Image src={m.photo_url} alt="" fill sizes="48px" className="object-cover" />}
            </div>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold">{m.name} {m.is_must_try && <span className="text-terra">• wajib coba</span>}</p>
              <p className="truncate text-bean/60">{rupiah(m.price)} {m.note ? `· ${m.note}` : ""}</p>
            </div>
            <button onClick={() => move(i, -1)} className="px-1 text-bean/60" aria-label="Naik">↑</button>
            <button onClick={() => move(i, 1)} className="px-1 text-bean/60" aria-label="Turun">↓</button>
            <button
              onClick={() => { setEditing(m.id); setDraft({ name: m.name, price: m.price?.toString() ?? "", note: m.note ?? "", is_must_try: m.is_must_try, file: null }); }}
              className="text-sm font-semibold text-terra"
            >Edit</button>
            <button onClick={() => remove(m.id)} className="text-sm text-bean/60">Hapus</button>
          </div>
        ))}
      </div>

      <form onSubmit={save} className="mt-4 grid gap-2 rounded-xl bg-foam p-3 md:grid-cols-[2fr_1fr_2fr_auto]">
        <input required placeholder="Nama menu" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="input" />
        <input type="number" placeholder="Harga" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} className="input" />
        <input placeholder="Catatan (opsional)" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} className="input" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={draft.is_must_try} onChange={(e) => setDraft({ ...draft, is_must_try: e.target.checked })} className="accent-terra" /> Wajib coba
        </label>
        <input type="file" accept="image/*" onChange={(e) => setDraft({ ...draft, file: e.target.files?.[0] ?? null })} className="text-sm md:col-span-2" />
        <div className="flex gap-2 md:col-span-2 md:justify-end">
          {editing && <button type="button" onClick={() => { setEditing(null); setDraft(empty); }} className="btn-ghost">Batal</button>}
          <button disabled={busy} className="btn-dark">{busy ? "Menyimpan…" : editing ? "Simpan menu" : "+ Tambah menu"}</button>
        </div>
      </form>
      {err && <p className="mt-2 text-sm text-terra-dark">{err}</p>}
    </section>
  );
}

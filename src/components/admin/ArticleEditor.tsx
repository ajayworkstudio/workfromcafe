"use client";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import ArticleBody, { type Spacing } from "@/components/ArticleBody";
import Icon from "@/components/Icon";
import { createClient } from "@/lib/supabase/client";
import { compressImage, uniqueName } from "@/lib/compressImage";

type CafeOpt = { slug: string; name: string };

/**
 * Kolom isi artikel dengan toolbar (judul bagian, tebal, link, daftar, perataan, gambar, sisipkan kafe) dan pratinjau.
 * Tetap textarea biasa bernama "body", jadi ikut terkirim bersama form tanpa JavaScript tambahan.
 */
const SPACINGS: Spacing[] = ["rapat", "normal", "lega"];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export default function ArticleEditor({ defaultValue, cafes, line: line0 = "normal", gap: gap0 = "normal" }: {
  defaultValue: string; cafes: CafeOpt[]; line?: Spacing; gap?: Spacing;
}) {
  const [text, setText] = useState(defaultValue);
  const [line, setLine] = useState<Spacing>(line0);
  const [gap, setGap] = useState<Spacing>(gap0);
  const [tab, setTab] = useState<"tulis" | "pratinjau">("tulis");
  const [cafe, setCafe] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const [uploading, setUploading] = useState(false);
  const [imgErr, setImgErr] = useState<string | null>(null);

  // Bungkus teks yang dipilih (atau sisipkan contoh) lalu kembalikan kursor ke dalamnya
  function apply(fn: (sel: string) => { text: string; select?: [number, number] }) {
    const el = ref.current;
    if (!el) return;
    const [a, b] = [el.selectionStart, el.selectionEnd];
    const cur = el.value; // isi terbaru, juga saat dipanggil setelah unggah gambar selesai
    const r = fn(cur.slice(a, b));
    const next = cur.slice(0, a) + r.text + cur.slice(b);
    // Langsung (tanpa menunggu frame berikutnya) supaya huruf yang diketik setelah menekan tombol tidak hilang
    flushSync(() => setText(next));
    el.focus();
    const [s, e] = r.select ?? [r.text.length, r.text.length];
    el.setSelectionRange(a + s, a + e);
  }
  // Blok (judul, daftar, kartu kafe) selalu di baris sendiri dengan baris kosong di sekitarnya
  const block = (s: string) => {
    const el = ref.current!;
    const before = el.value.slice(0, el.selectionStart);
    const pre = !before || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
    return pre + s + "\n\n";
  };

  // Perataan berlaku untuk satu blok (dipisah baris kosong) tempat kursor berada
  function align(to: "kiri" | "tengah" | "kanan") {
    const el = ref.current;
    if (!el) return;
    const pos = el.selectionStart;
    const s0 = text.lastIndexOf("\n\n", Math.max(0, pos - 1));
    const start = s0 < 0 ? 0 : s0 + 2;
    const e0 = text.indexOf("\n\n", pos);
    const end = e0 < 0 ? text.length : e0;
    const blockText = text.slice(start, end);
    const bare = blockText.replace(/^\[(kiri|tengah|kanan)\][ \t]*/, "");
    const next = (to === "kiri" ? "" : `[${to}] `) + bare;
    flushSync(() => setText(text.slice(0, start) + next + text.slice(end)));
    el.focus();
    const c = Math.min(start + next.length, Math.max(start, pos + next.length - blockText.length));
    el.setSelectionRange(c, c);
  }

  async function addImage(file?: File) {
    if (!file) return;
    const el = ref.current;
    const at = el ? el.selectionStart : text.length;
    setUploading(true); setImgErr(null);
    try {
      const supabase = createClient();
      const path = uniqueName("articles");
      const { error } = await supabase.storage.from("cafe-photos").upload(path, await compressImage(file), { contentType: "image/webp" });
      if (error) throw error;
      const url = supabase.storage.from("cafe-photos").getPublicUrl(path).data.publicUrl;
      const md = `![Keterangan gambar](${url})`;
      // Pindah ke Pratinjau saat mengunggah: kolom tulis tidak ada, jadi gambar ditaruh di akhir
      if (!ref.current) { setText((t) => `${t.trimEnd()}\n\n${md}\n\n`); return; }
      ref.current.setSelectionRange(at, at);
      // Keterangan langsung terpilih supaya bisa diketik ulang (dipakai sebagai alt untuk Google)
      apply(() => { const t = block(md); const i = t.indexOf("![") + 2; return { text: t, select: [i, i + 17] }; });
    } catch (e) {
      setImgErr(`Gambar gagal diunggah: ${(e as Error).message}`);
    } finally {
      setUploading(false);
    }
  }

  const tools: { label: string; title: string; run: () => void }[] = [
    { label: "Judul", title: "Judul bagian (##)", run: () => apply((s) => { const t = block(`## ${s || "Judul bagian"}`); return { text: t, select: [t.indexOf("## ") + 3, t.indexOf("## ") + 3 + (s || "Judul bagian").length] }; }) },
    { label: "Sub", title: "Sub judul (###)", run: () => apply((s) => { const t = block(`### ${s || "Sub judul"}`); return { text: t, select: [t.indexOf("### ") + 4, t.indexOf("### ") + 4 + (s || "Sub judul").length] }; }) },
    { label: "B", title: "Tebal", run: () => apply((s) => ({ text: `**${s || "teks tebal"}**`, select: [2, 2 + (s || "teks tebal").length] })) },
    { label: "Link", title: "Link", run: () => apply((s) => { const t = `[${s || "teks link"}](https://)`; return { text: t, select: [t.length - 9, t.length - 1] }; }) },
    { label: "Daftar", title: "Daftar butir", run: () => apply((s) => ({ text: block((s || "butir pertama\nbutir kedua").split("\n").map((l) => `- ${l.replace(/^[-*] /, "")}`).join("\n")) })) },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-tint/60 p-2">
        <div role="tablist" className="mr-auto flex gap-1">
          {(["tulis", "pratinjau"] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`min-h-11 rounded-full px-4 text-sm font-semibold ${tab === t ? "bg-ink text-white" : "text-muted hover:text-ink"}`}>
              {t === "tulis" ? "Tulis" : "Pratinjau"}
            </button>
          ))}
        </div>
        {tab === "tulis" && tools.map((t) => (
          <button key={t.label} type="button" title={t.title} aria-label={t.title} onClick={t.run}
            className={`min-h-11 min-w-11 rounded-xl border border-line bg-surface px-3 text-sm hover:border-brand ${t.label === "B" ? "font-extrabold" : "font-semibold"}`}>
            {t.label}
          </button>
        ))}
        {tab === "tulis" && (
          <>
            {([["kiri", "alignLeft", "Rata kiri"], ["tengah", "alignCenter", "Rata tengah"], ["kanan", "alignRight", "Rata kanan"]] as const).map(([v, icon, label]) => (
              <button key={v} type="button" title={label} aria-label={label} onClick={() => align(v)}
                className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-line bg-surface hover:border-brand">
                <Icon name={icon} className="h-5 w-5" />
              </button>
            ))}
            <label title="Sisipkan gambar" className={`flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-sm font-semibold hover:border-brand has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand ${uploading ? "opacity-60" : ""}`}>
              <Icon name="picture" className="h-5 w-5" />{uploading ? "Mengunggah…" : "Gambar"}
              <input type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={(e) => { addImage(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
          </>
        )}
      </div>
      {imgErr && <p role="alert" className="border-b border-line bg-[#fbeae5] px-3 py-2 text-sm text-[#8c3b25]">{imgErr}</p>}

      <div className="flex flex-wrap gap-x-5 gap-y-2 border-b border-line px-3 py-2">
        {([["line_spacing", "Jarak baris", line, setLine], ["paragraph_spacing", "Jarak paragraf", gap, setGap]] as const).map(([name, label, value, set]) => (
          <fieldset key={name} className="flex items-center gap-2">
            <legend className="sr-only">{label}</legend>
            <span aria-hidden className="text-sm text-muted">{label}</span>
            <div className="flex rounded-full border border-line bg-tint/60 p-0.5">
              {SPACINGS.map((v) => (
                <label key={v} className={`flex min-h-11 cursor-pointer items-center rounded-full px-3.5 text-sm font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand ${value === v ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"}`}>
                  <input type="radio" name={name} value={v} checked={value === v} onChange={() => set(v)} className="sr-only" />{cap(v)}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      {tab === "tulis" ? (
        <>
          <label htmlFor="b" className="sr-only">Isi artikel</label>
          <textarea ref={ref} id="b" name="body" rows={18} value={text} onChange={(e) => setText(e.target.value)}
            className="block w-full resize-y border-0 bg-surface p-4 font-mono text-sm outline-none" />
          <div className="flex flex-wrap items-center gap-2 border-t border-line p-2">
            <label htmlFor="sisip" className="sr-only">Pilih kafe untuk disisipkan</label>
            <select id="sisip" value={cafe} onChange={(e) => setCafe(e.target.value)} className="input !w-auto min-w-0 flex-1 sm:max-w-xs">
              <option value="">Pilih kafe untuk disisipkan…</option>
              {cafes.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
            <button type="button" disabled={!cafe} onClick={() => { apply(() => ({ text: block(`[[kafe:${cafe}]]`) })); setCafe(""); }}
              className="btn-ghost min-h-11 text-sm disabled:opacity-50">Sisipkan kartu kafe</button>
            <span className="ml-auto text-xs text-muted">{text.trim() ? text.trim().split(/\s+/).length : 0} kata</span>
          </div>
        </>
      ) : (
        <>
          {/* Saat pratinjau, isi tetap ikut terkirim */}
          <input type="hidden" name="body" value={text} />
          <div className="min-h-64 p-5">
            {text.trim() ? <ArticleBody body={text} cafes={[]} line={line} gap={gap} placeholders={new Map(cafes.map((c) => [c.slug, c.name]))} />
              : <p className="text-muted">Belum ada isi.</p>}
          </div>
        </>
      )}
    </div>
  );
}

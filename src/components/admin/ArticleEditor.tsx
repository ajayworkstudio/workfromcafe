"use client";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import ArticleBody from "@/components/ArticleBody";

type CafeOpt = { slug: string; name: string };

/**
 * Kolom isi artikel dengan toolbar (judul bagian, tebal, link, daftar, sisipkan kafe) dan pratinjau.
 * Tetap textarea biasa bernama "body", jadi ikut terkirim bersama form tanpa JavaScript tambahan.
 */
export default function ArticleEditor({ defaultValue, cafes }: { defaultValue: string; cafes: CafeOpt[] }) {
  const [text, setText] = useState(defaultValue);
  const [tab, setTab] = useState<"tulis" | "pratinjau">("tulis");
  const [cafe, setCafe] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  // Bungkus teks yang dipilih (atau sisipkan contoh) lalu kembalikan kursor ke dalamnya
  function apply(fn: (sel: string) => { text: string; select?: [number, number] }) {
    const el = ref.current;
    if (!el) return;
    const [a, b] = [el.selectionStart, el.selectionEnd];
    const r = fn(text.slice(a, b));
    const next = text.slice(0, a) + r.text + text.slice(b);
    // Langsung (tanpa menunggu frame berikutnya) supaya huruf yang diketik setelah menekan tombol tidak hilang
    flushSync(() => setText(next));
    el.focus();
    const [s, e] = r.select ?? [r.text.length, r.text.length];
    el.setSelectionRange(a + s, a + e);
  }
  // Blok (judul, daftar, kartu kafe) selalu di baris sendiri dengan baris kosong di sekitarnya
  const block = (s: string) => {
    const el = ref.current!;
    const before = text.slice(0, el.selectionStart);
    const pre = !before || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
    return pre + s + "\n\n";
  };

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
            {text.trim() ? <ArticleBody body={text} cafes={[]} placeholders={new Map(cafes.map((c) => [c.slug, c.name]))} />
              : <p className="text-muted">Belum ada isi.</p>}
          </div>
        </>
      )}
    </div>
  );
}

import Link from "next/link";
import CafeCard from "./CafeCard";
import type { Cafe } from "@/lib/types";

/*
  Format tulisan artikel manual (sengaja sederhana supaya mudah ditulis dari HP):
  ## Judul bagian      ### Sub judul      - butir daftar
  **tebal**            [teks](https://link)
  [[kafe:slug-kafe]]   di baris sendiri: kartu kafe dari database
  ![keterangan](https://…)  di baris sendiri: gambar, keterangannya jadi alt dan teks di bawah gambar
  [tengah] atau [kanan] di awal paragraf/judul/gambar: perataan (tanpa penanda = rata kiri)
  Baris kosong memisahkan paragraf. Semua teks di-escape oleh React, tidak ada HTML mentah.
*/

function inline(text: string, key: string) {
  const parts: React.ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(((?:https?:\/\/|\/)[^\s)]+)\)/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) parts.push(<strong key={`${key}-${i++}`}>{m[1]}</strong>);
    else {
      const href = m[3];
      parts.push(href.startsWith("/")
        ? <Link key={`${key}-${i++}`} href={href} className="font-semibold text-brand underline underline-offset-2">{m[2]}</Link>
        : <a key={`${key}-${i++}`} href={href} target="_blank" rel="noopener" className="font-semibold text-brand underline underline-offset-2">{m[2]}</a>);
    }
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export type Spacing = "rapat" | "normal" | "lega";
const LINE: Record<Spacing, string> = { rapat: "leading-snug", normal: "leading-relaxed", lega: "leading-[1.9]" };
const GAP: Record<Spacing, string> = { rapat: "space-y-3", normal: "space-y-5", lega: "space-y-8" };
export const asSpacing = (v: unknown): Spacing => (v === "rapat" || v === "lega" ? v : "normal");

export default function ArticleBody({ body, cafes, placeholders, line = "normal", gap = "normal" }: {
  body: string;
  cafes: Cafe[];
  /** Jarak antarbaris dan antarparagraf, diatur per artikel di editor */
  line?: Spacing;
  gap?: Spacing;
  /** Pratinjau editor: tampilkan kotak nama kafe sebagai pengganti kartu */
  placeholders?: Map<string, string>;
}) {
  const bySlug = new Map(cafes.map((c) => [c.slug, c]));
  const blocks = body.replace(/\r/g, "").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className={`${GAP[gap]} ${LINE[line]} text-[17px] text-ink/90`}>
      {blocks.map((raw, i) => {
        const k = `b${i}`;
        const am = raw.match(/^\[(kiri|tengah|kanan)\][ \t]*/);
        const b = am ? raw.slice(am[0].length) : raw;
        const al = am?.[1] === "tengah" ? "text-center" : am?.[1] === "kanan" ? "text-right" : "";
        const img = b.match(/^!\[([^\]]*)\]\(((?:https:\/\/|\/)[^\s)]+)\)$/);
        if (img) {
          return (
            <figure key={k} className={`my-6 ${al}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img[2]} alt={img[1]} loading="lazy" decoding="async"
                className={`max-h-[70vh] max-w-full rounded-[var(--radius-photo)] bg-tint ${am?.[1] === "tengah" ? "mx-auto" : am?.[1] === "kanan" ? "ml-auto" : ""}`} />
              {img[1] && <figcaption className="mt-2 text-sm text-muted">{img[1]}</figcaption>}
            </figure>
          );
        }
        const embed = b.match(/^\[\[kafe:([\w-]+)\]\]$/);
        if (embed) {
          const c = bySlug.get(embed[1]);
          if (!c && placeholders) {
            const name = placeholders.get(embed[1]);
            return <p key={k} className={`my-6 max-w-sm rounded-2xl border-2 border-dashed p-4 text-sm ${name ? "border-mist text-muted" : "border-[#b4533a] text-[#8c3b25]"}`}>{name ? `Kartu kafe: ${name}` : `Kafe "${embed[1]}" tidak ditemukan atau belum tayang`}</p>;
          }
          return c ? <div key={k} className="not-prose my-6 max-w-sm"><CafeCard cafe={c} /></div> : null;
        }
        if (b.startsWith("### ")) return <h3 key={k} className={`${al} pt-2 font-sans text-xl font-bold tracking-normal text-ink`}>{inline(b.slice(4), k)}</h3>;
        if (b.startsWith("## ")) return <h2 key={k} className={`${al} pt-4 text-2xl font-bold text-ink`}>{inline(b.slice(3), k)}</h2>;
        const lines = b.split("\n");
        if (lines.every((l) => /^[-*] /.test(l))) {
          return <ul key={k} className={`list-disc space-y-1.5 ${al ? `${al} list-inside` : "pl-6"}`}>{lines.map((l, j) => <li key={j}>{inline(l.slice(2), `${k}-${j}`)}</li>)}</ul>;
        }
        return <p key={k} className={al || undefined}>{lines.flatMap((l, j) => (j ? [<br key={`br${j}`} />, ...inline(l, `${k}-${j}`)] : inline(l, `${k}-${j}`)))}</p>;
      })}
    </div>
  );
}

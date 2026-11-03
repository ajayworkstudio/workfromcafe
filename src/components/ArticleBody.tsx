import Link from "next/link";
import CafeCard from "./CafeCard";
import type { Cafe } from "@/lib/types";

/*
  Format tulisan artikel manual (sengaja sederhana supaya mudah ditulis dari HP):
  ## Judul bagian      ### Sub judul      - butir daftar
  **tebal**            [teks](https://link)
  [[kafe:slug-kafe]]   di baris sendiri: kartu kafe dari database
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

export default function ArticleBody({ body, cafes, placeholders }: {
  body: string;
  cafes: Cafe[];
  /** Pratinjau editor: tampilkan kotak nama kafe sebagai pengganti kartu */
  placeholders?: Map<string, string>;
}) {
  const bySlug = new Map(cafes.map((c) => [c.slug, c]));
  const blocks = body.replace(/\r/g, "").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="space-y-5 text-[17px] leading-relaxed text-ink/90">
      {blocks.map((b, i) => {
        const k = `b${i}`;
        const embed = b.match(/^\[\[kafe:([\w-]+)\]\]$/);
        if (embed) {
          const c = bySlug.get(embed[1]);
          if (!c && placeholders) {
            const name = placeholders.get(embed[1]);
            return <p key={k} className={`my-6 max-w-sm rounded-2xl border-2 border-dashed p-4 text-sm ${name ? "border-mist text-muted" : "border-[#b4533a] text-[#8c3b25]"}`}>{name ? `Kartu kafe: ${name}` : `Kafe "${embed[1]}" tidak ditemukan atau belum tayang`}</p>;
          }
          return c ? <div key={k} className="not-prose my-6 max-w-sm"><CafeCard cafe={c} /></div> : null;
        }
        if (b.startsWith("### ")) return <h3 key={k} className="pt-2 font-sans text-xl font-bold tracking-normal text-ink">{inline(b.slice(4), k)}</h3>;
        if (b.startsWith("## ")) return <h2 key={k} className="pt-4 text-2xl font-bold text-ink">{inline(b.slice(3), k)}</h2>;
        const lines = b.split("\n");
        if (lines.every((l) => /^[-*] /.test(l))) {
          return <ul key={k} className="list-disc space-y-1.5 pl-6">{lines.map((l, j) => <li key={j}>{inline(l.slice(2), `${k}-${j}`)}</li>)}</ul>;
        }
        return <p key={k}>{lines.flatMap((l, j) => (j ? [<br key={`br${j}`} />, ...inline(l, `${k}-${j}`)] : inline(l, `${k}-${j}`)))}</p>;
      })}
    </div>
  );
}

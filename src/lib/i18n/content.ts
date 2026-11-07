// Terjemahan konten dari database (ulasan, menu, artikel) lewat DeepL, disimpan di tabel
// content_translations supaya tiap teks hanya diterjemahkan sekali. Teks yang berubah punya
// hash baru, jadi otomatis diterjemahkan ulang. Tanpa DEEPL_API_KEY atau saat DeepL gagal,
// teks asli bahasa Indonesia yang tampil.
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";
import type { Lang } from "./core";

export type Piece = { entity: string; id: string; field: string; text: string | null | undefined };
type Row = { entity: string; entity_id: string; field: string; source_hash: string; text: string };

const keyOf = (p: { entity: string; id: string; field: string }) => `${p.entity}:${p.id}:${p.field}`;
const hashOf = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 24);

/** Kembalikan fungsi pengambil teks terjemahan; jatuh ke teks asli kalau tidak ada. */
export async function translateContent(lang: Lang, pieces: Piece[]) {
  const out = new Map<string, string>();
  const get = (entity: string, id: string, field: string, original: string | null | undefined) =>
    original ? out.get(keyOf({ entity, id, field })) ?? original : original ?? null;

  const key = process.env.DEEPL_API_KEY;
  const todo = pieces.filter((p): p is Piece & { text: string } => !!p.text?.trim());
  if (lang !== "en" || !key || !process.env.SUPABASE_SERVICE_ROLE_KEY || !todo.length) return get;

  try {
    const db = createAdminClient();
    const ids = [...new Set(todo.map((p) => p.id))];
    const { data } = await db.from("content_translations")
      .select("entity,entity_id,field,source_hash,text")
      .eq("lang", "en").in("entity_id", ids);
    const cached = new Map((data as Row[] | null ?? []).map((r) => [`${r.entity}:${r.entity_id}:${r.field}`, r]));

    const missing: (Piece & { text: string; hash: string })[] = [];
    for (const p of todo) {
      const hash = hashOf(p.text);
      const hit = cached.get(keyOf(p));
      if (hit && hit.source_hash === hash) out.set(keyOf(p), hit.text);
      else missing.push({ ...p, hash });
    }
    if (!missing.length) return get;

    const done = await translateMarkdown(missing.map((m) => m.text), key);
    if (!done) return get;
    const rows = missing.map((m, i) => {
      out.set(keyOf(m), done[i]);
      return { entity: m.entity, entity_id: m.id, field: m.field, lang: "en", source_hash: m.hash, text: done[i], updated_at: new Date().toISOString() };
    });
    await db.from("content_translations").upsert(rows, { onConflict: "entity,entity_id,field,lang" });
  } catch (e) {
    console.error("translateContent", e instanceof Error ? e.message : e);
  }
  return get;
}

// ---------- Markdown → DeepL → markdown ----------
// Dikirim per baris. Penanda blok ([tengah], ##, - ) dan baris gambar/sematan kafe tidak dikirim.
// Tebal dan link diubah ke tag XML supaya DeepL menjaga posisinya, lalu dikembalikan lagi.

const SKIP_LINE = /^(?:\[(?:kiri|tengah|kanan)\][ \t]*)?(?:!\[[^\]]*\]\([^)]*\)|\[\[kafe:[\w-]+\]\])$/;
const PREFIX = /^((?:\[(?:kiri|tengah|kanan)\][ \t]*)?(?:#{2,3} |[-*] |\d+\. )?)([\s\S]*)$/;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const unesc = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

function toXml(line: string) {
  return esc(line)
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/)[^\s)]+)\)/g, (_, txt, href) => `<a href="${href.replace(/"/g, "&quot;")}">${txt}</a>`);
}
function fromXml(xml: string) {
  const md = xml
    .replace(/<b>([\s\S]*?)<\/b>/g, "**$1**")
    .replace(/<a href="([^"]*)">([\s\S]*?)<\/a>/g, (_, href, txt) => `[${txt}](${href})`)
    .replace(/<\/?[a-z][^>]*>/gi, "");
  return unesc(md);
}

async function translateMarkdown(texts: string[], key: string): Promise<string[] | null> {
  // Pecah setiap teks jadi baris; simpan posisi baris yang perlu diterjemahkan.
  const lines = texts.map((t) => t.replace(/\r/g, "").split("\n"));
  const jobs: { ti: number; li: number; prefix: string }[] = [];
  const send: string[] = [];
  lines.forEach((ls, ti) => ls.forEach((l, li) => {
    if (!l.trim() || SKIP_LINE.test(l.trim())) return;
    const [, prefix, rest] = l.match(PREFIX)!;
    if (!/\p{L}/u.test(rest)) return;
    jobs.push({ ti, li, prefix });
    send.push(toXml(rest));
  }));
  if (!send.length) return texts;

  const result = await deepl(send, key);
  if (!result) return null;
  jobs.forEach((j, i) => { lines[j.ti][j.li] = j.prefix + fromXml(result[i]); });
  return lines.map((ls) => ls.join("\n"));
}

async function deepl(texts: string[], key: string): Promise<string[] | null> {
  const host = key.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com";
  const chunks: string[][] = [];
  for (let i = 0; i < texts.length; i += 50) chunks.push(texts.slice(i, i + 50));
  try {
    const parts = await Promise.all(chunks.map(async (text) => {
      const res = await fetch(`${host}/v2/translate`, {
        method: "POST",
        headers: { Authorization: `DeepL-Auth-Key ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text, source_lang: "ID", target_lang: "EN-GB", tag_handling: "xml", preserve_formatting: true }),
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`DeepL ${res.status}`);
      const json = (await res.json()) as { translations: { text: string }[] };
      return json.translations.map((t) => t.text);
    }));
    return parts.flat();
  } catch (e) {
    console.error("deepl", e instanceof Error ? e.message : e);
    return null;
  }
}

// ---------- Pembantu untuk artikel ----------
type ArticleText = { id: string; title: string; excerpt?: string | null; body?: string };

/** Terjemahkan judul, ringkasan, dan (kalau withBody) isi artikel. Mengembalikan salinan. */
export async function translateArticles<A extends ArticleText>(lang: Lang, list: A[], withBody = false): Promise<A[]> {
  if (lang !== "en" || !list.length) return list;
  const get = await translateContent(lang, list.flatMap((a) => [
    { entity: "article", id: a.id, field: "title", text: a.title },
    { entity: "article", id: a.id, field: "excerpt", text: a.excerpt },
    ...(withBody ? [{ entity: "article", id: a.id, field: "body", text: a.body }] : []),
  ]));
  return list.map((a) => ({
    ...a,
    title: get("article", a.id, "title", a.title) ?? a.title,
    excerpt: a.excerpt === undefined ? undefined : get("article", a.id, "excerpt", a.excerpt),
    ...(withBody && a.body !== undefined ? { body: get("article", a.id, "body", a.body) ?? a.body } : {}),
  }));
}

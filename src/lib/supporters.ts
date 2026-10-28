/** Pendukung (donatur) WFC Hunters dari Saweria, Trakteer, atau dicatat manual oleh admin. */
export type Supporter = {
  id: string; source: "saweria" | "trakteer" | "manual"; external_id: string | null;
  name: string; message: string | null; amount: number | null; email: string | null;
  is_hidden: boolean; created_at: string;
};

export type PublicSupporter = { id: string; name: string; message: string | null; created_at: string };

export const SOURCE_LABEL: Record<Supporter["source"], string> = { saweria: "Saweria", trakteer: "Trakteer", manual: "Manual" };

/** Rapikan nama/pesan untuk ditampilkan publik: tanpa link, tanpa spasi berlebih, panjang dibatasi. */
export function cleanText(v: unknown, max: number): string | null {
  const s = String(v ?? "")
    .replace(/https?:\/\/\S+|www\.\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
  return s || null;
}

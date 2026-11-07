// Inti terjemahan tampilan. Kalimat sumber = teks bahasa Indonesia apa adanya;
// kamus EN memetakan kalimat itu ke versi Inggris. Kalimat yang belum ada di kamus
// tampil dalam bahasa Indonesia (skrip `npm run i18n:check` mendaftar yang belum ada).

export type Lang = "id" | "en";
export const LANG_COOKIE = "lang";
export type Vars = Record<string, string | number>;
export type T = (s: string, vars?: Vars) => string;

export const asLang = (v: string | undefined | null): Lang => (v === "en" ? "en" : "id");

export function makeT(lang: Lang, dict: Record<string, string> | null): T {
  return (s, vars) => {
    const base = lang === "en" && dict ? (dict[s] ?? s) : s;
    return vars ? base.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? "")) : base;
  };
}

/** Locale untuk tanggal dan angka. */
export const localeOf = (lang: Lang) => (lang === "en" ? "en-GB" : "id-ID");

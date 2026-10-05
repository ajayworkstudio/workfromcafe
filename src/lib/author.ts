import { cache } from "react";
import { createClient } from "./supabase/server";

export type PublicAuthor = {
  id: string; name: string; avatar_url: string | null; bio: string | null; instagram: string | null; username: string | null;
  cafe_count: number; month_count: number; first_at: string; last_at: string;
};

/** Level author berdasarkan jumlah kafe yang sudah tayang. */
export const LEVELS = [
  { min: 1, name: "Penjelajah", icon: "pin", className: "bg-brand-soft text-brand" },
  { min: 5, name: "Kurator", icon: "star", className: "bg-gold/20 text-[#8a5a00]" },
  { min: 15, name: "Kurator Utama", icon: "sparkle", className: "bg-ink text-white" },
] as const;

export function levelFor(count: number) {
  const idx = LEVELS.reduce((i, l, j) => (count >= l.min ? j : i), -1);
  const current = idx >= 0 ? LEVELS[idx] : null;
  const next = LEVELS[idx + 1] ?? null;
  return { current, next, toNext: next ? next.min - count : 0 };
}

export const authorHref = (a: { username: string | null; id: string }) => `/author/${a.username ?? a.id}`;

/** Username otomatis dari nama, mis. "Rina Kusuma" → "rina-kusuma-3f2a". */
export function autoUsername(name: string | null | undefined, id: string) {
  const base = (name ?? "author").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "author";
  return `${base}-${id.slice(0, 4)}`;
}

export const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,29}$/;

/** Semua author publik (punya minimal 1 kafe tayang). Kosong kalau migrasi 0012 belum dijalankan. */
export const getAuthors = cache(async (): Promise<PublicAuthor[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("authors_list");
  return error ? [] : ((data as PublicAuthor[] | null) ?? []);
});

/** Author of the month: pilihan admin (username), kalau kosong otomatis yang paling banyak kafe bulan ini. */
export function pickFeatured(authors: PublicAuthor[], setting: string) {
  if (!authors.length) return null;
  const chosen = setting ? authors.find((a) => a.username === setting.replace(/^@/, "").toLowerCase()) : null;
  if (chosen) return chosen;
  const thisMonth = [...authors].filter((a) => a.month_count > 0).sort((a, b) => b.month_count - a.month_count || b.cafe_count - a.cafe_count);
  return thisMonth[0] ?? null;
}

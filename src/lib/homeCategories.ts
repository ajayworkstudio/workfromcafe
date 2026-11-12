import type { Cafe } from "./types";
import { averageScore, cleanScore } from "./review";

const hasTag = (c: Cafe, name: string) => (c.tags ?? []).some((t) => t.tag?.name === name);
const rating = (c: Cafe) => (c.my_rating != null ? Number(c.my_rating) : averageScore(c.scores)) ?? 0;

/** Rata-rata internet, colokan, dan ketenangan. Aspek yang belum dinilai tidak dihitung. */
function workScore(c: Cafe) {
  const v = (["internet", "colokan", "ketenangan"] as const).map((k) => cleanScore(c.scores?.[k])).filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}

/**
 * Dua daftar "Cocok untuk" di beranda, dari tag WFC dan Nongkrong.
 * Hampir semua kafe punya dua tag itu, jadi kafe yang sudah masuk daftar WFC tidak diulang di Nongkrong.
 */
export function homeCategories(cafes: Cafe[], limit = 6) {
  const wfc = cafes
    .filter((c) => hasTag(c, "WFC"))
    .sort((a, b) => workScore(b) - workScore(a) || rating(b) - rating(a))
    .slice(0, limit);
  const taken = new Set(wfc.map((c) => c.id));
  const nongkrong = cafes
    .filter((c) => hasTag(c, "Nongkrong") && !taken.has(c.id))
    .sort((a, b) => rating(b) - rating(a))
    .slice(0, limit);
  return { wfc, nongkrong };
}

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "./supabase/server";
import type { Plan } from "./types";

export type Settings = {
  price_monthly: number;
  price_yearly: number;
  free_unlock_limit_per_month: number;
  manual_payment_enabled: boolean;
  whatsapp_number: string;
  qris_image_url: string;
  qris_name: string;
  qris_merchant_name: string;
  trial_days: number;
  sheet_url: string;
  sheet_last_sync: string;
  /** Link grup/komunitas WhatsApp untuk author & WFC hunters ("" = sembunyikan) */
  community_url: string;
  /** Username author of the month pilihan admin ("" = otomatis) */
  featured_author: string;
  /** true = menu Event terbuka untuk umum; false = hanya admin, umum melihat "Segera" */
  events_public: boolean;
  /** true = semua fitur gratis untuk semua orang; langganan, trial, dan halaman harga disembunyikan. */
  free_mode: boolean;
};

export const DEFAULT_COMMUNITY_URL = "https://chat.whatsapp.com/J08g0t98OCG3ZLNMz8SsgR";

/** Pengaturan dari tabel app_settings (bisa diubah di Admin → Pengaturan). Fallback ke .env. */
// Disimpan di cache server 60 detik (tag "settings"); disegarkan langsung saat admin menyimpan Pengaturan.
const loadSettingRows = unstable_cache(
  async () => {
    const { data, error } = await createPublicClient().from("app_settings").select("key,value");
    if (error) throw new Error(error.message); // jangan simpan hasil gagal ke cache
    return (data ?? []) as { key: string; value: string }[];
  },
  ["app-settings"],
  { revalidate: 60, tags: ["settings"] },
);

export const getSettings = cache(async (): Promise<Settings> => {
  const rows = await loadSettingRows().catch(() => [] as { key: string; value: string }[]);
  const m = new Map(rows.map((r) => [r.key, r.value]));
  const num = (k: string, fb: number) => (m.has(k) && !isNaN(Number(m.get(k))) ? Number(m.get(k)) : fb);
  return {
    price_monthly: num("price_monthly", Number(process.env.PRICE_MONTHLY || 25000)),
    price_yearly: num("price_yearly", Number(process.env.PRICE_YEARLY || 250000)),
    free_unlock_limit_per_month: num("free_unlock_limit_per_month", 3),
    manual_payment_enabled: (m.get("manual_payment_enabled") ?? "true") === "true",
    whatsapp_number: m.get("whatsapp_number") || "6281339646353",
    qris_image_url: m.get("qris_image_url") || "/qris.png",
    qris_name: m.get("qris_name") || "DANA Bisnis",
    qris_merchant_name: m.get("qris_merchant_name") ?? "Sinar Sunrise",
    trial_days: num("trial_days", 7),
    sheet_url: m.get("sheet_url") || "",
    sheet_last_sync: m.get("sheet_last_sync") || "",
    featured_author: m.get("featured_author") ?? "",
    events_public: m.get("events_public") === "true",
    community_url: m.has("community_url") ? (m.get("community_url") ?? "") : DEFAULT_COMMUNITY_URL,
    free_mode: (m.get("free_mode") ?? "true") === "true",
  };
});

export const PLAN_META: Record<Plan, { label: string; months: number }> = {
  monthly: { label: "Bulanan", months: 1 },
  yearly: { label: "Tahunan", months: 12 },
};

export const planLabel = (p: string) => (p === "trial" ? "Trial gratis" : p === "yearly" ? "Tahunan" : "Bulanan");

export async function getPlans() {
  const s = await getSettings();
  const yearlySaving = s.price_monthly * 12 - s.price_yearly;
  return {
    monthly: { ...PLAN_META.monthly, price: s.price_monthly, note: "Bisa berhenti kapan saja" },
    yearly: {
      ...PLAN_META.yearly,
      price: s.price_yearly,
      note: yearlySaving > 0 ? `Hemat ${new Intl.NumberFormat("id-ID").format(yearlySaving)} rupiah dibanding bulanan` : "Bayar sekali setahun",
    },
  } satisfies Record<Plan, { label: string; months: number; price: number; note: string }>;
}

/** Normalisasi nomor WA ke format internasional tanpa + (0813… → 62813…). */
export function normalizeWa(n: string) {
  const d = n.replace(/\D/g, "");
  return d.startsWith("0") ? "62" + d.slice(1) : d;
}

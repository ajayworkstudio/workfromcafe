import { cache } from "react";
import { createClient } from "./supabase/server";
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
};

/** Pengaturan dari tabel app_settings (bisa diubah di Admin → Pengaturan). Fallback ke .env. */
export const getSettings = cache(async (): Promise<Settings> => {
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("key,value");
  const m = new Map((data ?? []).map((r) => [r.key, r.value]));
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
  };
});

export const PLAN_META: Record<Plan, { label: string; months: number }> = {
  monthly: { label: "Bulanan", months: 1 },
  yearly: { label: "Tahunan", months: 12 },
};

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

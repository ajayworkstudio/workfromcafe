// Monetisasi kafe: paket owner, saldo iklan, dan lelang slot Sponsored (migrasi 0025).

export type CafePlan = {
  id: number;
  name: string;
  monthly_price: number;
  can_bid: boolean;
  bonus_ad_credit: number;
  max_active_campaigns: number;
};

export type CafeSubscription = {
  id: string;
  cafe_id: string;
  plan_id: number;
  status: "pending" | "active" | "expired" | "cancelled";
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
};

export type AdTarget = {
  id: string;
  campaign_id: string;
  target_type: TargetType;
  target_value: string;
  max_bid: number;
  is_active: boolean;
};

export type AdCampaign = {
  id: string;
  cafe_id: string;
  name: string;
  status: "draft" | "active" | "paused" | "ended" | "out_of_budget";
  daily_budget: number;
  created_at: string;
  ad_targets: AdTarget[];
};

export type TargetType = "city" | "area" | "tag" | "keyword";

export const TARGET_LABEL: Record<TargetType, string> = {
  city: "Kota",
  area: "Area",
  tag: "Tag",
  keyword: "Kata kunci",
};

export const CAMPAIGN_STATUS: Record<AdCampaign["status"], string> = {
  draft: "Draf",
  active: "Berjalan",
  paused: "Dijeda",
  ended: "Selesai",
  out_of_budget: "Saldo habis",
};

/** Batas bawah tawaran per klik, sama dengan constraint ad_targets.max_bid. */
export const MIN_BID = 500;

/** Hari ini dalam zona Asia/Jakarta, format YYYY-MM-DD (dibandingkan dengan kolom date). */
export const todayWib = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

/** Langganan yang berlaku hari ini, kalau ada. */
export function activeSub(subs: CafeSubscription[]) {
  const today = todayWib();
  return subs.find((s) => s.status === "active" && s.starts_at && s.ends_at && s.starts_at <= today && today <= s.ends_at) ?? null;
}

/** Angka rupiah dari input bebas ("25.000", "Rp25000"). */
export const parseRupiah = (v: FormDataEntryValue | null) => Number(String(v ?? "").replace(/\D/g, "")) || 0;

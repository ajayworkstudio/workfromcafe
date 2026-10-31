"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MIN_BID, activeSub, parseRupiah, type CafePlan, type CafeSubscription, type TargetType } from "@/lib/ads";

// Semua aksi memakai sesi pengguna, jadi RLS migrasi 0025 yang menentukan boleh atau tidaknya.

const back = (cafeId: string | null, msg: string, err = false): never => {
  const q = new URLSearchParams({ [err ? "err" : "ok"]: msg });
  if (cafeId) q.set("kafe", cafeId);
  redirect(`/pemilik?${q}`);
};

async function session() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/masuk?next=/pemilik");
  return { supabase, user };
}

export async function claimCafe(f: FormData) {
  const { supabase, user } = await session();
  const cafeId = String(f.get("cafe_id") ?? "");
  if (!cafeId) back(null, "Pilih kafe yang mau kamu klaim.", true);
  const { error } = await supabase.from("cafe_owners").insert({ cafe_id: cafeId, user_id: user.id });
  if (error) back(null, /duplicate/.test(error.message) ? "Kamu sudah pernah mengajukan kafe ini." : `Gagal mengajukan: ${error.message}`, true);
  revalidatePath("/pemilik");
  back(null, "Pengajuan terkirim. Kirim bukti kepemilikan lewat WhatsApp supaya cepat diverifikasi.");
}

export async function requestPlan(f: FormData) {
  const { supabase } = await session();
  const cafeId = String(f.get("cafe_id") ?? "");
  const planId = Number(f.get("plan_id"));
  const { data: pending } = await supabase.from("cafe_subscriptions").select("id").eq("cafe_id", cafeId).eq("status", "pending").limit(1);
  if (pending?.length) back(cafeId, "Masih ada paket yang menunggu konfirmasi. Selesaikan pembayarannya dulu.", true);
  const { error } = await supabase.from("cafe_subscriptions").insert({ cafe_id: cafeId, plan_id: planId, status: "pending" });
  if (error) back(cafeId, `Gagal memilih paket: ${error.message}`, true);
  revalidatePath("/pemilik");
  back(cafeId, "Paket dipilih. Bayar lewat QRIS lalu konfirmasi di WhatsApp.");
}

export async function createCampaign(f: FormData) {
  const { supabase } = await session();
  const cafeId = String(f.get("cafe_id") ?? "");
  const name = String(f.get("name") ?? "").trim().slice(0, 60);
  const daily = parseRupiah(f.get("daily_budget"));
  if (!name) back(cafeId, "Beri nama kampanye, misalnya \"Promo jam kerja\".", true);
  if (daily < MIN_BID) back(cafeId, `Budget harian minimal Rp${MIN_BID.toLocaleString("id-ID")}.`, true);

  const [{ data: subs }, { data: plans }, { count }] = await Promise.all([
    supabase.from("cafe_subscriptions").select("*").eq("cafe_id", cafeId),
    supabase.from("cafe_plans").select("*"),
    supabase.from("ad_campaigns").select("id", { count: "exact", head: true }).eq("cafe_id", cafeId).eq("status", "active"),
  ]);
  const sub = activeSub((subs ?? []) as CafeSubscription[]);
  const plan = (plans as CafePlan[] | null)?.find((p) => p.id === sub?.plan_id);
  if (!plan?.can_bid) back(cafeId, "Paket kafe ini belum bisa ikut lelang. Pilih paket Starter ke atas.", true);
  if ((count ?? 0) >= plan!.max_active_campaigns) back(cafeId, `Paket ${plan!.name} maksimal ${plan!.max_active_campaigns} kampanye berjalan. Jeda salah satu dulu.`, true);

  const { error } = await supabase.from("ad_campaigns").insert({ cafe_id: cafeId, name, daily_budget: daily });
  if (error) back(cafeId, `Gagal membuat kampanye: ${error.message}`, true);
  revalidatePath("/pemilik");
  back(cafeId, `Kampanye "${name}" dibuat. Tambahkan target supaya bisa tampil.`);
}

export async function setCampaignStatus(f: FormData) {
  const { supabase } = await session();
  const cafeId = String(f.get("cafe_id") ?? "");
  const status = f.get("status") === "active" ? "active" : "paused";
  if (status === "active") {
    const [{ data: subs }, { data: plans }, { count }] = await Promise.all([
      supabase.from("cafe_subscriptions").select("*").eq("cafe_id", cafeId),
      supabase.from("cafe_plans").select("*"),
      supabase.from("ad_campaigns").select("id", { count: "exact", head: true }).eq("cafe_id", cafeId).eq("status", "active"),
    ]);
    const plan = (plans as CafePlan[] | null)?.find((p) => p.id === activeSub((subs ?? []) as CafeSubscription[])?.plan_id);
    if (!plan?.can_bid) back(cafeId, "Paket kafe ini belum aktif atau belum bisa ikut lelang.", true);
    if ((count ?? 0) >= plan!.max_active_campaigns) back(cafeId, `Paket ${plan!.name} maksimal ${plan!.max_active_campaigns} kampanye berjalan.`, true);
  }
  const { error } = await supabase.from("ad_campaigns").update({ status }).eq("id", String(f.get("id"))).eq("cafe_id", cafeId);
  if (error) back(cafeId, `Gagal mengubah status: ${error.message}`, true);
  revalidatePath("/pemilik");
  back(cafeId, status === "active" ? "Kampanye dijalankan lagi." : "Kampanye dijeda.");
}

export async function deleteCampaign(f: FormData) {
  const { supabase } = await session();
  const cafeId = String(f.get("cafe_id") ?? "");
  const { error } = await supabase.from("ad_campaigns").delete().eq("id", String(f.get("id"))).eq("cafe_id", cafeId);
  if (error) back(cafeId, `Gagal menghapus: ${error.message}`, true);
  revalidatePath("/pemilik");
  back(cafeId, "Kampanye dihapus.");
}

const TYPES: TargetType[] = ["city", "area", "tag", "keyword"];

export async function addTarget(f: FormData) {
  const { supabase } = await session();
  const cafeId = String(f.get("cafe_id") ?? "");
  const type = String(f.get("target_type")) as TargetType;
  const value = String(f.get("target_value") ?? "").trim().toLowerCase().slice(0, 60);
  const bid = parseRupiah(f.get("max_bid"));
  if (!TYPES.includes(type)) back(cafeId, "Jenis target tidak dikenal.", true);
  if (!value) back(cafeId, "Isi target, misalnya nama area atau kata kunci.", true);
  if (bid < MIN_BID) back(cafeId, `Tawaran per klik minimal Rp${MIN_BID.toLocaleString("id-ID")}.`, true);
  const { error } = await supabase.from("ad_targets").insert({
    campaign_id: String(f.get("campaign_id")), target_type: type, target_value: value, max_bid: bid,
  });
  if (error) back(cafeId, /duplicate/.test(error.message) ? "Target itu sudah ada di kampanye ini." : `Gagal menambah target: ${error.message}`, true);
  revalidatePath("/pemilik");
  back(cafeId, "Target ditambahkan.");
}

export async function updateBid(f: FormData) {
  const { supabase } = await session();
  const cafeId = String(f.get("cafe_id") ?? "");
  const bid = parseRupiah(f.get("max_bid"));
  if (bid < MIN_BID) back(cafeId, `Tawaran per klik minimal Rp${MIN_BID.toLocaleString("id-ID")}.`, true);
  const { error } = await supabase.from("ad_targets").update({ max_bid: bid }).eq("id", String(f.get("id")));
  if (error) back(cafeId, `Gagal menyimpan tawaran: ${error.message}`, true);
  revalidatePath("/pemilik");
  back(cafeId, "Tawaran disimpan.");
}

export async function deleteTarget(f: FormData) {
  const { supabase } = await session();
  const cafeId = String(f.get("cafe_id") ?? "");
  const { error } = await supabase.from("ad_targets").delete().eq("id", String(f.get("id")));
  if (error) back(cafeId, `Gagal menghapus target: ${error.message}`, true);
  revalidatePath("/pemilik");
  back(cafeId, "Target dihapus.");
}

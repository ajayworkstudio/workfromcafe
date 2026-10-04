"use server";
import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getPlans, getSettings } from "@/lib/settings";
import type { Plan } from "@/lib/types";

/** Buat (atau pakai ulang) tagihan bayar manual via QRIS, lalu buka halaman instruksinya. */
export async function createManualPayment(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/masuk?next=/harga");

  const plan = String(formData.get("plan")) as Plan;
  const [plans, settings] = await Promise.all([getPlans(), getSettings()]);
  if (settings.free_mode) redirect("/kafe");
  if (!plans[plan] || !settings.manual_payment_enabled) redirect("/harga");

  const admin = createAdminClient();
  // Pakai ulang tagihan yang masih menunggu (24 jam terakhir) supaya tidak menumpuk
  const since = new Date(Date.now() - 864e5).toISOString();
  const { data: existing } = await admin.from("payments").select("order_id")
    .eq("user_id", user!.id).eq("method", "manual").eq("status", "pending").eq("plan", plan).gt("created_at", since)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (existing) redirect(`/bayar/${existing.order_id}`);

  // Kode unik 3 digit supaya transfer gampang dicocokkan di mutasi
  const uniqueCode = 101 + Math.floor(Math.random() * 899);
  const orderId = `MAN-${Date.now().toString(36).toUpperCase()}-${uniqueCode}`;
  const { error } = await admin.from("payments").insert({
    user_id: user!.id, order_id: orderId, plan, method: "manual",
    amount: plans[plan].price + uniqueCode, status: "pending",
  });
  if (error) redirect(`/harga?err=${encodeURIComponent("Gagal membuat tagihan. Coba lagi.")}`);
  redirect(`/bayar/${orderId}`);
}

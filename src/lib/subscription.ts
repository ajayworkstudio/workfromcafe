import type { SupabaseClient } from "@supabase/supabase-js";
import { PLAN_META } from "./settings";
import type { Plan } from "./types";

type PaymentRow = { id: string; user_id: string; plan: string; amount: number; order_id: string };

/**
 * Tandai pembayaran lunas lalu aktifkan/perpanjang langganan.
 * Dipakai webhook Midtrans dan tombol "Setujui" pembayaran manual. Harus dipanggil dengan client service role.
 */
export async function activateFromPayment(admin: SupabaseClient, payment: PaymentRow, rawPayload?: unknown) {
  await admin.from("payments").update({ status: "paid", ...(rawPayload ? { raw_payload: rawPayload } : {}) }).eq("id", payment.id);

  // Perpanjang dari tanggal akhir langganan aktif (kalau ada), selain itu mulai sekarang.
  const { data: current } = await admin
    .from("subscriptions")
    .select("end_date")
    .eq("user_id", payment.user_id)
    .eq("status", "active")
    .gt("end_date", new Date().toISOString())
    .order("end_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const start = current ? new Date(current.end_date) : new Date();
  const end = new Date(start);
  end.setMonth(end.getMonth() + PLAN_META[payment.plan as Plan].months);

  await admin.from("subscriptions").insert({
    user_id: payment.user_id,
    plan: payment.plan,
    status: "active",
    start_date: start.toISOString(),
    end_date: end.toISOString(),
    midtrans_order_id: payment.order_id,
    amount: payment.amount,
  });
  return end;
}

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifySignature } from "@/lib/midtrans";
import { PLANS } from "@/lib/utils";
import type { Plan } from "@/lib/types";

type Notif = {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status: string;
  fraud_status?: string;
};

/**
 * Webhook Midtrans. Atur URL ini di Dashboard Midtrans →
 * Settings → Payment → Notification URL: https://domainkamu.com/api/midtrans/notification
 */
export async function POST(req: Request) {
  const n = (await req.json()) as Notif;
  if (!verifySignature(n)) return NextResponse.json({ error: "invalid signature" }, { status: 403 });

  const admin = createAdminClient();
  const { data: payment } = await admin.from("payments").select("*").eq("order_id", n.order_id).maybeSingle();
  if (!payment) return NextResponse.json({ ok: true, note: "unknown order" });

  // Pastikan nominal cocok dengan yang dicatat server
  if (Math.round(Number(n.gross_amount)) !== payment.amount) {
    await admin.from("payments").update({ status: "failed", raw_payload: n }).eq("id", payment.id);
    return NextResponse.json({ error: "amount mismatch" }, { status: 400 });
  }

  const s = n.transaction_status;
  const paid = (s === "capture" && n.fraud_status === "accept") || s === "settlement";
  const failed = ["deny", "cancel", "expire", "failure"].includes(s);

  if (paid) {
    if (payment.status === "paid") return NextResponse.json({ ok: true }); // idempoten
    await admin.from("payments").update({ status: "paid", raw_payload: n }).eq("id", payment.id);

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
    end.setMonth(end.getMonth() + PLANS[payment.plan as Plan].months);

    await admin.from("subscriptions").insert({
      user_id: payment.user_id,
      plan: payment.plan,
      status: "active",
      start_date: start.toISOString(),
      end_date: end.toISOString(),
      midtrans_order_id: n.order_id,
      amount: payment.amount,
    });
  } else if (failed) {
    await admin.from("payments").update({ status: s === "expire" ? "expired" : "failed", raw_payload: n }).eq("id", payment.id);
  } else {
    await admin.from("payments").update({ raw_payload: n }).eq("id", payment.id);
  }

  return NextResponse.json({ ok: true });
}

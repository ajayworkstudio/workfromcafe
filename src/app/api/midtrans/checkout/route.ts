import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { createSnapTransaction } from "@/lib/midtrans";
import { APP_NAME, SITE_URL } from "@/lib/utils";
import { getPlans } from "@/lib/settings";
import type { Plan } from "@/lib/types";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Silakan masuk dulu" }, { status: 401 });

  const { plan } = (await req.json()) as { plan: Plan };
  const plans = await getPlans();
  const p = plans[plan as keyof typeof plans];
  if (!p) return NextResponse.json({ error: "Paket tidak dikenal" }, { status: 400 });

  // Harga SELALU diambil dari server, bukan dari browser.
  const orderId = `SUB-${plan === "monthly" ? "M" : "Y"}-${Date.now()}-${user.id.slice(0, 8)}`;
  const admin = createAdminClient();
  const { error } = await admin.from("payments").insert({ user_id: user.id, order_id: orderId, plan, amount: p.price, status: "pending" });
  if (error) return NextResponse.json({ error: "Gagal mencatat pembayaran" }, { status: 500 });

  try {
    const { data: profile } = await admin.from("profiles").select("name").eq("id", user.id).maybeSingle();
    const trx = await createSnapTransaction({
      transaction_details: { order_id: orderId, gross_amount: p.price },
      item_details: [{ id: plan, price: p.price, quantity: 1, name: `${APP_NAME} ${p.label}`.slice(0, 50) }],
      customer_details: { first_name: profile?.name ?? "Pelanggan", email: user.email },
      callbacks: { finish: `${SITE_URL}/akun?bayar=selesai` },
      expiry: { unit: "hours", duration: 24 },
    });
    return NextResponse.json(trx);
  } catch (e) {
    await admin.from("payments").update({ status: "failed" }).eq("order_id", orderId);
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

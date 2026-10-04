import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { APP_NAME, SITE_URL } from "@/lib/utils";
import { syncFromUrlAndRecord } from "@/lib/sheetSync";

export const maxDuration = 60;

/**
 * Dijalankan harian oleh Vercel Cron (lihat vercel.json):
 * 1. Tandai langganan yang sudah lewat sebagai 'expired'
 * 2. Kirim email pengingat H-3 (jika RESEND_API_KEY diisi)
 * 3. Sinkron kafe dari Google Sheets (jika link diisi di Admin → Spreadsheet)
 */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  const now = new Date();

  const { count: expired } = await admin
    .from("subscriptions")
    .update({ status: "expired" }, { count: "exact" })
    .eq("status", "active")
    .lt("end_date", now.toISOString());

  // Mode gratis: tidak perlu mengirim pengingat perpanjangan
  const { data: freeRow } = await admin.from("app_settings").select("value").eq("key", "free_mode").maybeSingle();
  const freeMode = (freeRow?.value ?? "true") === "true";

  const in3 = new Date(now.getTime() + 3 * 864e5);
  const in4 = new Date(now.getTime() + 4 * 864e5);
  const { data: soon } = await admin
    .from("subscriptions")
    .select("id, user_id, end_date")
    .eq("status", "active")
    .eq("reminder_sent", false)
    .gte("end_date", in3.toISOString())
    .lt("end_date", in4.toISOString());

  let sent = 0;
  for (const sub of freeMode ? [] : soon ?? []) {
    // Lewati jika pengguna sudah memperpanjang (ada langganan lain yang berakhir lebih lama)
    const { count } = await admin.from("subscriptions").select("id", { count: "exact", head: true })
      .eq("user_id", sub.user_id).eq("status", "active").gt("end_date", sub.end_date);
    if (count) { await admin.from("subscriptions").update({ reminder_sent: true }).eq("id", sub.id); continue; }

    const { data: profile } = await admin.from("profiles").select("email,name").eq("id", sub.user_id).maybeSingle();
    if (profile?.email && process.env.RESEND_API_KEY) {
      const tgl = new Date(sub.end_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM,
          to: profile.email,
          subject: `Langganan ${APP_NAME} berakhir ${tgl}`,
          html: `<p>Halo ${profile.name ?? ""},</p><p>Langganan premium kamu akan berakhir pada <b>${tgl}</b>.</p><p><a href="${SITE_URL}/harga">Perpanjang sekarang</a> supaya tetap bisa melihat ulasan dan menu rekomendasi.</p>`,
        }),
      });
      if (res.ok) sent++;
    }
    await admin.from("subscriptions").update({ reminder_sent: true }).eq("id", sub.id);
  }

  // Sinkron spreadsheet harian (kalau link sudah disimpan di Admin → Spreadsheet)
  const { data: sheet } = await admin.from("app_settings").select("value").eq("key", "sheet_url").maybeSingle();
  const sync = sheet?.value ? await syncFromUrlAndRecord(admin, sheet.value, "cron") : null;

  return NextResponse.json({ expired: expired ?? 0, reminders: sent, sheetSync: sync ? (sync.ok ? "ok" : sync.error) : "skip" });
}

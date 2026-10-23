"use server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { pushTest } from "@/lib/notify";

type Result = { ok: true; sent?: number } | { ok: false; error: string };

async function me() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

const SETUP = "Fitur notifikasi belum aktif di database. Admin perlu menjalankan migrasi 0021.";

/** Simpan langganan push perangkat ini atas nama pengguna yang login. */
export async function savePushSubscription(sub: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }, userAgent: string): Promise<Result> {
  const user = await me();
  if (!user) return { ok: false, error: "Masuk dulu untuk menyalakan notifikasi." };
  const endpoint = String(sub?.endpoint ?? "");
  if (!/^https:\/\//.test(endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) return { ok: false, error: "Data langganan dari browser tidak lengkap. Coba lagi." };
  const { error } = await createAdminClient().from("push_subscriptions").upsert({
    endpoint, user_id: user.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth, user_agent: userAgent.slice(0, 200),
  });
  if (error) return { ok: false, error: /push_subscriptions/.test(error.message) ? SETUP : error.message };
  return { ok: true };
}

/** Matikan push di perangkat ini. */
export async function removePushSubscription(endpoint: string): Promise<Result> {
  const user = await me();
  if (!user) return { ok: false, error: "Sesi habis. Masuk lagi." };
  await createAdminClient().from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", user.id);
  return { ok: true };
}

/** Pilih jenis notifikasi yang mau diterima. */
export async function setNotifyPrefs(prefs: { newCafe: boolean; activity: boolean }): Promise<Result> {
  const user = await me();
  if (!user) return { ok: false, error: "Sesi habis. Masuk lagi." };
  const { error } = await createAdminClient().from("profiles")
    .update({ notify_new_cafe: !!prefs.newCafe, notify_activity: !!prefs.activity }).eq("id", user.id);
  if (error) return { ok: false, error: /notify_/.test(error.message) ? SETUP : error.message };
  return { ok: true };
}

export async function sendTestPush(): Promise<Result> {
  const user = await me();
  if (!user) return { ok: false, error: "Sesi habis. Masuk lagi." };
  const sent = await pushTest(user.id);
  return sent ? { ok: true, sent } : { ok: false, error: "Belum ada perangkat yang terhubung, atau server belum diatur untuk push." };
}

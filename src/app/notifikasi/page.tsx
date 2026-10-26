import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import NotificationSettings from "@/components/NotificationSettings";
import NotificationList, { type NotifRow } from "@/components/NotificationList";

export const metadata: Metadata = { title: "Notifikasi", robots: { index: false, follow: false } };


export default async function NotificationsPage() {
  const viewer = await getViewer();
  if (!viewer.user) redirect("/masuk?next=/notifikasi");
  const supabase = await createClient();
  const [{ data, error }, { data: prof }, { data: dism }] = await Promise.all([
    supabase.from("notifications").select("id,kind,title,body,url,created_at").order("created_at", { ascending: false }).limit(80),
    supabase.from("profiles").select("*").eq("id", viewer.user.id).maybeSingle(),
    supabase.from("notification_dismissals").select("notification_id"), // kosong kalau migrasi 0022 belum dijalankan
  ]);
  // Sembunyikan yang sudah dihapus pengguna: satu per satu (dismissals) atau semua sebelum "Hapus semua"
  const hidden = new Set(((dism as { notification_id: string }[] | null) ?? []).map((d) => d.notification_id));
  const clearedAt = prof?.notif_cleared_at ? +new Date(prof.notif_cleared_at) : 0;
  const rows = ((data as NotifRow[] | null) ?? []).filter((n) => !hidden.has(n.id) && +new Date(n.created_at) > clearedAt).slice(0, 40);
  const seenAt = prof?.notif_seen_at ? +new Date(prof.notif_seen_at) : Date.now();
  const userId = viewer.user.id;
  // Dibuka = sudah dilihat: titik di lonceng hilang di halaman berikutnya
  if (!error && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    after(async () => { await createAdminClient().from("profiles").update({ notif_seen_at: new Date().toISOString() }).eq("id", userId); });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-4xl font-extrabold">Notifikasi</h1>

      <div className="mt-6">
        <NotificationSettings compact prefs={{ newCafe: prof?.notify_new_cafe ?? true, activity: prof?.notify_activity ?? true }} />
        <Link href="/akun#notifikasi" className="mt-2 inline-block text-sm font-semibold text-brand hover:underline">Atur jenis notifikasi →</Link>
      </div>

      {error
        ? <p className="mt-8 rounded-2xl border border-dashed border-line p-6 text-muted">Notifikasi belum aktif. Admin perlu menjalankan migrasi 0021.</p>
        : <NotificationList rows={rows} seenAt={seenAt} />}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import Icon from "@/components/Icon";
import NotificationSettings from "@/components/NotificationSettings";
import { reportAgo } from "@/lib/reports";

export const metadata: Metadata = { title: "Notifikasi", robots: { index: false, follow: false } };

type Row = { id: string; kind: "new_cafe" | "activity"; title: string; body: string | null; url: string | null; created_at: string };

export default async function NotificationsPage() {
  const viewer = await getViewer();
  if (!viewer.user) redirect("/masuk?next=/notifikasi");
  const supabase = await createClient();
  const [{ data, error }, { data: prof }] = await Promise.all([
    supabase.from("notifications").select("id,kind,title,body,url,created_at").order("created_at", { ascending: false }).limit(40),
    supabase.from("profiles").select("notify_new_cafe,notify_activity,notif_seen_at").eq("id", viewer.user.id).maybeSingle(),
  ]);
  const rows = (data as Row[] | null) ?? [];
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

      {error ? (
        <p className="mt-8 rounded-2xl border border-dashed border-line p-6 text-muted">Notifikasi belum aktif. Admin perlu menjalankan migrasi 0021.</p>
      ) : !rows.length ? (
        <p className="mt-8 rounded-2xl border border-dashed border-line p-6 text-center text-muted">
          Belum ada notifikasi. Simpan kafe favoritmu supaya dapat kabar saat ada yang melapor kondisinya.
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {rows.map((n) => {
            const unread = +new Date(n.created_at) > seenAt;
            const inner = (
              <>
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${n.kind === "new_cafe" ? "bg-gold/20 text-[#8a5a00]" : "bg-[#eef6f1] text-[#2f7049]"}`}>
                  <Icon name={n.kind === "new_cafe" ? "sparkle" : "users"} className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{n.title}</span>
                  {n.body && <span className="block text-sm text-muted">{n.body}</span>}
                  <span className="mt-0.5 block text-xs text-muted">{reportAgo(n.created_at)}</span>
                </span>
                {unread && <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[#b4533a]" aria-label="Baru" />}
              </>
            );
            return (
              <li key={n.id}>
                {n.url
                  ? <Link href={n.url} className={`flex gap-3 p-4 transition-colors hover:bg-tint ${unread ? "bg-brand-soft/40" : ""}`}>{inner}</Link>
                  : <div className="flex gap-3 p-4">{inner}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

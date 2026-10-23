import webpush from "web-push";
import { createAdminClient } from "./supabase/server";

/*
  Notifikasi WFC Hunters: disimpan di tabel notifications (tampil di lonceng & halaman /notifikasi)
  dan dikirim sebagai push ke perangkat yang sudah mengizinkan (browser atau aplikasi di layar utama).
  Semua di sini berjalan dengan service role, dipanggil setelah respons terkirim (after), dan tidak pernah
  menggagalkan aksi utama: kalau migrasi 0021 atau kunci VAPID belum ada, cukup dilewati.
*/

type Push = { title: string; body: string; url: string; tag: string };

const vapidReady = () => !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
let configured = false;
function configure() {
  if (configured || !vapidReady()) return vapidReady();
  webpush.setVapidDetails(`mailto:${process.env.VAPID_CONTACT || "admin@wfchunters.com"}`, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  configured = true;
  return true;
}

/** Kirim push ke semua perangkat milik userIds. Langganan yang sudah tidak berlaku (404/410) dihapus. */
async function pushTo(db: ReturnType<typeof createAdminClient>, userIds: string[], msg: Push) {
  if (!userIds.length || !configure()) return 0;
  let sent = 0;
  for (let i = 0; i < userIds.length; i += 200) {
    const { data: subs } = await db.from("push_subscriptions").select("endpoint,p256dh,auth").in("user_id", userIds.slice(i, i + 200));
    const dead: string[] = [];
    await Promise.all((subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg), { TTL: 60 * 60 * 6, urgency: "normal" });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.push(s.endpoint);
        else console.error("[push]", code, (e as Error).message);
      }
    }));
    if (dead.length) await db.from("push_subscriptions").delete().in("endpoint", dead);
  }
  return sent;
}

/**
 * Umumkan kafe yang sudah tayang tapi belum diumumkan: satu notifikasi untuk semua pengguna terdaftar,
 * plus push ke yang menyalakan "Kafe baru". Aman dipanggil berkali-kali (kafe diklaim dulu lewat announced_at).
 */
export async function announceNewCafes(limit = 5) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    const db = createAdminClient();
    const { data: cafes, error } = await db.from("cafes")
      .select("id,slug,name,area,city:cities(name)").eq("is_published", true).is("announced_at", null)
      .order("created_at").limit(limit);
    if (error || !cafes?.length) return; // mis. migrasi 0021 belum dijalankan

    for (const c of cafes as unknown as { id: string; slug: string; name: string; area: string | null; city: { name: string } | null }[]) {
      // Klaim: hanya satu proses yang berhasil menandai, jadi tidak ada pengumuman ganda
      const { data: claimed } = await db.from("cafes").update({ announced_at: new Date().toISOString() })
        .eq("id", c.id).is("announced_at", null).select("id");
      if (!claimed?.length) continue;

      const where = [c.area, c.city?.name].filter(Boolean).join(", ");
      const msg: Push = { title: "Kafe baru di WFC Hunters", body: `${c.name}${where ? ` · ${where}` : ""}`, url: `/kafe/${c.slug}`, tag: `cafe-${c.id}` };
      await db.from("notifications").insert({ kind: "new_cafe", title: msg.title, body: msg.body, url: msg.url, cafe_id: c.id });

      const { data: users } = await db.from("profiles").select("id").eq("notify_new_cafe", true);
      await pushTo(db, (users ?? []).map((u) => u.id), msg);
    }
  } catch (e) {
    console.error("[announceNewCafes]", e);
  }
}

/**
 * Ada laporan kondisi baru di sebuah kafe: kabari pengguna yang menyimpan kafe itu (kecuali pelapornya).
 * Paling sering sekali per kafe tiap 3 jam supaya tidak berisik.
 */
export async function notifyCafeActivity(cafeId: string, reporterId: string, summary: string) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    const db = createAdminClient();
    const since = new Date(Date.now() - 3 * 36e5).toISOString();
    const { count, error } = await db.from("notifications").select("id", { count: "exact", head: true })
      .eq("cafe_id", cafeId).eq("kind", "activity").gt("created_at", since);
    if (error || (count ?? 0) > 0) return;

    const [{ data: cafe }, { data: favs }] = await Promise.all([
      db.from("cafes").select("slug,name,is_published").eq("id", cafeId).maybeSingle(),
      db.from("favorites").select("user_id").eq("cafe_id", cafeId).neq("user_id", reporterId),
    ]);
    if (!cafe?.is_published || !favs?.length) return;
    const favIds = favs.map((f) => f.user_id as string);

    const msg: Push = { title: `Lagi di ${cafe.name}`, body: summary, url: `/kafe/${cafe.slug}#kondisi`, tag: `activity-${cafeId}` };
    await db.from("notifications").insert(favIds.map((user_id) => ({ user_id, kind: "activity", title: msg.title, body: msg.body, url: msg.url, cafe_id: cafeId })));

    const { data: wants } = await db.from("profiles").select("id").in("id", favIds).eq("notify_activity", true);
    await pushTo(db, (wants ?? []).map((u) => u.id), msg);
  } catch (e) {
    console.error("[notifyCafeActivity]", e);
  }
}

/** Push uji coba ke perangkat milik satu pengguna (tombol "Kirim notifikasi uji" di halaman Akun). */
export async function pushTest(userId: string) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return 0;
  return pushTo(createAdminClient(), [userId], { title: "Notifikasi WFC Hunters aktif", body: "Kamu akan dikabari kafe baru dan kondisi terbaru di kafe favoritmu.", url: "/notifikasi", tag: "test" });
}

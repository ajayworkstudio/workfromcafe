"use server";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { mailConfigured, sendMail } from "@/lib/mail";
import { CONTACT_TOPICS, type ContactState } from "@/lib/contact";
import { SITE_URL } from "@/lib/utils";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function sendContact(_prev: ContactState, f: FormData): Promise<ContactState> {
  // Kolom jebakan: manusia tidak melihatnya, bot biasanya mengisinya.
  if (String(f.get("website") ?? "")) return { ok: true, name: "" };

  const name = String(f.get("name") ?? "").trim().slice(0, 80);
  const email = String(f.get("email") ?? "").trim().toLowerCase().slice(0, 160);
  const body = String(f.get("body") ?? "").trim().slice(0, 2000);
  const topic = CONTACT_TOPICS.find((t) => t.value === f.get("topic"))?.value;
  const page = String(f.get("page") ?? "").slice(0, 200) || null;

  if (!topic) return { ok: false, error: "Pilih dulu topik pesanmu.", field: "topic" };
  if (name.length < 2) return { ok: false, error: "Tulis namamu (minimal 2 huruf).", field: "name" };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Alamat email belum benar. Balasan akan dikirim ke sini.", field: "email" };
  if (body.length < 10) return { ok: false, error: "Pesannya terlalu pendek. Ceritakan sedikit lebih banyak (minimal 10 huruf).", field: "body" };

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    return { ok: false, error: "Kotak pesan belum bisa dipakai saat ini. Coba hubungi lewat Instagram @wfchunters dulu ya." };

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  const ipHash = createHash("sha256").update(`${ip}|${process.env.SUPABASE_SERVICE_ROLE_KEY.slice(-12)}`).digest("hex").slice(0, 32);

  const db = createAdminClient();
  const since = new Date(Date.now() - 36e5).toISOString();
  const { count, error: countErr } = await db.from("contact_messages")
    .select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gt("created_at", since);
  if (countErr) {
    console.error("[sendContact]", countErr.message);
    return /contact_messages/.test(countErr.message)
      ? { ok: false, error: "Kotak pesan belum aktif (admin perlu menjalankan migrasi 0015). Sementara, hubungi lewat Instagram @wfchunters." }
      : { ok: false, error: "Pesan gagal terkirim karena gangguan server. Coba lagi sebentar lagi." };
  }
  if ((count ?? 0) >= 5) return { ok: false, error: "Kamu sudah mengirim 5 pesan dalam satu jam terakhir. Coba lagi nanti ya." };

  const viewer = await getViewer();
  const { error } = await db.from("contact_messages").insert({
    topic, name, email, body, page, ip_hash: ipHash, user_id: viewer.user?.id ?? null,
  });
  if (error) {
    console.error("[sendContact]", error.message);
    return { ok: false, error: "Pesan gagal terkirim karena gangguan server. Coba lagi sebentar lagi." };
  }

  // Kabari admin lewat email kalau email sudah dikonfigurasi. Gagal kirim email tidak menggagalkan pesan.
  if (mailConfigured()) {
    try {
      const { data: admins } = await db.from("profiles").select("email").eq("role", "admin");
      const to = (admins ?? []).map((a) => a.email).filter(Boolean).join(",");
      const topicLabel = CONTACT_TOPICS.find((t) => t.value === topic)!.label;
      if (to) await sendMail({
        to,
        replyTo: email,
        subject: `Pesan baru: ${topicLabel} (dari ${name})`,
        text: `${name} <${email}>\nTopik: ${topicLabel}\nHalaman: ${page ?? "-"}\n\n${body}\n\nBalas langsung ke email ini atau buka ${SITE_URL}/admin/pesan`,
        html: `<p><b>${esc(name)}</b> &lt;${esc(email)}&gt;<br>Topik: ${esc(topicLabel)}<br>Halaman: ${esc(page ?? "-")}</p><p style="white-space:pre-wrap">${esc(body)}</p><p><a href="${SITE_URL}/admin/pesan">Buka semua pesan di admin</a></p>`,
      });
    } catch (e) {
      console.error("[sendContact mail]", e);
    }
  }

  revalidatePath("/admin/pesan");
  return { ok: true, name: name.split(" ")[0] };
}

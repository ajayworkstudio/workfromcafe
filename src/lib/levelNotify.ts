import { createAdminClient } from "./supabase/server";
import { LEVELS, autoUsername } from "./author";
import { mailConfigured, sendMail } from "./mail";
import { SITE_URL } from "./utils";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * Cek level author setelah kafenya berubah (tayang/batal tayang).
 * Kalau naik ke level yang belum pernah dikabari → kirim email ke alamat terdaftar.
 * Tidak pernah melempar error (email gagal tidak boleh menggagalkan simpan kafe).
 */
export async function notifyAuthorLevel(contributorId: string | null | undefined): Promise<string | null> {
  if (!contributorId) return null; // kafe tanpa author
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return "Email author tidak dikirim: SUPABASE_SERVICE_ROLE_KEY belum diisi di Vercel.";
  try {
    const db = createAdminClient();
    const [{ count }, { data: prof, error }] = await Promise.all([
      db.from("cafes").select("id", { count: "exact", head: true }).eq("contributor_id", contributorId).eq("is_published", true),
      db.from("profiles").select("email,name,username,notified_level").eq("id", contributorId).maybeSingle(),
    ]);
    if (error) return /notified_level/.test(error.message)
      ? "Email author tidak dikirim: migrasi 0014_notifikasi_level.sql belum dijalankan."
      : `Email author tidak dikirim: ${error.message}`;
    if (!prof?.email) return "Email author tidak dikirim: author ini tidak punya alamat email di profil.";
    const n = count ?? 0;
    const levelIdx = LEVELS.reduce((i, l, j) => (n >= l.min ? j + 1 : i), 0); // 0 = belum ada level
    if (levelIdx <= (prof.notified_level ?? 0))
      return levelIdx ? `(Author: ${n} kafe tayang, email level ${LEVELS[levelIdx - 1].name} sudah pernah dikirim.)` : null;
    if (!mailConfigured()) return "Email author tidak dikirim: SMTP_USER / SMTP_PASS belum diisi di Vercel (lalu Redeploy).";

    const username = prof.username || autoUsername(prof.name, contributorId);
    if (!prof.username) await db.from("profiles").update({ username }).eq("id", contributorId);

    const level = LEVELS[levelIdx - 1];
    const profileUrl = `${SITE_URL}/author/${username}`;
    const first = (prof.name || "").split(" ")[0] || "kamu";
    const withCard = n >= 5;
    const subject = levelIdx === 1
      ? "Rekomendasi kafemu sudah tayang di WFC Hunters ☕"
      : `Selamat ${first}, kamu resmi jadi ${level.name} WFC Hunters! 🎉`;
    const intro = levelIdx === 1
      ? `Kafe yang kamu rekomendasikan sudah tayang dan namamu tampil sebagai author. Kamu sekarang berlevel <b>${level.name}</b>.`
      : `${n} kafe rekomendasimu sudah tayang. Kamu resmi naik level jadi <b>${level.name}</b>!`;
    const next = LEVELS[levelIdx];
    const nextLine = next ? `<p style="margin:16px 0 0;color:#6f625a;font-size:14px">Tinggal ${next.min - n} kafe lagi menuju <b>${next.name}</b>.</p>` : "";
    const html = `<!doctype html><html><body style="margin:0;background:#f6f2ee;font-family:Arial,Helvetica,sans-serif;color:#1f1612">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
  <div style="text-align:center;padding:12px 0 20px"><img src="${SITE_URL}/logo.png" alt="WFC Hunters" width="110" style="display:inline-block"></div>
  <div style="background:#ffffff;border-radius:20px;padding:28px">
    <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25">${esc(subject.replace(/ [☕🎉]$/, ""))}</h1>
    <p style="margin:0;font-size:16px;line-height:1.6">Halo ${esc(first)},</p>
    <p style="margin:12px 0 0;font-size:16px;line-height:1.6">${intro}</p>
    ${withCard ? `<p style="margin:16px 0 0;font-size:16px;line-height:1.6">Kami sudah siapkan <b>kartu ${level.name}</b> khusus untukmu. Bagikan ke Instagram Story atau feed, link profilmu sudah ada di kartunya.</p>
    <div style="text-align:center;margin:22px 0 4px"><img src="${profileUrl}/kartu?f=post" alt="Kartu ${level.name}" width="300" style="display:inline-block;border-radius:14px;max-width:100%"></div>` : ""}
    <div style="text-align:center;margin:24px 0 8px">
      <a href="${profileUrl}${withCard ? "#kartu" : ""}" style="display:inline-block;background:#6b4226;color:#ffffff;text-decoration:none;font-weight:bold;padding:13px 26px;border-radius:999px">${withCard ? "Bagikan kartu saya" : "Lihat profil author saya"}</a>
    </div>
    ${nextLine}
  </div>
  <p style="text-align:center;margin:18px 0 0;font-size:12px;color:#6f625a">Kamu menerima email ini karena terdaftar sebagai author di <a href="${SITE_URL}" style="color:#6b4226">WFC Hunters</a>.</p>
</div></body></html>`;
    const text = `${subject}\n\nHalo ${first}, ${intro.replace(/<[^>]+>/g, "")}\n\n${withCard ? "Bagikan kartumu: " : "Profilmu: "}${profileUrl}${withCard ? "#kartu" : ""}`;

    await sendMail({ to: prof.email, subject, html, text });
    await db.from("profiles").update({ notified_level: levelIdx }).eq("id", contributorId);
    return `Email "${level.name}" terkirim ke ${prof.email}.`;
  } catch (e) {
    console.error("[notifyAuthorLevel]", e);
    const msg = e instanceof Error ? e.message : String(e);
    return /535|Invalid login|BadCredentials|Username and Password/i.test(msg)
      ? "Email author gagal: Gmail menolak login. Cek SMTP_USER dan App Password di SMTP_PASS."
      : `Email author gagal: ${msg.slice(0, 160)}`;
  }
}

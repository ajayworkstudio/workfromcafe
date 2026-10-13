import { revalidatePath, revalidateTag } from "next/cache";
import { createAdminClient } from "./supabase/server";
import { getSettings } from "./settings";
import { AUTO_NOTE, evaluateSubmission, loadReviewContext } from "./autoReview";
import { createCafeFromSubmission } from "./submissionPublish";
import { notifyAuthorLevel } from "./levelNotify";
import { mailConfigured, sendMail } from "./mail";
import { SITE_URL } from "./utils";
import type { Submission } from "./submission";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export type AutoResult = { status: "off" } | { status: "manual" } | { status: "published"; slug: string };

/**
 * Dipanggil setelah author mengirim rekomendasi. Kalau setelan aktif dan semua cek wajib lolos,
 * kafe langsung tayang. Apa pun yang gagal di sini tidak menggagalkan kiriman: kiriman tetap menunggu review.
 */
export async function tryAutoApprove(submissionId: string): Promise<AutoResult> {
  try {
    const settings = await getSettings();
    if (!settings.auto_approve || !process.env.SUPABASE_SERVICE_ROLE_KEY) return { status: "off" };
    const db = createAdminClient();
    const { data } = await db.from("cafe_submissions").select("*").eq("id", submissionId).maybeSingle();
    const sub = data as Submission | null;
    if (!sub || sub.status !== "pending") return { status: "manual" };

    const ctx = await loadReviewContext(db);
    const ev = evaluateSubmission(sub, ctx, { trustNewAuthors: settings.auto_trust_new, dailyLimit: settings.auto_daily_limit });
    if (!ev.pass) return { status: "manual" };

    const res = await createCafeFromSubmission(db, sub, { publish: true, note: AUTO_NOTE });
    if ("error" in res) {
      console.error("[autoApprove]", res.error);
      return { status: "manual" };
    }

    await notifyAuthorLevel(sub.user_id);
    revalidateTag("authors");
    revalidatePath("/", "layout");

    // Kabari admin: kafe apa yang tayang otomatis, dan link untuk membatalkan
    if (mailConfigured()) {
      try {
        const { data: admins } = await db.from("profiles").select("email").eq("role", "admin");
        const to = (admins ?? []).map((a) => a.email).filter(Boolean).join(",");
        const cafeUrl = `${SITE_URL}/kafe/${res.slug}`;
        const editUrl = `${SITE_URL}/admin/kafe/${res.cafeId}`;
        const lines = ev.checks.filter((c) => c.hard).map((c) => `<li>${esc(c.label)}: ${esc(c.detail)}</li>`).join("");
        if (to) await sendMail({
          to,
          subject: `Tayang otomatis: ${sub.data.name} (dari ${sub.author_name})`,
          text: `${sub.data.name} dari ${sub.author_name} lolos semua cek dan sudah tayang: ${cafeUrl}\nKalau ada yang keliru, buka ${editUrl} lalu matikan Tayang.`,
          html: `<p><b>${esc(sub.data.name)}</b> dari ${esc(sub.author_name)} lolos semua cek (skor ${ev.score}) dan sudah tayang.</p>
<ul>${lines}</ul>
<p><a href="${cafeUrl}">Lihat halaman kafe</a> · <a href="${editUrl}">Edit atau batalkan tayang</a></p>`,
        });
      } catch (e) {
        console.error("[autoApprove mail]", e);
      }
    }
    return { status: "published", slug: res.slug };
  } catch (e) {
    console.error("[autoApprove]", e);
    return { status: "manual" };
  }
}

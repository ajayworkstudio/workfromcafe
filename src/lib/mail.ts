import nodemailer from "nodemailer";

/*
  Kirim email dari server. Pilih salah satu (isi di Vercel → Environment Variables):
  - SMTP (mis. Gmail + App Password): SMTP_USER, SMTP_PASS, opsional SMTP_HOST (default smtp.gmail.com), SMTP_PORT (465)
  - Resend: RESEND_API_KEY (+ domain terverifikasi)
  EMAIL_FROM opsional, contoh: "WFC Hunters <halo@wfchunters.com>"
*/
export function mailConfigured() {
  return !!(process.env.RESEND_API_KEY || (process.env.SMTP_USER && process.env.SMTP_PASS));
}

export async function sendMail({ to, subject, html, text, replyTo }: { to: string; subject: string; html: string; text?: string; replyTo?: string }) {
  const from = process.env.EMAIL_FROM || `WFC Hunters <${process.env.SMTP_USER ?? "noreply@wfchunters.com"}>`;
  if (process.env.RESEND_API_KEY) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: to.split(","), subject, html, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
    });
    if (!res.ok) throw new Error(`Resend: ${res.status} ${await res.text()}`);
    return;
  }
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    const port = Number(process.env.SMTP_PORT || 465);
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER.trim(), pass: process.env.SMTP_PASS.replace(/\s+/g, "") }, // App Password sering tersalin dengan spasi
    });
    await transport.sendMail({ from, to, subject, html, text, replyTo });
    return;
  }
  throw new Error("Email belum dikonfigurasi (SMTP_USER/SMTP_PASS atau RESEND_API_KEY).");
}

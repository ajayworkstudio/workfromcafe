/*
  Deteksi spam untuk kotak kontak. Pola yang sering muncul: tawaran SEO/"daftarkan situsmu ke Google",
  link ke domain asing, dan email pengirim yang meniru domain sendiri (mis. @search-wfchunters.com).
  Mengembalikan alasan (untuk admin) atau null kalau terlihat wajar.
*/

const ALLOWED_DOMAINS = [
  "wfchunters.com", "google.com", "goo.gl", "maps.app.goo.gl", "g.co", "instagram.com", "instagr.am",
  "wa.me", "whatsapp.com", "tiktok.com", "youtube.com", "youtu.be", "facebook.com", "gofood.co.id", "grab.com",
];

const SEO_WORDS = /\b(search ?index|seo\b|backlinks?|rank(ing)? (on|in|higher)|google'?s|search results|traffic to your|submit (your|it|\S+\.\w+)|register your (site|website|domain)|web ?(design|development) services|marketing services|guest post|crypto|bitcoin|casino|forex|loans?\b|viagra|unsubscribe|dear sir|sir\/madam)\b/gi;

function domainsIn(text: string) {
  const found = text.toLowerCase().match(/\b(?:[a-z0-9-]+\.)+(?:com|net|org|info|biz|io|co|xyz|top|online|site|store|shop|club|ru|cn|in|us|me|ly|link|click)\b/g) ?? [];
  return [...new Set(found)].filter((d) => !ALLOWED_DOMAINS.some((a) => d === a || d.endsWith(`.${a}`)));
}

export function spamReason(m: { name: string; email: string; body: string; elapsedMs?: number | null }): string | null {
  const emailDomain = m.email.split("@")[1]?.toLowerCase() ?? "";
  if (emailDomain.includes("wfchunters") && emailDomain !== "wfchunters.com") return `Email meniru domain WFC Hunters (${emailDomain})`;

  // Form diisi kurang dari 3 detik (atau tanpa JavaScript): hampir pasti bot
  if (m.elapsedMs !== undefined && (m.elapsedMs === null || m.elapsedMs < 3000)) return "Form dikirim terlalu cepat (bot)";

  const text = `${m.name} ${m.body}`;
  const seo = text.match(SEO_WORDS)?.length ?? 0;
  const foreign = domainsIn(text);
  if (foreign.length && seo) return `Promosi dengan link ke ${foreign.slice(0, 2).join(", ")}`;
  if (seo >= 2) return "Tawaran SEO/pemasaran";
  if (foreign.length >= 3) return "Banyak link ke situs lain";
  return null;
}

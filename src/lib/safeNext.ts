/**
 * Tujuan setelah login/konfirmasi email. Hanya path di situs ini yang diterima.
 * "//situs-lain.com" dan "/\situs-lain.com" ditolak karena browser membacanya sebagai alamat situs lain
 * (celah open redirect yang bisa dipakai untuk phishing).
 */
export function safeNext(raw: string | null | undefined, fallback = "/") {
  if (!raw) return fallback;
  const v = raw.trim();
  // Cek versi asli dan versi yang sudah di-decode (mis. "/%2F%2Fsitus.com")
  let decoded = v;
  try { decoded = decodeURIComponent(v); } catch { return fallback; }
  for (const s of [v, decoded]) {
    if (!s.startsWith("/") || s.startsWith("//") || s.startsWith("/\\") || /[\u0000-\u001f]/.test(s)) return fallback;
  }
  return v;
}

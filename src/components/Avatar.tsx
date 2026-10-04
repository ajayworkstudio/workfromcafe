/** Foto profil bulat; kalau belum ada foto, tampilkan huruf depan nama. */
export default function Avatar({ url, name, className = "h-10 w-10 text-sm" }: { url?: string | null; name?: string | null; className?: string }) {
  const initial = (name ?? "?").trim().charAt(0).toUpperCase() || "?";
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" referrerPolicy="no-referrer" className={`${className} shrink-0 rounded-full bg-tint object-cover`} />
  ) : (
    <span className={`${className} grid shrink-0 place-items-center rounded-full bg-brand font-semibold text-white`} aria-hidden>{initial}</span>
  );
}

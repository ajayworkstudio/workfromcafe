/** Label kecil "Admin" di samping nama pengelola WFC Hunters (laporan, komentar, profil, author). */
export default function AdminBadge({ className = "" }: { className?: string }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full bg-ink px-2 py-0.5 align-middle text-[10px] font-semibold leading-4 text-white ${className}`}>Admin</span>;
}

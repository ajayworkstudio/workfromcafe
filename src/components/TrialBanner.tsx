import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

/** Pita tipis di bawah header untuk pengguna yang sedang trial. */
export default async function TrialBanner() {
  const [v, s] = await Promise.all([getViewer(), getSettings()]);
  if (s.free_mode) return null;
  if (v.plan !== "trial" || !v.premiumUntil) return null;
  const days = Math.max(0, Math.ceil((new Date(v.premiumUntil).getTime() - Date.now()) / 864e5));
  return (
    <div className="border-b border-gold/40 bg-gold/15 text-sm">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2">
        <p>
          <span className="font-semibold">Trial gratis: sisa {days} hari.</span>{" "}
          <span className="text-muted">Semua ulasan, menu, dan peta terbuka selama trial.</span>
        </p>
        <Link href="/harga" className="font-semibold text-brand hover:underline">Lanjut berlangganan</Link>
      </div>
    </div>
  );
}

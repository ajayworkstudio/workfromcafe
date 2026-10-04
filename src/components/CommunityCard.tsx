import Icon from "./Icon";

/** Ajakan gabung komunitas WhatsApp WorkFromCafe. */
export default function CommunityCard({ url, variant = "wide" }: { url: string; variant?: "wide" | "compact" }) {
  if (!url) return null;
  if (variant === "compact") {
    return (
      <a href={url} target="_blank" rel="noopener" className="card flex items-center gap-4 p-5 transition-colors hover:border-brand">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#25d366]/15 text-[#128c4a]"><Icon name="whatsapp" className="h-5 w-5" /></span>
        <span className="flex-1">
          <span className="block font-semibold">Komunitas WFC Hunters &amp; Author</span>
          <span className="block text-sm text-muted">Tukar info kafe, ajak kerja bareng, dan kabar kafe baru.</span>
        </span>
        <span className="text-sm font-semibold text-brand">Gabung →</span>
      </a>
    );
  }
  return (
    <div className="relative overflow-hidden rounded-3xl bg-ink p-7 text-white md:p-10">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-tan/20 blur-2xl" aria-hidden />
      <div className="relative grid gap-6 md:grid-cols-[1.4fr_1fr] md:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-tan">Komunitas</p>
          <h2 className="mt-2 text-3xl font-bold leading-tight md:text-4xl">Gabung bareng WFC Hunters &amp; Author.</h2>
          <p className="mt-3 max-w-md text-white/70">
            Tempat ngobrol para pemburu kafe kerja di Jawa Tengah: tukar rekomendasi, cari teman kerja bareng, dan dapat kabar kafe baru lebih dulu.
          </p>
        </div>
        <div className="md:text-right">
          <a href={url} target="_blank" rel="noopener" className="btn bg-[#25d366] text-ink hover:bg-[#1fbe5b]">
            <Icon name="whatsapp" className="h-5 w-5" />Gabung komunitas WhatsApp
          </a>
          <p className="mt-2 text-sm text-white/50">Gratis, terbuka untuk semua.</p>
        </div>
      </div>
    </div>
  );
}

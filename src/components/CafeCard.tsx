import Link from "next/link";
import Image from "next/image";
import type { Cafe } from "@/lib/types";
import { coverUrl, isOpenNow, priceLabel } from "@/lib/utils";

export default function CafeCard({ cafe }: { cafe: Cafe }) {
  const cover = coverUrl(cafe);
  const open = isOpenNow(cafe.opening_hours);
  const vibes = (cafe.tags ?? []).map((t) => t.tag).filter((t) => t?.type === "vibe").slice(0, 2);

  return (
    <Link href={`/kafe/${cafe.slug}`} className="group card overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative aspect-[4/3] bg-gradient-to-br from-latte to-bean">
        {cover ? (
          <Image src={cover} alt={cafe.name} fill sizes="(max-width:768px) 100vw, 33vw" className="object-cover transition group-hover:scale-105" />
        ) : (
          <div className="grid h-full place-items-center font-display text-5xl text-crema/70">☕</div>
        )}
        {open !== null && (
          <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold ${open ? "bg-leaf text-white" : "bg-roast/80 text-crema"}`}>
            {open ? "Buka" : "Tutup"}
          </span>
        )}
        {cafe.my_rating != null && (
          <span className="absolute right-3 top-3 rounded-full bg-paper px-2.5 py-1 text-xs font-bold">★ {Number(cafe.my_rating).toFixed(1)}</span>
        )}
      </div>
      <div className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-terra">
          {cafe.city?.name}{cafe.area ? ` · ${cafe.area}` : ""}
        </p>
        <h3 className="mt-1 font-display text-lg font-bold leading-tight">{cafe.name}</h3>
        {cafe.short_review && <p className="mt-1.5 line-clamp-2 text-sm text-bean/80">{cafe.short_review}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="chip">{priceLabel(cafe.price_range)}</span>
          {vibes.map((t) => <span key={t.id} className="chip">{t.name}</span>)}
        </div>
      </div>
    </Link>
  );
}

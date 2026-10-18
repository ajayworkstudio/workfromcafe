import Link from "next/link";
import Image from "next/image";
import type { Cafe } from "@/lib/types";
import { coverUrl, isOpenNow } from "@/lib/utils";
import { averageScore } from "@/lib/review";
import Icon from "./Icon";

/**
 * Kartu foto tinggi untuk HP: foto kafe memenuhi kartu, nama dan rating di atas gradasi gelap,
 * lalu bilah "Lihat kafe" sebagai tanda kartu bisa diketuk. Dipakai di carousel beranda.
 */
export default function CafePhotoCard({ cafe, priority = false }: { cafe: Cafe; priority?: boolean }) {
  const cover = coverUrl(cafe);
  const rating = cafe.my_rating != null ? Number(cafe.my_rating) : averageScore(cafe.scores);
  const open = isOpenNow(cafe.opening_hours);

  return (
    <Link href={`/kafe/${cafe.slug}`} className="group relative block aspect-[4/5] overflow-hidden rounded-[2rem] bg-ink text-white">
      {cover ? (
        <Image src={cover} alt={cafe.name} fill priority={priority} sizes="85vw" className="object-cover transition duration-500 group-hover:scale-[1.03]" />
      ) : (
        <div className="grid h-full place-items-center text-white/30"><Icon name="cup" className="h-14 w-14" /></div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/35 to-ink/0" aria-hidden />

      {open !== null && (
        <span className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-surface/90 px-2.5 py-1 text-xs font-semibold text-ink backdrop-blur">
          <span className={`h-1.5 w-1.5 rounded-full ${open ? "bg-ok" : "bg-mist"}`} />
          {open ? "Buka" : "Tutup"}
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0 p-4">
        <p className="text-sm text-white/80">{[cafe.area, cafe.city?.name].filter(Boolean).join(", ")}</p>
        <h3 className="mt-0.5 line-clamp-2 text-2xl font-extrabold leading-tight">{cafe.name}</h3>
        {rating != null && (
          <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-white/35 px-2.5 py-0.5 text-sm font-semibold">
            <Icon name="star" filled className="h-3.5 w-3.5 text-gold" />{rating.toFixed(1)}
          </span>
        )}
        <span className="glass mt-4 flex h-14 items-center justify-between rounded-full pl-6 pr-1.5 font-semibold">
          Lihat kafe
          <span className="grid h-11 w-11 place-items-center rounded-full bg-surface text-ink transition-transform group-hover:translate-x-0.5">
            <Icon name="arrow" className="h-5 w-5" />
          </span>
        </span>
      </div>
    </Link>
  );
}

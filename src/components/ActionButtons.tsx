"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleFavorite, toggleVisited, unlockCafe } from "@/app/kafe/[slug]/actions";
import Icon from "./Icon";

export function FavoriteButton({ cafeId, slug, active, loggedIn, round = false }: { cafeId: string; slug: string; active: boolean; loggedIn: boolean; round?: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toggle = () => (loggedIn ? start(async () => { await toggleFavorite(cafeId, slug); }) : router.push(`/masuk?next=/kafe/${slug}`));
  // Tombol bulat putih di atas foto kafe (tampilan HP)
  if (round) return (
    <button disabled={pending} aria-pressed={active} aria-label={active ? "Hapus dari simpanan" : "Simpan kafe"} onClick={toggle}
      className={`grid h-11 w-11 place-items-center rounded-full bg-surface shadow-[0_6px_18px_-8px_rgba(31,22,18,.5)] ${active ? "text-[#b4533a]" : "text-ink"}`}>
      <Icon name="heart" filled={active} className="h-5 w-5" />
    </button>
  );
  return (
    <button
      disabled={pending}
      aria-pressed={active}
      onClick={() => (loggedIn ? start(async () => { await toggleFavorite(cafeId, slug); }) : router.push(`/masuk?next=/kafe/${slug}`))}
      className={active ? "btn border border-brand bg-brand-soft text-brand" : "btn-ghost"}
    >
      <Icon name="heart" filled={active} className="h-4 w-4" />
      {active ? "Tersimpan" : "Simpan"}
    </button>
  );
}

export function VisitedButton({ cafeId, slug, active, loggedIn }: { cafeId: string; slug: string; active: boolean; loggedIn: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      disabled={pending}
      aria-pressed={active}
      onClick={() => (loggedIn ? start(async () => { await toggleVisited(cafeId, slug); }) : router.push(`/masuk?next=/kafe/${slug}`))}
      className={active ? "btn border border-brand bg-brand-soft text-brand" : "btn-ghost"}
    >
      <Icon name="check" className="h-4 w-4" />
      {active ? "Sudah ke sini" : "Tandai sudah ke sini"}
    </button>
  );
}

export function UnlockButton({ cafeId, slug, left }: { cafeId: string; slug: string; left: number }) {
  const [pending, start] = useTransition();
  return (
    <button disabled={pending} onClick={() => start(async () => { await unlockCafe(cafeId, slug); })} className="btn bg-white text-ink hover:bg-tint">
      {pending ? "Membuka…" : `Buka gratis (sisa ${left})`}
    </button>
  );
}

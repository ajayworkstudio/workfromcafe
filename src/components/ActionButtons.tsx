"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleFavorite, toggleVisited, unlockCafe } from "@/app/kafe/[slug]/actions";
import Icon from "./Icon";

export function FavoriteButton({ cafeId, slug, active, loggedIn }: { cafeId: string; slug: string; active: boolean; loggedIn: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
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

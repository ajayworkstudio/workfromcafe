"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleFavorite, toggleVisited, unlockCafe } from "@/app/kafe/[slug]/actions";

export function FavoriteButton({ cafeId, slug, active, loggedIn }: { cafeId: string; slug: string; active: boolean; loggedIn: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      disabled={pending}
      onClick={() => (loggedIn ? start(async () => { await toggleFavorite(cafeId, slug); }) : router.push(`/masuk?next=/kafe/${slug}`))}
      className={active ? "btn-primary" : "btn-ghost"}
    >
      {active ? "♥ Favorit" : "♡ Simpan"}
    </button>
  );
}

export function VisitedButton({ cafeId, slug, active, loggedIn }: { cafeId: string; slug: string; active: boolean; loggedIn: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      disabled={pending}
      onClick={() => (loggedIn ? start(async () => { await toggleVisited(cafeId, slug); }) : router.push(`/masuk?next=/kafe/${slug}`))}
      className={active ? "btn-dark" : "btn-ghost"}
    >
      {active ? "✓ Sudah ke sini" : "Tandai sudah ke sini"}
    </button>
  );
}

export function UnlockButton({ cafeId, slug, left }: { cafeId: string; slug: string; left: number }) {
  const [pending, start] = useTransition();
  return (
    <button disabled={pending} onClick={() => start(async () => { await unlockCafe(cafeId, slug); })} className="btn-dark">
      {pending ? "Membuka…" : `Buka gratis (sisa ${left} bulan ini)`}
    </button>
  );
}

"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleFavorite, toggleVisited, unlockCafe } from "@/app/kafe/[slug]/actions";
import Icon from "./Icon";
import { useT } from "./I18nProvider";

export function FavoriteButton({ cafeId, slug, active, loggedIn, round = false }: { cafeId: string; slug: string; active: boolean; loggedIn: boolean; round?: boolean }) {
  const { t } = useT();
  const [pending, start] = useTransition();
  const router = useRouter();
  const toggle = () => (loggedIn ? start(async () => { await toggleFavorite(cafeId, slug); }) : router.push(`/masuk?next=/kafe/${slug}`));
  // Tombol bulat kaca di atas foto kafe (tampilan HP)
  if (round) return (
    <button disabled={pending} aria-pressed={active} aria-label={active ? t("Hapus dari simpanan") : t("Simpan kafe")} onClick={toggle}
      className={`glass-dark grid h-11 w-11 place-items-center rounded-full ${active ? "text-gold" : "text-foam"}`}>
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
      {active ? t("Tersimpan") : t("Simpan")}
    </button>
  );
}

export function VisitedButton({ cafeId, slug, active, loggedIn }: { cafeId: string; slug: string; active: boolean; loggedIn: boolean }) {
  const { t } = useT();
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
      {active ? t("Sudah ke sini") : t("Tandai sudah ke sini")}
    </button>
  );
}

export function UnlockButton({ cafeId, slug, left }: { cafeId: string; slug: string; left: number }) {
  const { t } = useT();
  const [pending, start] = useTransition();
  return (
    <button disabled={pending} onClick={() => start(async () => { await unlockCafe(cafeId, slug); })} className="btn bg-white text-ink hover:bg-tint">
      {pending ? t("Membuka…") : t("Buka gratis (sisa {n})", { n: left })}
    </button>
  );
}

"use client";
import { useEffect } from "react";

/*
  Gerak beranda (MOTION 2, lihat DESIGN.md). Dua hal saja:
  1. Foto hero bergerak lebih lambat dari teks saat scroll, memberi kedalaman ke foto kafe.
  2. Di tumpukan kartu, kartu yang sedang tertimpa mengecil dan meredup sedikit,
     supaya jelas kartu mana yang sedang dibaca.
  Semua di-scrub ke posisi scroll (tidak ada animasi yang berjalan sendiri), dan dimatikan
  untuk pengguna yang memilih "kurangi gerakan". Tanpa JS, halaman tetap utuh.
*/
export default function HomeMotion() {
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([import("gsap"), import("gsap/ScrollTrigger")]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const hero = document.querySelector<HTMLElement>("[data-hero]");
        const photo = document.querySelector<HTMLElement>("[data-parallax]");
        if (hero && photo) {
          gsap.fromTo(photo, { yPercent: -4 }, {
            yPercent: 8, ease: "none",
            scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true },
          });
        }
      });

      // Efek tumpukan hanya di layar lebar, tempat kartu menempel (sticky).
      mm.add("(prefers-reduced-motion: no-preference) and (min-width: 768px)", () => {
        const cards = gsap.utils.toArray<HTMLElement>("[data-stack-card]");
        cards.forEach((card, i) => {
          const next = cards[i + 1];
          const inner = card.querySelector<HTMLElement>("[data-stack-inner]");
          const shade = card.querySelector<HTMLElement>("[data-stack-shade]");
          if (!next || !inner || !shade) return;
          const tl = gsap.timeline({
            scrollTrigger: { trigger: next, start: "top bottom-=10%", end: "top top+=160", scrub: true },
          });
          tl.to(inner, { scale: 0.95, ease: "none" }, 0).to(shade, { opacity: 0.28, ease: "none" }, 0);
        });
      });

      cleanup = () => mm.revert();
    })();

    return () => { cancelled = true; cleanup?.(); };
  }, []);

  return null;
}

"use client";
import { useEffect } from "react";

/*
  Gerak beranda (MOTION 2, lihat DESIGN.md): foto hero bergerak lebih lambat dari teks saat
  scroll, memberi kedalaman ke foto kafe. Animasi "Baru ditambahkan" ada di CafeSwipeStack.
  Di-scrub ke posisi scroll (tidak ada animasi yang berjalan sendiri), dan dimatikan
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

      cleanup = () => mm.revert();
    })();

    return () => { cancelled = true; cleanup?.(); };
  }, []);

  return null;
}
